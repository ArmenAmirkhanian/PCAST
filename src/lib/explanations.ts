export const HYDRATION_MODEL_EQUATIONS: Record<string, string> = {
  'bentz': `
$$\\alpha_2 = \\frac{p\\left\\{\\exp[R(1-p)t]-1\\right\\}}{\\exp[R(1-p)t]-p}$$

$$p = \\dfrac{\\rho_{\\mathrm{cem}}(w/c)}{f_{\\mathrm{exp}}+\\rho_{\\mathrm{cem}}\\,CS}$$

$$R = \\dfrac{m(f_{\\mathrm{exp}}+\\rho_{\\mathrm{cem}}\\,CS)}{\\left[1+\\rho_{\\mathrm{cem}}(w/c)\\right]^{2}}$$
`.trim(),

  'schindler-folliard': `
$$\\alpha = \\alpha_u \\cdot \\exp\\!\\left(-\\left[\\frac{\\tau}{t_e}\\right]^{\\!\\beta}\\right)$$

$$\\tau = 66.78\\,p_{C_3\\!A}^{-0.154}\\,p_{C_3\\!S}^{-0.401}\\,\\mathrm{Blaine}^{-0.804}\\,p_{SO_3}^{-0.758}\\cdot\\exp(2.187\\,p_{\\mathrm{SLAG}}+9.5\\,p_{\\mathrm{FA}}\\,p_{\\mathrm{FA\\text{-}CaO}})$$

$$\\beta = 181.4\\,p_{C_3\\!A}^{0.146}\\,p_{C_3\\!S}^{0.227}\\,\\mathrm{Blaine}^{-0.535}\\,p_{SO_3}^{0.558}\\cdot\\exp(-0.647\\,p_{\\mathrm{SLAG}})$$

$$\\alpha_u = \\frac{1.031\\,(w/c)}{0.194+w/c}+0.50\\,p_{\\mathrm{FA}}+0.30\\,p_{\\mathrm{SLAG}}\\leq 1.0$$
`.trim(),

};

export const EXPLANATIONS: Record<string, string> = {
  haversineApprox: `
This lookup begins with a target latitude and longitude from the input table and searches for nearby weather stations using a spatial RTree index. It first defines a series of expanding rectangular search windows centered on the input point, starting with a tight bounding box and progressively enlarging it until at least three stations are guaranteed to fall inside. For the selected window, stations whose RTree bounding boxes overlap the search rectangle are retrieved. A fast preliminary sorting is then performed using a simple squared degree-distance measure, $(\\Delta \\text{lat})^2 + (\\Delta \\text{lon})^2$, to keep only the closest candidate stations while avoiding expensive trigonometric calculations on the full dataset.

From these candidates, the query computes the true great-circle distance using the Haversine approximation. The distance is calculated as

$$d = 2R \\cdot \\arcsin\\left(\\sqrt{ \\sin^2\\left(\\Delta\\varphi/2\\right) + \\cos\\left(\\varphi_1\\right)\\cos\\left(\\varphi_2\\right)\\sin^2\\left(\\Delta\\lambda/2\\right) }\\right)$$,

where $R$ = 6371 km is the Earth’s radius, $\\varphi_1$ is the input latitude in radians, $\\varphi_2$ is the station latitude in radians, and $\\Delta\\varphi$ and $\\Delta\\lambda$ are the latitude and longitude differences in radians. The stations are then sorted by this computed distance, and the nearest three weather stations are returned.
`.trim(),

  climateNormalsExplanation: `
NOAA’s 30-year climate normals are statistically derived expected values calculated from 30 consecutive years of quality-controlled meteorological observations at a specific station. They are computed separately for individual hours, calendar days, months, and annual totals, and therefore represent the long-term central tendency of environmental conditions at a precise location and time of year. The dataset used in this tool is the 30-year hourly climate normals with a time horizon of 1991-2020.

Although often described casually as “averages,” climate normals are more rigorously defined as climatological expectations, derived from observed measurements and corrected for known biases such as station relocation, instrumentation changes, and time-of-observation effects. They do not represent a single historical hour or year, nor are they modeled projections of future climate. Instead, they provide a statistically stable baseline describing the typical environmental forcing conditions over a standardized 30-year reference period (currently 1991–2020).

For civil engineering applications, climate normals function analogously to representative design loads. They provide long-term boundary conditions that smooth interannual variability while preserving the seasonal structure of the climate system. Because they are station-specific and updated periodically, they reflect contemporary climatological conditions rather than historical extremes or future projections. In this way, NOAA climate normals serve as a foundational reference dataset for this tool.
`.trim()
} as const;

export type ExplanationKey = keyof typeof EXPLANATIONS;

/**
 * Theory narratives for the analysis sections of the PDF report.
 * Each entry is LaTeX-bearing source rendered by `renderMath` server-side.
 * Keep every `$$…$$` block on a single line and separate paragraphs with a
 * blank line (renderMath wraps each blank-line-delimited block in a <p>).
 */
export const ANALYSIS_NARRATIVES: Record<string, string> = {
  maturityTheory: `
The concrete maturity analysis predicts how quickly the in-place concrete gains strength under the project's specific cement system and curing temperature. It uses an exponential (Schindler–Folliard) hydration model whose shape parameters are regressed from the water-to-cementitious ratio ($w/cm$) for the selected cement type and supplementary cementitious material.

Because hydration is a thermally activated reaction, clock time is first converted to an Arrhenius equivalent age $t_e$ referenced to $T_r = 23\\,^{\\circ}\\mathrm{C}$. Summed hour by hour, the equivalent age is

$$t_e = \\sum \\exp\\!\\left[-\\frac{E_a}{R}\\left(\\frac{1}{T_c+273}-\\frac{1}{T_r+273}\\right)\\right]\\Delta t$$

where $E_a$ is the activation energy (J/mol), $R = 8.314\\,\\mathrm{J/mol\\cdot K}$ is the gas constant, $T_c$ is the curing temperature (taken from the concrete delivery temperature on the Project Information tab, in $^{\\circ}\\mathrm{C}$), and $\\Delta t = 1\\,\\mathrm{h}$.

The degree of hydration $\\alpha$ then follows the exponential maturity function

$$\\alpha(t_e) = \\alpha_u\\,\\exp\\!\\left[-\\left(\\frac{\\tau}{t_e}\\right)^{\\beta}\\right]$$

in which the ultimate degree of hydration $\\alpha_u$, the time parameter $\\tau$ (h) and the shape parameter $\\beta$ are all evaluated from $w/cm$ using cement-system-specific regression coefficients.

The rate of heat of hydration released per gram of cement is

$$q = H_u\\,C_c\\left(\\frac{\\tau}{t_e}\\right)^{\\beta}\\frac{\\beta}{t_e}\\,\\alpha\\,\\exp\\!\\left[\\frac{E_a}{R}\\left(\\frac{1}{T_r+273}-\\frac{1}{T_c+273}\\right)\\right]$$

where $H_u$ is the ultimate heat of hydration (J/g) and $C_c$ the cement-content factor. This heat is the internal source that drives the thermal-gradient analysis.

Early-age tensile strength is estimated from a fracture-mechanics critical stress-intensity ($K_{IC}$) correlation. $K_{IC}$ is an empirical function of $w/cm$ and age; the strength is recovered by inverting the single-edge-notch geometry,

$$f_t = \\frac{K_{IC}}{\\sqrt{\\pi a}\\;F(\\rho)}\\times 145.0$$

where $a$ is the effective notch depth (a fixed fraction of the slab/saw-cut depth), $F(\\rho)$ is a dimensionless geometry factor, and 145.0 converts MPa to psi. Strength is reported as zero until the concrete reaches its set time.
`.trim(),

  thermalGradientTheory: `
The thermal-gradient analysis computes the temperature profile through the slab depth for each of the first 72 hours after placement using the illitherm one-dimensional finite-element heat-transfer model. The slab is discretised through its thickness and the transient heat-conduction equation is integrated forward in time,

$$\\rho c_p\\,\\frac{\\partial T}{\\partial t} = \\frac{\\partial}{\\partial z}\\!\\left(k\\,\\frac{\\partial T}{\\partial z}\\right) + Q_h$$

where $\\rho$ is the density, $c_p$ the heat capacity, $k$ the thermal conductivity, $z$ the depth below the surface, and $Q_h$ the internal heat generated by cement hydration.

The hydration heat source reuses the kinetics of the maturity model, $Q_h = H_u\\,c_c\\,\\dot{\\alpha}$, where $\\dot{\\alpha}$ is the rate of hydration and $c_c$ the cement content. The hydration shape parameters ($\\alpha_u$, $\\tau$, $\\beta$, $E_a$) are taken from the Schindler–Folliard model on the Materials tab when it has been run, otherwise from literature defaults for Type I/II cement.

The exposed surface is governed by an energy balance combining absorbed short-wave solar radiation $(1-a)\\,q_{\\mathrm{sol}}$, convective exchange with the air $-h\\,(T_s-T_{\\mathrm{air}})$ with a wind-dependent film coefficient $h = 0.1\\,v^2$, and long-wave radiative exchange $-\\sigma\\varepsilon\\left[(T_s+273)^4-(T_{\\mathrm{air}}+273)^4\\right]$. Air temperature, wind speed and cloud cover are the 72-hour climate normals for the nearest weather station (Environment tab); the incident solar flux is estimated from the hour of day and the cloud fraction.

The figure below plots the computed temperature against depth, with the slab surface at the top, for a representative set of hours. From each hourly profile the model extracts the through-thickness mean temperature and the top-to-bottom gradient; the change in these two quantities relative to the stress-free set-time state is what loads the early-age stress analysis.
`.trim(),

  stressCreepTheory: `
The stress analysis evaluates whether early-age thermal movements generate enough tension to crack the slab before the saw-cut joint activates. The slab panel is modelled as a beam resting on a Winkler (spring) foundation with a transverse joint at the panel end.

The flexural response is governed by the radius of relative stiffness

$$\\ell = \\left[\\frac{E\\,h^3}{12\\,(1-\\nu^2)\\,k}\\right]^{1/4}$$

where $E$ is the age-dependent elastic modulus, $h$ the slab thickness, $\\nu$ Poisson's ratio and $k$ the modulus of subgrade reaction. The modulus develops with hydration as $E(t) = E_{\\mathrm{mature}}\\,\\alpha(t)/\\alpha_u$, which links the stress model directly to the maturity result.

Two thermal actions are applied each hour, both measured relative to the stress-free state at set time. The uniform temperature change $\\Delta T_c$ (through-thickness mean) is restrained by slab–base friction, producing an axial stress governed by $\\beta=\\sqrt{k_h/(h\\,E')}$. The gradient $\\Delta T_g$ (top minus bottom) curls the slab, producing a bending moment whose fully-restrained value is reduced by a finite-length edge-bending factor and redistributed through the joint by a $2\\times2$ compatibility solution. The more tensile of the two extreme fibres is tracked as the cracking demand.

When a saw-cut is specified, its normalised depth $\\alpha=a/h$ fixes the joint stiffness and the Mode-I stress-intensity factor $K_I$ through fracture-mechanics geometry functions; $K_I$ is zero for a free (uncut) joint.

Concrete relaxes rather than responding purely elastically at early age, so a rate-type creep formulation is applied via a Riesz transformation. A creep-compliance matrix $J(t,t')$ is assembled and reduced to a lower-triangular operator $B$ and its inverse $B^{-1}$. The temperature load history is pre-multiplied by $B^{-1}$ to give the pseudo-temperatures ($\\Delta T_c^{*}$, $\\Delta T_g^{*}$) used in the elastic analysis, and the resulting elastic stresses are post-multiplied by $B$ to recover the creep-relaxed stresses. The creep-adjusted tensile demand is finally compared against the maturity-based tensile strength to assess cracking risk.
`.trim(),
} as const;
