import type { HydrationModel } from '$lib/types';

export const HYDRATION_MODELS: { id: HydrationModel; name: string; recommended: boolean }[] = [
  { id: 'bentz',              name: 'Bentz (2006)',                  recommended: true  },
  { id: 'schindler-folliard', name: 'Schindler and Folliard (2005)', recommended: true  },
  { id: 'knudsen-linear',     name: 'Knudsen Linear (1984)',         recommended: false },
  { id: 'knudsen-parabolic',  name: 'Knudsen Parabolic (1984)',      recommended: false },
  { id: 'lam',                name: 'Lam et al. (2000)',             recommended: false }
];

export const HYDRATION_MODEL_NAMES: Record<HydrationModel, string> = Object.fromEntries(
  HYDRATION_MODELS.map((m) => [m.id, m.name])
) as Record<HydrationModel, string>;

export type Variable = {
  key: string;
  symbol: string;
  definition: string;
  unit?: string;
  isConstant: boolean;
  constantValue?: number;
  step?: string;
  min?: string;
  max?: string;
};

export const MODEL_VARIABLES: Record<HydrationModel, Variable[]> = {
  'bentz': [
    { key: 'rho_cem', symbol: 'ρ_cem', definition: 'Specific gravity of cement',                                                                             isConstant: false, step: '0.01',  min: '0' },
    { key: 'f_exp',   symbol: 'f_exp',  definition: 'Volumetric expansion coefficient for the solid cement hydration products relative to the cement reacted', isConstant: false, step: '0.001', min: '0' },
    { key: 'CS',      symbol: 'CS',     definition: 'Chemical shrinkage per gram of cement',                                                                  isConstant: false, step: '0.001', min: '0', unit: 'mL/g' },
    { key: 'm',       symbol: 'm',      definition: 'Calibration constant',                                                                                   isConstant: false, step: '0.001', min: '0' },
    { key: 't',       symbol: 't',      definition: 'Age of concrete',                                                                                        isConstant: false, step: '1',     min: '0', unit: 'days' }
  ],
  'schindler-folliard': [
    { key: 'p_C3A',    symbol: 'p_C₃A',    definition: 'Weight ratio of C₃A in terms of total cement content',         isConstant: false, step: '0.001', min: '0', max: '1' },
    { key: 'p_C3S',    symbol: 'p_C₃S',    definition: 'Weight ratio of C₃S in terms of total cement content',         isConstant: false, step: '0.001', min: '0', max: '1' },
    { key: 'p_SO3',    symbol: 'p_SO₃',    definition: 'Weight ratio of SO₃ in terms of total cement content',         isConstant: false, step: '0.001', min: '0', max: '1' },
    { key: 'Blaine',   symbol: 'Blaine',   definition: 'Specific surface area of cement',                               isConstant: false, step: '1',     min: '0', unit: 'cm²/g' },
    { key: 'p_FA',     symbol: 'p_FA',     definition: 'Weight ratio of fly ash in terms of total cement content',      isConstant: false, step: '0.001', min: '0', max: '1' },
    { key: 'p_SLAG',   symbol: 'p_SLAG',   definition: 'Weight ratio of slag in terms of total cement content',         isConstant: false, step: '0.001', min: '0', max: '1' },
    { key: 'p_FA_CaO', symbol: 'p_FA-CaO', definition: 'Weight ratio of CaO content of fly ash',                       isConstant: false, step: '0.001', min: '0', max: '1' },
    { key: 'E',        symbol: 'E',        definition: 'Activation energy',                                             isConstant: false, step: '100',   min: '0', unit: 'J/mol' },
    { key: 'T',        symbol: 'T',        definition: 'Concrete temperature',                                          isConstant: false, step: '0.1',   unit: '°C' },
    { key: 't',        symbol: 't',        definition: 'Age of concrete',                                               isConstant: false, step: '1',     min: '0', unit: 'hours' },
    { key: 'R',        symbol: 'R',        definition: 'Universal gas constant',                                        isConstant: true,  constantValue: 8.3144, unit: 'J/mol/K' }
  ],
  'knudsen-linear': [
    { key: 'alpha_u', symbol: 'αᵤ', definition: 'Ultimate degree of cement hydration', isConstant: false, step: '0.01',  min: '0', max: '1' },
    { key: 'm',       symbol: 'm',  definition: 'Hydration rate constant',             isConstant: false, step: '0.001', min: '0' },
    { key: 't',       symbol: 't',  definition: 'Age of concrete',                     isConstant: false, step: '1',     min: '0', unit: 'days' },
    { key: 't_0',     symbol: 't₀', definition: 'Induction time',                      isConstant: false, step: '0.01',  min: '0', unit: 'days' }
  ],
  'knudsen-parabolic': [
    { key: 'alpha_u', symbol: 'αᵤ', definition: 'Ultimate degree of cement hydration', isConstant: false, step: '0.01',  min: '0', max: '1' },
    { key: 'm',       symbol: 'm',  definition: 'Hydration rate constant',             isConstant: false, step: '0.001', min: '0' },
    { key: 't',       symbol: 't',  definition: 'Age of concrete',                     isConstant: false, step: '1',     min: '0', unit: 'days' },
    { key: 't_0',     symbol: 't₀', definition: 'Induction time',                      isConstant: false, step: '0.01',  min: '0', unit: 'days' }
  ],
  'lam': [
    { key: 'm1', symbol: 'm₁', definition: 'Calibration constant', isConstant: false, step: '0.001' },
    { key: 'm2', symbol: 'm₂', definition: 'Calibration constant', isConstant: false, step: '0.001' }
  ]
};

export const WC_NOTE_MODELS: HydrationModel[] = ['bentz', 'schindler-folliard', 'lam'];

export type ResultLabel = { key: string; symbol: string; definition: string; unit?: string };

export const MODEL_RESULT_LABELS: Record<HydrationModel, ResultLabel[]> = {
  'bentz': [
    { key: 'p',     symbol: 'p',  definition: 'Gel-space ratio parameter' },
    { key: 'R',     symbol: 'R',  definition: 'Reaction rate parameter' },
    { key: 'alpha', symbol: 'α₂', definition: 'Degree of hydration' }
  ],
  'schindler-folliard': [
    { key: 'alpha_u', symbol: 'αᵤ', definition: 'Ultimate degree of hydration' },
    { key: 'tau',     symbol: 'τ',  definition: 'Hydration time parameter', unit: 'hours' },
    { key: 'beta',    symbol: 'β',  definition: 'Hydration shape parameter' },
    { key: 't_e',     symbol: 'tₑ', definition: 'Equivalent age',           unit: 'hours' },
    { key: 'alpha',   symbol: 'α',  definition: 'Degree of hydration' }
  ],
  'knudsen-linear':    [{ key: 'alpha', symbol: 'α₁', definition: 'Degree of hydration' }],
  'knudsen-parabolic': [{ key: 'alpha', symbol: 'α₂', definition: 'Degree of hydration' }],
  'lam':               [{ key: 'alpha', symbol: 'α',  definition: 'Degree of hydration' }]
};
