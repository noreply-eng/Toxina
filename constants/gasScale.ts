export type GasScore = -2 | -1 | 0 | 1 | 2;

export type PatientGoalStatus = 'active' | 'achieved' | 'archived';

export const GAS_SCORES: GasScore[] = [-2, -1, 0, 1, 2];

export const GAS_SCORE_LABELS: Record<GasScore, string> = {
  [-2]: 'Mucho peor',
  [-1]: 'Algo peor',
  [0]: 'Meta alcanzada',
  [1]: 'Algo mejor',
  [2]: 'Mucho mejor',
};

export const GAS_SCORE_SHORT: Record<GasScore, string> = {
  [-2]: '-2',
  [-1]: '-1',
  [0]: '0',
  [1]: '+1',
  [2]: '+2',
};

export const SMART_FIELDS = [
  { key: 'smart_specific', label: 'Específico', hint: '¿Qué exactamente se busca lograr?' },
  { key: 'smart_measurable', label: 'Medible', hint: '¿Cómo se medirá el progreso?' },
  { key: 'smart_achievable', label: 'Alcanzable', hint: '¿Es realista con el tratamiento?' },
  { key: 'smart_relevant', label: 'Relevante', hint: '¿Por qué importa para el paciente?' },
  { key: 'smart_timebound', label: 'Temporal', hint: '¿En qué plazo se espera lograrlo?' },
] as const;

export const GAS_DESCRIPTOR_FIELDS = [
  { key: 'gas_minus2', score: -2 as GasScore, label: 'Nivel -2', hint: 'Resultado mucho peor de lo esperado' },
  { key: 'gas_minus1', score: -1 as GasScore, label: 'Nivel -1', hint: 'Resultado algo peor de lo esperado' },
  { key: 'gas_zero', score: 0 as GasScore, label: 'Nivel 0 (meta)', hint: 'Resultado esperado definido con el paciente' },
  { key: 'gas_plus1', score: 1 as GasScore, label: 'Nivel +1', hint: 'Resultado algo mejor de lo esperado' },
  { key: 'gas_plus2', score: 2 as GasScore, label: 'Nivel +2', hint: 'Resultado mucho mejor de lo esperado' },
] as const;
