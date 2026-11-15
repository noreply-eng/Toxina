import { dosisData } from '../constants/toxinData';
import {
  BRAND_FACTOR,
  type ToxinBrand,
} from '../constants/facialAestheticMap';
import type { MuscleSelection } from '../hooks/useCalculatorState';

export type { ToxinBrand };

const BRAND_LABEL: Record<ToxinBrand, string> = {
  Botox: 'Botox',
  Dysport: 'Dysport',
  Xeomin: 'Xeomin',
};

export function convertDoseBetweenBrands(
  dose: number,
  from: ToxinBrand,
  to: ToxinBrand
): number {
  if (from === to) return dose;
  const ona = dose / BRAND_FACTOR[from];
  const converted = ona * BRAND_FACTOR[to];
  return Math.round(converted * 100) / 100;
}

export type BrandConversionResult = {
  muscles: MuscleSelection[];
  skipped: string[];
  message: string | null;
};

/**
 * Conserva los músculos seleccionados y convierte dosis custom a la nueva marca.
 * Los que no existan en dosisData de la marca destino se omiten.
 */
export function convertMusclesForBrand(
  muscles: MuscleSelection[],
  fromBrand: ToxinBrand,
  toBrand: ToxinBrand
): BrandConversionResult {
  if (muscles.length === 0) {
    return { muscles: [], skipped: [], message: null };
  }

  if (fromBrand === toBrand) {
    return { muscles, skipped: [], message: null };
  }

  const skipped: string[] = [];
  const converted: MuscleSelection[] = [];

  for (const m of muscles) {
    const newRange = dosisData[toBrand]?.[m.name];
    if (!newRange) {
      if (!skipped.includes(m.name)) skipped.push(m.name);
      continue;
    }

    if (m.customDose !== undefined) {
      converted.push({
        ...m,
        customDose: convertDoseBetweenBrands(m.customDose, fromBrand, toBrand),
      });
    } else {
      // min/max se resolverá con el rango de la nueva marca al recalcular
      converted.push({ ...m, customDose: undefined });
    }
  }

  const parts: string[] = [];
  if (converted.length > 0) {
    const ratioNote =
      fromBrand === 'Dysport' || toBrand === 'Dysport'
        ? ' (ratio ≈ 1:2.5 respecto a Ona)'
        : ' (equivalencia 1:1)';
    parts.push(
      `Dosis convertidas de ${BRAND_LABEL[fromBrand]} a ${BRAND_LABEL[toBrand]}${ratioNote}. Revisa y vuelve a calcular.`
    );
  }
  if (skipped.length > 0) {
    parts.push(
      `No disponibles en ${BRAND_LABEL[toBrand]}: ${skipped.join(', ')}.`
    );
  }

  return {
    muscles: converted,
    skipped,
    message: parts.length > 0 ? parts.join(' ') : null,
  };
}
