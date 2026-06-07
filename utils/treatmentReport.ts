import { puntosMotoresData } from '../constants/toxinData';
import { guiaUsgData } from '../constants/usgData';
import type { PrintPreferences } from '../hooks/usePrintPreferences';

export interface TreatmentDetailRow {
  muscle_name: string;
  side: string;
  units: number;
}

export interface TreatmentReportData {
  patientName: string;
  patientAge?: string | number | null;
  patientWeight?: string | number | null;
  sessionDate: string;
  productName: string;
  dilution?: number | null;
  pathologyTitle?: string | null;
  clinicalSummary?: string | null;
  notes?: string | null;
  doctorName?: string | null;
  totalUnits: number;
  details: TreatmentDetailRow[];
  treatmentId?: string;
}

export function getVolumeMl(
  units: number,
  productName: string,
  dilution?: number | null
): string {
  const dilutionVal = dilution ?? 0;
  if (!dilutionVal || Number.isNaN(dilutionVal)) return '—';

  const unitsPerVial = productName === 'Dysport' ? 500 : 100;
  return `${((units / unitsPerVial) * dilutionVal).toFixed(2)} ml`;
}

export function sortTreatmentDetails(details: TreatmentDetailRow[]): TreatmentDetailRow[] {
  return [...details].sort((a, b) => b.units - a.units || a.muscle_name.localeCompare(b.muscle_name));
}

function escapeCsv(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTreatmentToCsv(data: TreatmentReportData): void {
  const sorted = sortTreatmentDetails(data.details);
  const totalVolume = getVolumeMl(data.totalUnits, data.productName, data.dilution);

  const rows: (string | number)[][] = [
    ['RESUMEN DE APLICACIÓN DE TOXINA'],
    ['Fecha', new Date(data.sessionDate).toLocaleDateString('es-MX')],
    ['Paciente', data.patientName],
    ...(data.patientAge ? [['Edad', data.patientAge]] : []),
    ...(data.patientWeight ? [['Peso (kg)', data.patientWeight]] : []),
    ['Marca', data.productName],
    ...(data.dilution ? [['Dilución', `${data.dilution} ml`]] : []),
    ...(data.pathologyTitle ? [['Patología', data.pathologyTitle]] : []),
    ...(data.doctorName ? [['Médico', data.doctorName]] : []),
    [''],
    ['Músculo', 'Lado', 'Dosis (U)', 'Vol. (ml)', '% del total'],
    ...sorted.map((d) => {
      const pct = data.totalUnits > 0 ? ((d.units / data.totalUnits) * 100).toFixed(1) : '0';
      return [
        d.muscle_name,
        d.side,
        d.units,
        getVolumeMl(d.units, data.productName, data.dilution),
        `${pct}%`,
      ];
    }),
    [''],
    ['TOTAL APLICADO', '', `${data.totalUnits} U`, totalVolume, '100%'],
  ];

  if (data.clinicalSummary) {
    rows.push([''], ['Resumen clínico', data.clinicalSummary]);
  }
  if (data.notes) {
    rows.push(['Notas', data.notes]);
  }

  const csvContent = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = data.patientName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Paciente';
  const dateStr = new Date(data.sessionDate).toISOString().split('T')[0];
  link.href = url;
  link.download = `Sesion_Toxina_${safeName}_${dateStr}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function getMuscleGuideSections(
  details: TreatmentDetailRow[],
  preferences: Pick<PrintPreferences, 'includeMotorPoints' | 'includeUsgGuide'>
): { motorPoints: { muscle: string; text: string }[]; usgGuide: { muscle: string; text: string }[] } {
  const uniqueMuscles = Array.from(new Set(details.map((d) => d.muscle_name)));

  const motorPoints = preferences.includeMotorPoints
    ? uniqueMuscles
        .filter((m) => puntosMotoresData[m])
        .map((m) => ({ muscle: m, text: puntosMotoresData[m] }))
    : [];

  const usgGuide = preferences.includeUsgGuide
    ? uniqueMuscles
        .filter((m) => guiaUsgData[m])
        .map((m) => ({ muscle: m, text: guiaUsgData[m] }))
    : [];

  return { motorPoints, usgGuide };
}

export function getTreatmentSummaryStats(details: TreatmentDetailRow[], totalUnits: number) {
  const muscleCount = details.length;
  const bilateralCount = details.filter((d) => d.side === 'Ambos').length;
  const maxEntry = details.reduce(
    (max, d) => (d.units > max.units ? d : max),
    details[0] ?? { muscle_name: '—', side: '—', units: 0 }
  );

  return { muscleCount, bilateralCount, maxEntry, totalUnits };
}
