export const HYDRATION_MODEL_EQUATIONS: Record<string, string> = {
  'bentz': `
$$\\alpha_2 = \\frac{p\\left\\{\\exp[R(1-p)t]-1\\right\\}}{\\exp[R(1-p)t]-p}$$

$$p = \\dfrac{\\rho_{\\mathrm{cem}}(w/c)}{f_{\\mathrm{exp}}+\\rho_{\\mathrm{cem}}\\,CS}$$

$$R = \\dfrac{m(f_{\\mathrm{exp}}+\\rho_{\\mathrm{cem}}\\,CS)}{\\left[1+\\rho_{\\mathrm{cem}}(w/c)\\right]^{2}}$$
`.trim(),

  'schindler-folliard': `
$$\\alpha = \\alpha_u \\cdot \\exp\\!\\left(-\\left[\\frac{\\tau}{t_e}\\right]^{\\!\\beta}\\right)$$

$$\\tau = 66.78\\,p_{C_3\\!A}^{-0.154}\\,p_{C_3\\!S}^{-0.401}\\,\\mathrm{Blaine}^{-0.804}\\,p_{SO_3}^{-0.758}\\cdot\\exp(2.187\\,p_{\\mathrm{SLAG}}+9.5\\,p_{\\mathrm{FA}}\\,p_{\\mathrm{FA\\text{-}CaO}})$$

$$\\beta = 181.4\\,p_{C_3\\!A}^{0.146}\\,p_{C_3\\!S}^{0.227}\\,\\mathrm{Blaine}^{-0.535}\\,p_{SO_3}^{-0.558}\\cdot\\exp(-0.647\\,p_{\\mathrm{SLAG}})$$

$$\\alpha_u = \\frac{1.031\\,(w/c)}{0.194+w/c}+0.50\\,p_{\\mathrm{FA}}+0.30\\,p_{\\mathrm{SLAG}}\\leq 1.0$$
`.trim(),

  'knudsen-linear': `$$\\alpha_1 = \\alpha_u\\cdot\\frac{m(t-t_0)}{1+m(t-t_0)}$$`.trim(),

  'knudsen-parabolic': `$$\\alpha_2 = \\alpha_u\\cdot\\frac{m\\sqrt{t-t_0}}{1+m\\sqrt{t-t_0}}$$`.trim(),

  'lam': `$$\\alpha = m_1\\cdot e^{-m_2/(w/c)}$$`.trim()
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
