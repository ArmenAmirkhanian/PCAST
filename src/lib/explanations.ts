export const EXPLANATIONS: Record<string, string> = {
  haversineApprox: `
This lookup begins with a target latitude and longitude from the input table and searches for nearby weather stations using a spatial RTree index. It first defines a series of expanding rectangular search windows centered on the input point, starting with a tight bounding box and progressively enlarging it until at least three stations are guaranteed to fall inside. For the selected window, stations whose RTree bounding boxes overlap the search rectangle are retrieved. A fast preliminary sorting is then performed using a simple squared degree-distance measure, $(\\Delta \\text{lat})^2 + (\\Delta \\text{lon})^2$, to keep only the closest candidate stations while avoiding expensive trigonometric calculations on the full dataset.

From these candidates, the query computes the true great-circle distance using the Haversine approximation. The distance is calculated as

$$d = 2R \\cdot \\arcsin\\left(\\sqrt{ \\sin^2\\left(\\Delta\\varphi/2\\right) + \\cos\\left(\\varphi_1\\right)\\cos\\left(\\varphi_2\\right)\\sin^2\\left(\\Delta\\lambda/2\\right) }\\right)$$,

where $R$ = 6371 km is the Earth’s radius, $\\varphi_1$ is the input latitude in radians, $\\varphi_2$ is the station latitude in radians, and $\\Delta\\varphi$ and $\\Delta\\lambda$ are the latitude and longitude differences in radians. The stations are then sorted by this computed distance, and the nearest three weather stations are returned.
`.trim()
} as const;

export type ExplanationKey = keyof typeof EXPLANATIONS;