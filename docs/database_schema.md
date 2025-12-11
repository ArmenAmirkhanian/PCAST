# NOAA Climatological Normals Database Documentation

This document describes the structure and dataset contents of the `normals_full.db` SQLite database, a compact relational form of the NOAA Global Historical Climatology Network (GHCN) climatological normals.

---

## 1. Overview

### Purpose and Origin
This database provides structured access to NOAA’s 1991–2020 *Climatological Normals* dataset, which summarizes long-term hourly, daily, monthly, and annual weather statistics for thousands of GHCN stations. It transforms NOAA’s original CSV files (which contain thousands of columns) into normalized relational tables suitable for queries and spatial search.

### Key Relationships
- Each **station** has many **hourly_normals** records.
- Each **variable** (e.g., `TEMP`, `DEWP`, `PRCP`) is shared across stations.
- The **R-tree index** `stations_rtree` supports fast latitude/longitude searches.

---

## 2. Database Tables

### `stations`
Metadata for each GHCN station.

| Column | Type | Description |
| --- | --- | --- |
| `id` | INTEGER PRIMARY KEY | Internal numeric identifier. |
| `ghcn_id` | TEXT UNIQUE | Official GHCN ID (e.g., `USW00023174`). |
| `name` | TEXT | Station name. |
| `latitude` | REAL | Decimal degrees North. |
| `longitude` | REAL | Decimal degrees East (negative = West). |
| `elevation` | REAL | Elevation in meters. |

---

### `variables`
Defines variable codes from the NOAA dataset.

| Column | Type | Description |
| --- | --- | --- |
| `id` | INTEGER PRIMARY KEY | Internal numeric identifier. |
| `code` | TEXT UNIQUE | Full NOAA variable code (e.g., `HLY-TEMP-NORMAL`). |
| `timing` | TEXT | Time resolution (`HLY`, `DLY`, `MLY`, `ANN`). |
| `element` | TEXT | Measured meteorological element. |
| `stat` | TEXT | Type of statistic (`NORMAL`, `10PCTL`, etc.). |
| `qualifier` | TEXT | Optional qualifier or threshold. |

#### Variable Naming Convention
`TTT-EEEE-SSSSSS[-QQQQQQ]`

| Segment | Meaning | Examples |
| --- | --- | --- |
| `TTT` | Timing | `HLY`, `DLY`, `MLY`, `ANN`, `DJF`, `MAM` |
| `EEEE` | Element | `TEMP`, `PRCP`, `TMAX`, `TMIN`, `WIND`, `CLOD` |
| `SSSSSS` | Statistic | `NORMAL`, `STDDEV`, `AVGNDS`, `TOBADJ` |
| `QQQQQQ` | Qualifier | `GRTH090`, `BASE65`, `PCTCLR`, etc. |

---

### `hourly_normals`
Core climatological values by station, variable, and date.

| Column | Type | Description |
| --- | --- | --- |
| `station_id` | INTEGER | FK → `stations.id` |
| `var_id` | INTEGER | FK → `variables.id` |
| `month` | INTEGER | Month (1–12) or 99 for annual. |
| `day` | INTEGER | Day (1–31) or 99 if not applicable. |
| `hour` | INTEGER | Hour (0–23) or 99 if not applicable. |
| `value_i` | INTEGER | Integer representation of the value (often tenths). |
| `meas_flag` | TEXT | Measurement flag. |
| `comp_flag` | TEXT | Completeness flag. |
| `years_used` | INTEGER | Station-years contributing to normal. |

Primary key: `(station_id, var_id, month, day, hour)`

---

### Measurement Flags
| Flag | Meaning |
| --- | --- |
| `M` | Missing. |
| `V` | Too cold to compute (frost-free risk). |
| `W` | Not used. |
| `X` | Nonzero value rounded to zero. |
| `Y` | Insufficient data to compute. |
| `Z` | Logical inconsistency. |

### Completeness Flags
| Flag | Meaning |
| --- | --- |
| `S` | Standard (≥24 years, WMO-compliant, infilled). |
| `R` | Representative (≥10 years, infilled). |
| `P` | Provisional (≥10 years, not infilled). |
| `E` | Estimated (≥2 years, statistical estimation). |

---

### `stations_rtree`
Spatial index table backing `stations_rtree` virtual index.
Used automatically by SQLite for bounding-box and proximity searches.

#### How the R-tree speeds location lookups

- **What it is:** An R-tree is a spatial index built from nested rectangles (bounding boxes). Instead of checking every station, SQLite walks the tree to discard stations outside your search area.
- **What is stored:** `stations_rtree` tracks `min_lat`, `max_lat`, `min_lon`, and `max_lon` for each station, keyed so that `rowid` matches `stations.id`.
- **Typical use:** Join `stations_rtree` with `stations` to prefilter candidates within a latitude/longitude window, then do precise distance ordering on that small subset.
- **Why it’s good:** Without it, every spatial search would scan all stations (linear cost). The R-tree prunes entire branches, keeping lookups fast even as station counts grow. This is especially helpful for map clicks, bounding-box searches, and “find nearest station” operations.
- **Maintenance cost:** Reads speed up; writes that move station locations also update the R-tree. Station coordinates are stable, so the overhead for this dataset is negligible.

---

## 3. Data Semantics and Conventions

- **Scaling:** Temperature values typically in tenths of °C → divide by 10.0.
- **Missing/aggregate dates:** `99` marks non-applicable month/day/hour.
- **Preferred quality:** Restrict to `comp_flag` ∈ {`S`, `R`} for reliable analyses.
- **Units:**
  - Temperatures: °C (tenths)
  - Precipitation/Snow: mm or hundredths/tenths of inch per NOAA metadata
  - Degree days: Fahrenheit-based (base temperature variants)

---

## 4. Relationships
- `hourly_normals.station_id` → `stations.id`
- `hourly_normals.var_id` → `variables.id`
- `stations_rtree.rowid` = `stations.id`

---

## 5. Example Queries

### Fetch temperature normal for a given station
```sql
SELECT s.name, v.code, hn.value_i / 10.0 AS temp_c
FROM hourly_normals hn
JOIN stations s ON s.id = hn.station_id
JOIN variables v ON hn.var_id = v.id
WHERE s.ghcn_id = 'USW00023174'
  AND v.code = 'HLY-TEMP-NORMAL'
  AND hn.month = 1 AND hn.day = 1 AND hn.hour = 3;
```

### Find nearest station
```sql
WITH nearest AS (
  SELECT s.id
  FROM stations_rtree r
  JOIN stations s ON s.id = r.rowid
  ORDER BY (s.latitude - 34.05)*(s.latitude - 34.05) + (s.longitude + 118.25)*(s.longitude + 118.25)
  LIMIT 1
)
SELECT hn.month, hn.day, hn.hour, hn.value_i / 10.0 AS temp_c
FROM hourly_normals hn
JOIN nearest n ON hn.station_id = n.id
JOIN variables v ON hn.var_id = v.id
WHERE v.element = 'TEMP' AND v.stat = 'NORMAL';
```

---

## 6. Dataset Background

The underlying dataset originates from NOAA’s **Climatological Normals (1991–2020)** archives distributed by the National Centers for Environmental Information (NCEI). The source CSVs are structured in two forms:
- **By-station:** all variables for one station (from which this database was created).
- **By-variable:** one variable across all stations.

### Variable Format
Variables follow NOAA’s naming standards such as `HLY-TEMP-NORMAL` or `ANN-CLDD-BASE65`. These are constructed from timing, element, statistic, and qualifier components.

### Example Variable Groups
- Temperature: `TEMP`, `TMAX`, `TMIN`, `TAVG`, `DUTR`
- Moisture: `DEWP`
- Wind: `WIND`, `HIDX`, `WCHL`, `AVGSPD`, `VCTSPD`
- Clouds: `CLOD`, `PCTCLR`, `PCTOVC`, `PCTSCT`
- Precipitation: `PRCP`, `SNOW`, `SNWD`
- Degree days: `CLDD`, `HTDD`, `GRDD`
- Derived probability fields: `PRBFST`, `PRBLST`, `PRBGSL`, `PRBOCC`

### Completeness and Quality
Each value includes measurement and completeness flags derived from NOAA metadata to indicate its quality, completeness, and derivation method.

---

## 7. Special Dataset Notes

- **Percentiles:** Quartiles and quintiles appear as percentiles in by-station files (e.g., `QUAR01` → `25PCTL`).
- **WMO temperature thresholds:** Special WMO-normalized variables (e.g., `MLY-TMAX-AVGNDS-GRTH076`) correspond to thresholds ≥25°C, 30°C, 35°C, and 40°C.
- **Estimated data:** Not all stations include all variables. For example, precipitation-only stations may lack snow depth.

---

## 8. Practical Usage Tips
- Use `comp_flag` to filter by data quality.
- Join through `stations_rtree` for efficient spatial lookups.
- Always rescale `value_i` appropriately (divide by 10 for temperature).
- Use `variables.element` and `variables.stat` filters to extract specific kinds of data.

---

## 9. Appendix — Variable Glossary

| Code | Description |
| --- | --- |
| **TEMP** | Air temperature (°C, tenths). |
| **DEWP** | Dew point temperature (°C, tenths). |
| **TMAX / TMIN / TAVG** | Max, min, or average daily temperature. |
| **DUTR** | Diurnal temperature range. |
| **HIDX** | Heat index (°C). |
| **WCHL** | Wind chill (°C). |
| **PRES** | Atmospheric pressure. |
| **WIND** | Wind speed or direction metrics. |
| **AVGSPD** | Average wind speed. |
| **PCTCLM** | % calm winds. |
| **1STDIR / 2NDDIR** | Primary/secondary modal wind directions. |
| **VCTDIR / VCTSPD** | Mean wind vector direction/speed. |
| **CLOD** | Total cloud cover. |
| **PCTCLR / PCTFEW / PCTSCT / PCTBKN / PCTOVC** | Fraction of time with clear, few, scattered, broken, or overcast clouds. |
| **PRCP** | Precipitation (mm or hundredths of inch). |
| **SNOW / SNWD** | Snowfall and snow depth. |
| **CLDD / HTDD / GRDD** | Cooling, heating, and growing degree days. |
| **BASE40–BASE72** | Degree day base temperature (°F). |
| **QUAR01–03 / QUIN01–04 / TERC01–02** | Quartile, quintile, or tercile values. |
| **10PCTL / 90PCTL** | 10th and 90th percentiles (hourly). |
| **AVGNDS** | Average number of days meeting criterion. |
| **TOBADJ** | Time-of-observation bias adjustment. |
| **PRBFST / PRBLST / PRBGSL / PRBOCC** | Frost-free dates, growing season length, and occurrence probabilities. |
| **GRTHnnn / LSTHnnn** | Count of days ≥ or ≤ temperature threshold (°F). |
| **GEnnnuu** | Precipitation exceedance thresholds (e.g., GE001TI = ≥0.1 in). |
| **TnnFPmm** | Agricultural thresholds (temperature & probability). |
| **PCTALL** | Probability of meeting threshold in 29-day window. |

---

## 10. Citation
Data source:
> NOAA National Centers for Environmental Information (NCEI). *U.S. Climate Normals 1991–2020: Hourly, Daily, Monthly, and Annual Station Normals (GHCN-Daily).*
