import { pathologiesData, type PathologyData } from '../data/pathologyData';

export const DEFAULT_FOLLOW_UP_DAYS = 84;

const FOLLOW_UP_DAYS_BY_CATEGORY: Record<PathologyData['category'], number> = {
  aesthetic: 84,
  neurological: 90,
  autonomic: 90,
  urological: 90,
};

const FOLLOW_UP_DAYS_BY_PATHOLOGY: Record<string, number> = {
  blefaroespasmo: 90,
  espasmo_hemifacial: 90,
  cervicalgia_miofascial: 84,
  bruxismo: 84,
  hiperhidrosis: 168,
};

function parseFrequencyDays(frequency?: string): number | null {
  if (!frequency) return null;
  const lower = frequency.toLowerCase();

  const weekMatch = lower.match(/(\d+)\s*[-–]?\s*(\d+)?\s*semanas?/);
  if (weekMatch) {
    const min = parseInt(weekMatch[1], 10);
    const max = weekMatch[2] ? parseInt(weekMatch[2], 10) : min;
    return Math.round(((min + max) / 2) * 7);
  }

  const monthMatch = lower.match(/(\d+)\s*[-–]?\s*(\d+)?\s*meses?/);
  if (monthMatch) {
    const min = parseInt(monthMatch[1], 10);
    const max = monthMatch[2] ? parseInt(monthMatch[2], 10) : min;
    return Math.round(((min + max) / 2) * 30);
  }

  return null;
}

export function getSuggestedFollowUpDays(pathologyId?: string | null): number {
  if (pathologyId && FOLLOW_UP_DAYS_BY_PATHOLOGY[pathologyId]) {
    return FOLLOW_UP_DAYS_BY_PATHOLOGY[pathologyId];
  }

  const pathology = pathologyId
    ? pathologiesData.find((p) => p.id === pathologyId)
    : undefined;

  if (pathology) {
    const fromFrequency = parseFrequencyDays(pathology.frequency);
    if (fromFrequency) return fromFrequency;
    return FOLLOW_UP_DAYS_BY_CATEGORY[pathology.category] ?? DEFAULT_FOLLOW_UP_DAYS;
  }

  return DEFAULT_FOLLOW_UP_DAYS;
}

export function getSuggestedFollowUpDate(fromDate: Date, pathologyId?: string | null): Date {
  const days = getSuggestedFollowUpDays(pathologyId);
  const result = new Date(fromDate);
  result.setDate(result.getDate() + days);
  result.setHours(9, 0, 0, 0);
  return result;
}

export function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
