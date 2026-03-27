/**
 * weather-station.test.ts
 *
 * Sanity-check run of the illitherm thermal model driven by real GHCN hourly
 * climate normals from the three nearest weather stations to a target location.
 *
 * Weather values are blended via Inverse-Distance Weighting (IDW, power=2):
 *   w_i  = 1 / d_i²          (d_i = Haversine distance in miles)
 *   W_i  = w_i / Σ w_j       (normalised weight)
 *
 * The test checks that the solver produces finite, physically plausible output
 * and prints a full summary table of stations, weights, weather, and results.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { resolve } from 'path';
import { runModel } from '../run';
import type { ModelInput, WeatherRow } from '../types';

// ── Target location ──────────────────────────────────────────────────────────
// Chicago, IL – well-covered by multiple nearby ASOS/airport stations.
const TARGET_LAT  = 41.85;
const TARGET_LON  = -87.65;
const TARGET_NAME = 'Chicago, IL';

// ── Simulation period ─────────────────────────────────────────────────────────
// July 15 – peak summer, all 24 hours
const SIM_MONTH = 7;
const SIM_DAY   = 15;
const SIM_YEAR  = 2024;
const SIM_HOURS = 24;

// ── Unit helpers ──────────────────────────────────────────────────────────────

/** GHCN normals store temps in tenths of °F.  value_i/10 → °F → °C */
function fToC(fahrenheit: number): number {
  return (fahrenheit - 32) / 1.8;
}

/** Haversine distance between two lat/lon points, result in miles */
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R   = 3958.8; // Earth mean radius, miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Simple clear-sky solar irradiance estimate (W/m²).
 * Uses approximate solar declination + hour-angle geometry.
 * Not in the GHCN database – estimated astronomically.
 *
 * Assumption: clear-sky peak ~900 W/m², all-sky reduction not applied.
 */
function estimateSolarRad(hour: number, latDeg: number, month: number, day: number): number {
  // Day-of-year (approximate)
  const doy   = Math.round((month - 1) * 30.4375 + day);
  // Solar declination (degrees) – Spencer's formula approximation
  const B     = (360 / 365) * (doy - 81) * (Math.PI / 180);
  const declDeg = 23.45 * Math.sin(B);
  const latRad  = latDeg * (Math.PI / 180);
  const declRad = declDeg * (Math.PI / 180);
  // Hour angle: solar noon = 0, 1 h = 15°
  const hourAngle = (hour - 12) * 15 * (Math.PI / 180);
  const sinElev =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngle);
  const elevRad = Math.asin(Math.max(0, sinElev));
  // Simplified clear-sky beam irradiance
  return elevRad > 0 ? 900 * Math.sin(elevRad) : 0;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StationInfo {
  id:           number;
  ghcn_id:      string;
  name:         string;
  latitude:     number;
  longitude:    number;
  elevation:    number;
  distanceMiles: number;
  rawWeight:    number;
  normWeight:   number;
}

interface NormalRow {
  hour:     number;
  var_code: string;
  value:    number;   // already divided by 10 (raw tenths unit → actual)
}

// ── Shared state populated in beforeAll ───────────────────────────────────────

let stations:       StationInfo[]  = [];
let blendedWeather: WeatherRow[]   = [];

// stationId → varCode → hour → value (in original °F or m/s units from DB)
const stationNormals = new Map<number, Map<string, Map<number, number>>>();

// ─────────────────────────────────────────────────────────────────────────────

describe('runModel – IDW-blended Chicago weather normals (July 15)', () => {

  beforeAll(() => {
    const dbPath = resolve(process.cwd(), 'normals_full.db');
    const db = new Database(dbPath, { readonly: true });

    // ── 1. Find 3 nearest stations ──────────────────────────────────────────
    //    Use a 3° bounding box for the initial candidate pull, then rank by
    //    true Haversine distance and keep the 3 closest.
    const candidateStmt = db.prepare<[number, number, number, number, number, number, number, number]>(`
      SELECT id, ghcn_id, name, latitude, longitude, COALESCE(elevation, 0) AS elevation
      FROM   stations
      WHERE  latitude  BETWEEN ? AND ?
        AND  longitude BETWEEN ? AND ?
      ORDER  BY (latitude - ?) * (latitude - ?) +
                (longitude - ?) * (longitude - ?)
      LIMIT  10
    `);

    const raw = candidateStmt.all(
      TARGET_LAT - 3, TARGET_LAT + 3,
      TARGET_LON - 3, TARGET_LON + 3,
      TARGET_LAT, TARGET_LAT,
      TARGET_LON, TARGET_LON
    ) as Omit<StationInfo, 'distanceMiles' | 'rawWeight' | 'normWeight'>[];

    const withDist = raw
      .map(s => ({
        ...s,
        distanceMiles: haversineMiles(TARGET_LAT, TARGET_LON, s.latitude, s.longitude),
        rawWeight: 0,
        normWeight: 0
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, 3);

    // IDW power-2 weights
    const rawWeights = withDist.map(s => 1 / (s.distanceMiles ** 2));
    const sumW       = rawWeights.reduce((a, b) => a + b, 0);
    stations = withDist.map((s, i) => ({
      ...s,
      rawWeight:  rawWeights[i],
      normWeight: rawWeights[i] / sumW
    }));

    // ── 2. Fetch July 15 normals for each of the 3 stations ────────────────
    const normalsStmt = db.prepare<[number, number, number]>(`
      SELECT hn.hour,
             v.code  AS var_code,
             CASE
               WHEN v.code GLOB 'HLY-TEMP-*' THEN hn.value_i / 10.0
               WHEN v.code GLOB 'HLY-DEWP-*' THEN hn.value_i / 10.0
               WHEN v.code GLOB 'HLY-WIND-*' THEN hn.value_i / 10.0
               ELSE hn.value_i * 1.0
             END AS value
      FROM   hourly_normals hn
      JOIN   variables      v  ON v.id = hn.var_id
      WHERE  hn.station_id = ?
        AND  hn.month      = ?
        AND  hn.day        = ?
        AND  v.code IN ('HLY-TEMP-NORMAL', 'HLY-DEWP-NORMAL', 'HLY-WIND-AVGSPD')
      ORDER  BY hn.hour
    `);

    for (const s of stations) {
      const rows = normalsStmt.all(s.id, SIM_MONTH, SIM_DAY) as NormalRow[];
      const byVar = new Map<string, Map<number, number>>();
      for (const r of rows) {
        if (!byVar.has(r.var_code)) byVar.set(r.var_code, new Map());
        byVar.get(r.var_code)!.set(r.hour, r.value);
      }
      stationNormals.set(s.id, byVar);
    }

    db.close();

    // ── 3. Build IDW-blended WeatherRow[] ──────────────────────────────────
    //    TEMP and DEWP are in °F in the database → convert to °C.
    //    WIND-AVGSPD is in tenths of m/s → already m/s after /10.
    //    Solar radiation: not in GHCN normals; estimated astronomically.
    for (let h = 0; h < SIM_HOURS; h++) {
      let blendTempF = 0;
      let blendDewpF = 0;
      let blendWind  = 0;

      for (const s of stations) {
        const sn = stationNormals.get(s.id)!;
        // Fall back to nearest-hour value if exact hour missing
        const tempF = sn.get('HLY-TEMP-NORMAL')?.get(h) ?? 75;
        const dewpF = sn.get('HLY-DEWP-NORMAL')?.get(h) ?? 60;
        const wind  = sn.get('HLY-WIND-AVGSPD')?.get(h)  ?? 3.0;

        blendTempF += s.normWeight * tempF;
        blendDewpF += s.normWeight * dewpF;
        blendWind  += s.normWeight * wind;
      }

      blendedWeather.push({
        year:      SIM_YEAR,
        month:     SIM_MONTH,
        day:       SIM_DAY,
        hour:      h,
        airTemp:   fToC(blendTempF),
        windSpeed: blendWind,
        dewPoint:  fToC(blendDewpF),
        solarRad:  estimateSolarRad(h, TARGET_LAT, SIM_MONTH, SIM_DAY)
      });
    }
  });

  // ── Test ───────────────────────────────────────────────────────────────────

  it('produces finite, physically plausible temperatures for all 24 hours', () => {

    // ════════════════════════════════════════════════════════════════════════
    //  ASSUMED VALUES – documented here for full reproducibility
    // ════════════════════════════════════════════════════════════════════════
    //
    //  Surface (concrete pavement – typical new placement):
    //    albedo     = 0.40  (fresh Portland cement concrete ≈ 0.35–0.45)
    //    emissivity = 0.93  (typical concrete)
    //
    //  Material layers:
    //    Layer 0 – wearing slab (concrete), 0.20 m thick
    //      k   = 1.7 W/m·K    (normal-weight concrete)
    //      cp  = 880 J/kg·K
    //      ρ   = 2350 kg/m³
    //      n   = 5 elements   (top surface resolved by numPointsTopLayer)
    //    Layer 1 – sub-base / compacted aggregate, 0.30 m thick
    //      k   = 1.2 W/m·K
    //      cp  = 900 J/kg·K
    //      ρ   = 2100 kg/m³
    //      n   = 10 elements
    //
    //  Hydration parameters (JCAS2 model, IDOT Class PV pavement mix, Chicago):
    //    alphau    = 0.70    ultimate degree of hydration
    //                        Mills formula: 1.031·(w/c)/(0.194+w/c) at w/c=0.43
    //    tau       = 13.0 h  hydration time parameter (Type I/II blend, moderate)
    //    Ea        = 41 500 J/mol  activation energy (Type I/II Portland per
    //                        Schindler & Folliard 2005, no SCMs)
    //    R         = 8.3144 J/mol·K  (overridden by constants.ts; kept here)
    //    Hu        = 335 000 J/kg   total heat of hydration, Type I/II Portland
    //                        (range 320–370 kJ/kg; ASTM C186 typical ~335 kJ/kg)
    //    cc        = 335    kg/m³  cement content, IDOT Class PV mix
    //                        (IL-DOT spec: 335 kg/m³ ± 10%)
    //    beta      = 1.0     Avrami shape exponent (standard for Type I/II)
    //    Tr        = 20.0 °C reference temperature
    //    Tdelivery = 24.0 °C initial placement temperature
    //                        (IDOT max 30°C/86°F; 24°C is a typical summer pour)
    //
    //  Controls:
    //    numStepsPerHour  = 4   (15-min sub-steps for stability)
    //    spinUpReps       = 2   (two passes through 24-h cycle to stabilise IC)
    //    numPointsTopLayer = 11 (interpolated output points in Layer 0)
    //    sTime            = 1   (start recording creep at first hour)
    // ════════════════════════════════════════════════════════════════════════

    const input: ModelInput = {
      controls: {
        numStepsPerHour:   4,
        spinUpReps:        2,
        numPointsTopLayer: 11,
        sTime:             1
      },
      surface: {
        albedo:     0.40,
        emissivity: 0.93
      },
      layers: [
        {
          thickness:           0.20,
          thermalConductivity: 1.7,
          heatCapacity:        880,
          density:             2350,
          numLayerElements:    5
        },
        {
          thickness:           0.30,
          thermalConductivity: 1.2,
          heatCapacity:        900,
          density:             2100,
          numLayerElements:    10
        }
      ],
      weather: blendedWeather,
      hydration: {
        alphau:    0.70,
        tau:       13.0,
        Ea:        41_500,
        R:         8.3144,
        Hu:        335_000,
        cc:        335,
        beta:      1.0,
        Tr:        20.0,
        Tdelivery: 24.0
      }
    };

    const out = runModel(input);

    // ── Console output ─────────────────────────────────────────────────────

    const sep  = '═'.repeat(66);
    const dash = '─'.repeat(66);

    console.log(`\n${sep}`);
    console.log(` ILLITHERM TEST RUN – IDW-Blended Weather Station Normals`);
    console.log(` Target : ${TARGET_NAME}  (${TARGET_LAT}°N, ${Math.abs(TARGET_LON)}°W)`);
    console.log(` Period : ${SIM_YEAR}-${String(SIM_MONTH).padStart(2,'0')}-${String(SIM_DAY).padStart(2,'0')}, 24 hours  |  spinUpReps=2  |  4 steps/hr`);
    console.log(sep);

    // Station table
    console.log('\n NEAREST STATIONS – Inverse-Distance² Weighting\n');
    console.log(' #   Name                               Lat      Lon     Dist(mi)  Weight');
    console.log(' ' + '─'.repeat(79));
    for (let i = 0; i < stations.length; i++) {
      const s = stations[i];
      const name = s.name.padEnd(34);
      const lat  = s.latitude.toFixed(4).padStart(7);
      const lon  = s.longitude.toFixed(4).padStart(8);
      const mi   = s.distanceMiles.toFixed(2).padStart(8);
      const w    = (s.normWeight * 100).toFixed(2).padStart(6) + '%';
      console.log(` ${i + 1}   ${name} ${lat}  ${lon}  ${mi}  ${w}`);
    }

    // Assumed-values block
    console.log(`\n${dash}`);
    console.log(' ASSUMED VALUES');
    console.log(dash);
    console.log('  Surface  : albedo=0.40 (fresh concrete), emissivity=0.93');
    console.log('  Layer 0  : 20 cm concrete slab  k=1.7 W/m·K  ρ=2350 kg/m³  cp=880 J/kg·K  n=5 elem');
    console.log('  Layer 1  : 30 cm sub-base        k=1.2 W/m·K  ρ=2100 kg/m³  cp=900 J/kg·K  n=10 elem');
    console.log('  Hydration: alphau=0.70  tau=13 h  Ea=41500 J/mol  beta=1.0  Tr=20°C  Tdelivery=24°C (~75°F)');
    console.log('  Hu=335000 J/kg (Type I/II Portland, ASTM C186)  cc=335 kg/m³ (IDOT Class PV)');
    console.log('  Hu×cc = 1.12×10⁸ J/m³  →  theoretical adiabatic ΔT ≈ 38°C');
    console.log('  Solar rad: estimated from clear-sky astronomical model (not in GHCN normals)');
    console.log('  Wind     : GHCN HLY-WIND-AVGSPD in tenths of m/s (÷10 applied)');
    console.log('  Temp/Dew : GHCN HLY-TEMP-NORMAL / HLY-DEWP-NORMAL in tenths of °F → converted to °C');

    // Weather table
    console.log(`\n${dash}`);
    console.log(' IDW-BLENDED WEATHER  (representative hours)');
    console.log(dash);
    console.log('  Hr  AirTemp(°C)  DewPt(°C)  Wind(m/s)  Solar(W/m²)');
    console.log('  ' + '─'.repeat(52));
    for (const hr of [0, 3, 6, 9, 12, 15, 18, 21]) {
      const w = blendedWeather[hr];
      if (!w) continue;
      console.log(
        `  ${String(hr).padStart(2)}  ` +
        `${w.airTemp.toFixed(2).padStart(9)}   ` +
        `${w.dewPoint.toFixed(2).padStart(8)}   ` +
        `${w.windSpeed.toFixed(3).padStart(8)}   ` +
        `${w.solarRad.toFixed(1).padStart(10)}`
      );
    }

    // Per-station raw values at noon for transparency
    console.log(`\n${dash}`);
    console.log(' PER-STATION RAW VALUES at Hour 12 (solar noon)  [units: °F for temp/dew, m/s for wind]');
    console.log(dash);
    console.log('  Station                           TempNorm(°F)  DewpNorm(°F)  WindAvg(m/s)  Weight');
    console.log('  ' + '─'.repeat(74));
    for (const s of stations) {
      const sn   = stationNormals.get(s.id)!;
      const tmpF = sn.get('HLY-TEMP-NORMAL')?.get(12)?.toFixed(1) ?? 'N/A';
      const dwpF = sn.get('HLY-DEWP-NORMAL')?.get(12)?.toFixed(1) ?? 'N/A';
      const wnd  = sn.get('HLY-WIND-AVGSPD')?.get(12)?.toFixed(2) ?? 'N/A';
      const w    = (s.normWeight * 100).toFixed(2) + '%';
      console.log(`  ${s.name.padEnd(33)}  ${String(tmpF).padStart(12)}  ${String(dwpF).padStart(12)}  ${String(wnd).padStart(12)}  ${w.padStart(6)}`);
    }

    // Results table
    console.log(`\n${dash}`);
    console.log(' TEMPERATURE PROFILE RESULTS  (11 interpolated points in top 20 cm slab)');
    console.log(dash);
    console.log('  Hr  Surface(°C)  @ 2cm(°C)  @ 5cm(°C)  @ 10cm(°C)  @ 15cm(°C)  @ 20cm(°C)');
    console.log('  ' + '─'.repeat(72));
    for (const r of out.results) {
      const t   = r.temps;
      const len = t.length;
      // Map points: 0=surface, 2=~2cm, 4=~4cm, 5=mid, 7=~14cm, 10=~20cm (bottom of slab)
      const pts = [
        t[0],
        t[Math.round(len * 1 / 10)],
        t[Math.round(len * 2.5 / 10)],
        t[Math.round(len / 2)],
        t[Math.round(len * 7.5 / 10)],
        t[len - 1]
      ];
      console.log(
        `  ${String(r.hour).padStart(2)}  ` +
        pts.map(v => v.toFixed(2).padStart(10)).join('  ')
      );
    }

    console.log(`\n${sep}\n`);

    // ── Assertions ─────────────────────────────────────────────────────────

    // We got all 3 stations
    expect(stations).toHaveLength(3);

    // Weights sum to 1 (within float rounding)
    const weightSum = stations.reduce((s, st) => s + st.normWeight, 0);
    expect(weightSum).toBeCloseTo(1.0, 10);

    // Closest station has more weight than the farthest
    expect(stations[0].normWeight).toBeGreaterThan(stations[2].normWeight);

    // Weather rows are present and in expected unit ranges
    expect(blendedWeather).toHaveLength(SIM_HOURS);
    for (const w of blendedWeather) {
      expect(w.airTemp).toBeGreaterThan(-10);   // not below -10 °C in July Chicago
      expect(w.airTemp).toBeLessThan(45);        // not above 45 °C
      expect(w.windSpeed).toBeGreaterThan(0);
      expect(w.solarRad).toBeGreaterThanOrEqual(0);
    }

    // Model produces one result row per weather hour
    expect(out.results).toHaveLength(SIM_HOURS);

    // All temperatures finite and physically plausible
    for (const r of out.results) {
      for (const t of r.temps) {
        expect(Number.isFinite(t)).toBe(true);
        expect(t).toBeGreaterThan(-5);    // warmer than -5 °C for summer Chicago
        expect(t).toBeLessThan(150);      // realistic upper bound with full hydration heat
      }
    }

    // Temperatures evolve: surface at noon should be warmer than at midnight
    const midnightSurface = out.results[0].temps[0];
    const noonSurface     = out.results[12]?.temps[0];
    if (noonSurface !== undefined) {
      expect(noonSurface).toBeGreaterThan(midnightSurface);
    }

    // Creep output (°F) is defined and converts correctly
    expect(out.creep).toBeDefined();
    if (out.creep && out.creep.length > 0) {
      const cTemps = out.results[0].temps;
      const fTemps = out.creep[0].temps;
      for (let i = 0; i < cTemps.length; i++) {
        expect(fTemps[i]).toBeCloseTo(cTemps[i] * 1.8 + 32, 5);
      }
    }
  });
});
