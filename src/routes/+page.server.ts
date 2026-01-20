import { EXPLANATIONS } from '$lib/explanations';
import { renderMath } from '$lib/server/renderMath';

export function load() {
  return {
    explanations: {
      haversineApprox: renderMath(EXPLANATIONS.haversineApprox)
    }
  };
}
