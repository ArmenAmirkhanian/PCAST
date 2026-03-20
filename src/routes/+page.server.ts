import { EXPLANATIONS, HYDRATION_MODEL_EQUATIONS } from '$lib/explanations';
import { renderMath } from '$lib/server/renderMath';

export function load() {
  return {
    explanations: {
      haversineApprox: renderMath(EXPLANATIONS.haversineApprox),
      climateNormals: renderMath(EXPLANATIONS.climateNormalsExplanation)
    },
    hydrationModelEquations: Object.fromEntries(
      Object.entries(HYDRATION_MODEL_EQUATIONS).map(([k, v]) => [k, renderMath(v)])
    ) as Record<string, string>
  };
}
