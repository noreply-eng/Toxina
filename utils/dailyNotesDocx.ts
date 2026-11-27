import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from 'docx';
import {
  CONSULTATION_STATUS_LABELS,
  VISIT_TYPE_LABELS,
} from '../types/clinical';
import { CLINICAL_NOTE_TYPE_LABELS } from '../types/patientClinicalNotes';
import { getConsultationDuration } from './consultationHelpers';
import { sortTreatmentDetails } from './treatmentReport';
import type {
  DailyBriefingReport,
  DailyNotesExportOptions,
  DailyPatientBriefing,
} from '../services/dailyNotesExport';

const COLOR_PRIMARY = '137FEC';
const COLOR_NAVY = '0F172A';
const COLOR_SLATE = '475569';
const COLOR_MUTED = '64748B';
const COLOR_BORDER = 'CBD5E1';
const COLOR_SOFT_BG = 'F8FAFC';
const COLOR_ACCENT_BG = 'EFF6FF';
const COLOR_ALERT_BG = 'FEF2F2';
const COLOR_ALERT_BORDER = 'DC2626';
const COLOR_ALERT_TEXT = '991B1B';
const COLOR_WARN_TEXT = 'B45309';

const FONT_FAMILY = 'Calibri';

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatLongSpanishDate(date: Date): string {
  return capitalizeFirst(
    date.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  );
}

function formatShortIsoDate(isoDate: string): string {
  const datePart = isoDate.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (y && m && d) {
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function computeAgeLabel(birthDate?: string | null, age?: number | null): string | null {
  if (typeof age === 'number' && Number.isFinite(age) && age > 0) {
    return `${age} años`;
  }
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    years -= 1;
  }
  return years >= 0 ? `${years} años` : null;
}

function daysBetween(fromIso: string, toDate: Date): number | null {
  const d = new Date(fromIso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = toDate.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function formatFileDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildMultilineParagraphs(
  text: string,
  options: { color?: string; size?: number; italics?: boolean; spacingAfter?: number } = {}
): Paragraph[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const color = options.color ?? COLOR_NAVY;
  const size = options.size ?? 20;
  const italics = options.italics ?? false;
  const spacingAfter = options.spacingAfter ?? 60;

  return lines.map(
    (line, idx) =>
      new Paragraph({
        spacing: {
          before: idx === 0 ? 40 : 0,
          after: idx === lines.length - 1 ? 40 : spacingAfter,
          line: 276,
        },
        children: [
          new TextRun({
            text: line.length > 0 ? line : ' ',
            font: FONT_FAMILY,
            size,
            color,
            italics,
          }),
        ],
      })
  );
}

function cellBorders(color = COLOR_BORDER, size = 4) {
  return {
    top: { style: BorderStyle.SINGLE, color, size },
    bottom: { style: BorderStyle.SINGLE, color, size },
    left: { style: BorderStyle.SINGLE, color, size },
    right: { style: BorderStyle.SINGLE, color, size },
  };
}

function buildSummaryKpiTable(report: DailyBriefingReport): Table {
  const cells = [
    { label: 'CITAS DEL DÍA', value: String(report.stats.totalAppointments), accent: COLOR_PRIMARY },
    { label: 'CON NOTA PREVIA', value: String(report.stats.withPreviousNote), accent: '0F766E' },
    { label: 'SIN NOTAS PREVIAS', value: String(report.stats.withoutPreviousNote), accent: COLOR_WARN_TEXT },
    {
      label: 'ALERTAS DE ALERGIAS',
      value: String(report.stats.withAllergies),
      accent: report.stats.withAllergies > 0 ? COLOR_ALERT_BORDER : COLOR_SLATE,
    },
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: cells.map(
          (item) =>
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: COLOR_SOFT_BG },
              borders: cellBorders(COLOR_BORDER, 4),
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 40 },
                  children: [
                    new TextRun({
                      text: item.value,
                      font: FONT_FAMILY,
                      size: 30,
                      bold: true,
                      color: item.accent,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: item.label,
                      font: FONT_FAMILY,
                      size: 15,
                      bold: true,
                      color: COLOR_MUTED,
                    }),
                  ],
                }),
              ],
            })
        ),
      }),
    ],
  });
}

function buildOverviewChecklistTable(items: DailyPatientBriefing[]): Table {
  const headers = ['#', 'Hora', 'Paciente', 'Tipo de visita', 'Motivo', 'Última nota'];
  const widths = [6, 10, 26, 18, 22, 18];

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (label, index) =>
        new TableCell({
          width: { size: widths[index], type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_NAVY },
          borders: cellBorders(COLOR_NAVY, 4),
          margins: { top: 80, bottom: 80, left: 90, right: 90 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label,
                  font: FONT_FAMILY,
                  size: 17,
                  bold: true,
                  color: 'FFFFFF',
                }),
              ],
            }),
          ],
        })
    ),
  });

  const dataRows = items.map((item, idx) => {
    const fill = idx % 2 === 1 ? COLOR_SOFT_BG : 'FFFFFF';
    const hasAllergies = Boolean(item.patient?.allergies?.trim());
    const lastNoteCellText = item.latestNote
      ? `${formatShortIsoDate(item.latestNote.note_date)} (${
          CLINICAL_NOTE_TYPE_LABELS[item.latestNote.note_type] ?? item.latestNote.note_type
        })`
      : 'No hay notas previas';

    const rowValues: Array<{ text: string; bold?: boolean; italics?: boolean; color?: string }> = [
      { text: String(idx + 1), bold: true, color: COLOR_SLATE },
      { text: formatTime(item.consultation.consultation_date), bold: true, color: COLOR_PRIMARY },
      {
        text: hasAllergies ? `${item.patientName} [Alergia]` : item.patientName,
        bold: true,
        color: COLOR_NAVY,
      },
      { text: VISIT_TYPE_LABELS[item.consultation.visit_type] ?? item.consultation.visit_type, color: COLOR_SLATE },
      { text: item.consultation.treatment_type?.trim() || 'Sin motivo especificado', color: COLOR_SLATE },
      {
        text: lastNoteCellText,
        italics: !item.latestNote,
        color: item.latestNote ? COLOR_NAVY : COLOR_MUTED,
      },
    ];

    return new TableRow({
      cantSplit: true,
      children: rowValues.map(
        (cell, cIdx) =>
          new TableCell({
            width: { size: widths[cIdx], type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            borders: cellBorders(COLOR_BORDER, 4),
            margins: { top: 70, bottom: 70, left: 90, right: 90 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cell.text,
                    font: FONT_FAMILY,
                    size: 18,
                    bold: cell.bold,
                    italics: cell.italics,
                    color: cell.color,
                  }),
                ],
              }),
            ],
          })
      ),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function buildPatientDetailBlocks(
  item: DailyPatientBriefing,
  index: number,
  targetDate: Date,
  options: DailyNotesExportOptions
): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [];
  const { consultation, patient, latestNote, latestTreatment, activeGoals } = item;

  if (index > 0 && options.pageBreakPerPatient) {
    blocks.push(new Paragraph({ children: [new PageBreak()] }));
  }

  const time = formatTime(consultation.consultation_date);
  const duration = getConsultationDuration(consultation);
  const visitTypeLabel = VISIT_TYPE_LABELS[consultation.visit_type] ?? consultation.visit_type;
  const statusLabel = CONSULTATION_STATUS_LABELS[consultation.status] ?? consultation.status;

  const demographicParts: string[] = [
    visitTypeLabel,
    `Estado: ${statusLabel}`,
  ];
  const ageLabel = computeAgeLabel(patient?.birth_date, patient?.age);
  if (ageLabel) demographicParts.push(`Edad: ${ageLabel}`);
  if (patient?.weight) demographicParts.push(`Peso: ${patient.weight} kg`);
  if (patient?.phone) demographicParts.push(`Tel: ${patient.phone}`);

  const bannerChildren: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: `#${index + 1}  ·  ${time} (${duration} min)  ·  `,
          font: FONT_FAMILY,
          size: 22,
          bold: true,
          color: COLOR_PRIMARY,
        }),
        new TextRun({
          text: item.patientName,
          font: FONT_FAMILY,
          size: 24,
          bold: true,
          color: COLOR_NAVY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: consultation.treatment_type || consultation.notes ? 50 : 0 },
      children: [
        new TextRun({
          text: demographicParts.join('  |  '),
          font: FONT_FAMILY,
          size: 18,
          color: COLOR_SLATE,
        }),
      ],
    }),
  ];

  if (consultation.treatment_type?.trim()) {
    bannerChildren.push(
      new Paragraph({
        spacing: { after: consultation.notes?.trim() ? 30 : 0 },
        children: [
          new TextRun({
            text: 'Motivo de la cita: ',
            font: FONT_FAMILY,
            size: 18,
            bold: true,
            color: COLOR_NAVY,
          }),
          new TextRun({
            text: consultation.treatment_type.trim(),
            font: FONT_FAMILY,
            size: 18,
            color: COLOR_NAVY,
          }),
        ],
      })
    );
  }

  if (consultation.notes?.trim()) {
    bannerChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Nota de agenda: ',
            font: FONT_FAMILY,
            size: 18,
            bold: true,
            color: COLOR_SLATE,
          }),
          new TextRun({
            text: consultation.notes.trim(),
            font: FONT_FAMILY,
            size: 18,
            italics: true,
            color: COLOR_SLATE,
          }),
        ],
      })
    );
  }

  blocks.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: COLOR_ACCENT_BG },
              borders: {
                top: { style: BorderStyle.SINGLE, color: 'BFDBFE', size: 4 },
                right: { style: BorderStyle.SINGLE, color: 'BFDBFE', size: 4 },
                bottom: { style: BorderStyle.SINGLE, color: 'BFDBFE', size: 4 },
                left: { style: BorderStyle.SINGLE, color: COLOR_PRIMARY, size: 24 },
              },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: bannerChildren,
            }),
          ],
        }),
      ],
    })
  );

  if (options.includeClinicalAlerts && patient?.allergies?.trim()) {
    blocks.push(
      new Paragraph({ spacing: { before: 70, after: 0 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: COLOR_ALERT_BG },
                borders: {
                  top: { style: BorderStyle.SINGLE, color: 'FECACA', size: 4 },
                  right: { style: BorderStyle.SINGLE, color: 'FECACA', size: 4 },
                  bottom: { style: BorderStyle.SINGLE, color: 'FECACA', size: 4 },
                  left: { style: BorderStyle.SINGLE, color: COLOR_ALERT_BORDER, size: 20 },
                },
                margins: { top: 80, bottom: 80, left: 130, right: 130 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'ALERTA DE ALERGIAS: ',
                        font: FONT_FAMILY,
                        size: 18,
                        bold: true,
                        color: COLOR_ALERT_TEXT,
                      }),
                      new TextRun({
                        text: patient.allergies.trim(),
                        font: FONT_FAMILY,
                        size: 18,
                        bold: true,
                        color: COLOR_NAVY,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // Core section: Latest Clinical Note
  const noteMetaParts: string[] = [];
  if (latestNote) {
    noteMetaParts.push(`Fecha: ${formatShortIsoDate(latestNote.note_date)}`);
    noteMetaParts.push(
      `Tipo: ${CLINICAL_NOTE_TYPE_LABELS[latestNote.note_type] ?? latestNote.note_type}`
    );
    if (item.totalNotesCount > 1) {
      noteMetaParts.push(`Más reciente de ${item.totalNotesCount} notas`);
    }
  }

  const noteBodyParagraphs: Paragraph[] = latestNote
    ? buildMultilineParagraphs(latestNote.content.trim(), {
        color: COLOR_NAVY,
        size: 20,
      })
    : [
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({
              text: 'No hay notas previas',
              font: FONT_FAMILY,
              size: 20,
              italics: true,
              color: COLOR_MUTED,
            }),
          ],
        }),
      ];

  blocks.push(
    new Paragraph({ spacing: { before: 90, after: 0 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: COLOR_SOFT_BG },
              borders: cellBorders(COLOR_BORDER, 4),
              margins: { top: 70, bottom: 70, left: 130, right: 130 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'ÚLTIMA NOTA CLÍNICA',
                      font: FONT_FAMILY,
                      size: 18,
                      bold: true,
                      color: COLOR_NAVY,
                    }),
                    ...(noteMetaParts.length > 0
                      ? [
                          new TextRun({
                            text: `   ·   ${noteMetaParts.join('  |  ')}`,
                            font: FONT_FAMILY,
                            size: 17,
                            color: COLOR_SLATE,
                          }),
                        ]
                      : []),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
              borders: cellBorders(COLOR_BORDER, 4),
              margins: { top: 90, bottom: 90, left: 130, right: 130 },
              children: noteBodyParagraphs,
            }),
          ],
        }),
      ],
    })
  );

  // Optional: Latest Toxin Treatment
  if (options.includeLatestTreatment) {
    const treatmentParagraphs: Paragraph[] = [];

    if (latestTreatment) {
      const daysSince = daysBetween(latestTreatment.date, targetDate);
      const summaryParts = [
        `Fecha: ${formatShortIsoDate(latestTreatment.date)}${
          daysSince !== null ? ` (hace ${daysSince} días)` : ''
        }`,
        `Producto: ${latestTreatment.product_name}`,
        `Total: ${latestTreatment.total_units} U`,
      ];
      if (latestTreatment.dilution) {
        summaryParts.push(`Dilución: ${latestTreatment.dilution} ml`);
      }
      if (latestTreatment.pathology_title) {
        summaryParts.push(`Patología: ${latestTreatment.pathology_title}`);
      }

      treatmentParagraphs.push(
        new Paragraph({
          spacing: { after: 50 },
          children: [
            new TextRun({
              text: 'Última aplicación de toxina: ',
              font: FONT_FAMILY,
              size: 18,
              bold: true,
              color: COLOR_NAVY,
            }),
            new TextRun({
              text: summaryParts.join('  |  '),
              font: FONT_FAMILY,
              size: 18,
              color: COLOR_SLATE,
            }),
          ],
        })
      );

      if (latestTreatment.details.length > 0) {
        const sortedDetails = sortTreatmentDetails(latestTreatment.details);
        const muscleSummary = sortedDetails
          .map((d) => `${d.muscle_name} (${d.side}): ${d.units} U`)
          .join('  ·  ');

        treatmentParagraphs.push(
          new Paragraph({
            spacing: { after: latestTreatment.clinical_summary ? 40 : 0 },
            children: [
              new TextRun({
                text: 'Músculos y dosis: ',
                font: FONT_FAMILY,
                size: 17,
                bold: true,
                color: COLOR_SLATE,
              }),
              new TextRun({
                text: muscleSummary,
                font: FONT_FAMILY,
                size: 17,
                color: COLOR_NAVY,
              }),
            ],
          })
        );
      }

      if (latestTreatment.clinical_summary?.trim()) {
        treatmentParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Resumen de sesión: ',
                font: FONT_FAMILY,
                size: 17,
                bold: true,
                color: COLOR_SLATE,
              }),
              new TextRun({
                text: latestTreatment.clinical_summary.trim(),
                font: FONT_FAMILY,
                size: 17,
                color: COLOR_SLATE,
              }),
            ],
          })
        );
      }
    } else {
      treatmentParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Última aplicación de toxina: ',
              font: FONT_FAMILY,
              size: 18,
              bold: true,
              color: COLOR_NAVY,
            }),
            new TextRun({
              text: 'Sin aplicaciones previas registradas.',
              font: FONT_FAMILY,
              size: 18,
              italics: true,
              color: COLOR_MUTED,
            }),
          ],
        })
      );
    }

    blocks.push(
      new Paragraph({ spacing: { before: 80, after: 0 } }),
      ...treatmentParagraphs
    );
  }

  // Optional: Clinical summary, medications, general patient notes, active GAS goals
  if (options.includeClinicalAlerts) {
    const extraParagraphs: Paragraph[] = [];

    if (patient?.medical_summary?.trim()) {
      extraParagraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: 'Resumen médico: ',
              font: FONT_FAMILY,
              size: 18,
              bold: true,
              color: COLOR_NAVY,
            }),
            new TextRun({
              text: patient.medical_summary.trim(),
              font: FONT_FAMILY,
              size: 18,
              color: COLOR_SLATE,
            }),
          ],
        })
      );
    }

    if (patient?.current_medications?.trim()) {
      extraParagraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: 'Medicamentos actuales: ',
              font: FONT_FAMILY,
              size: 18,
              bold: true,
              color: COLOR_NAVY,
            }),
            new TextRun({
              text: patient.current_medications.trim(),
              font: FONT_FAMILY,
              size: 18,
              color: COLOR_SLATE,
            }),
          ],
        })
      );
    }

    if (patient?.notes?.trim()) {
      extraParagraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: 'Notas del expediente: ',
              font: FONT_FAMILY,
              size: 18,
              bold: true,
              color: COLOR_NAVY,
            }),
            new TextRun({
              text: patient.notes.trim(),
              font: FONT_FAMILY,
              size: 18,
              italics: true,
              color: COLOR_SLATE,
            }),
          ],
        })
      );
    }

    if (activeGoals.length > 0) {
      const goalsText = activeGoals
        .map((g) => {
          const score =
            g.current_score !== null && g.current_score !== undefined
              ? ` (GAS: ${g.current_score > 0 ? `+${g.current_score}` : g.current_score})`
              : '';
          return `${g.title}${score}`;
        })
        .join('  ·  ');

      extraParagraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: 'Metas GAS activas: ',
              font: FONT_FAMILY,
              size: 18,
              bold: true,
              color: COLOR_NAVY,
            }),
            new TextRun({
              text: goalsText,
              font: FONT_FAMILY,
              size: 18,
              color: COLOR_SLATE,
            }),
          ],
        })
      );
    }

    if (extraParagraphs.length > 0) {
      blocks.push(
        new Paragraph({ spacing: { before: 70, after: 0 } }),
        ...extraParagraphs
      );
    }
  }

  // Optional: Writable workspace for today's consultation
  if (options.includeWorkSpace) {
    blocks.push(
      new Paragraph({ spacing: { before: 80, after: 0 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
                borders: {
                  top: { style: BorderStyle.DASHED, color: COLOR_BORDER, size: 4 },
                  bottom: { style: BorderStyle.DASHED, color: COLOR_BORDER, size: 4 },
                  left: { style: BorderStyle.DASHED, color: COLOR_BORDER, size: 4 },
                  right: { style: BorderStyle.DASHED, color: COLOR_BORDER, size: 4 },
                },
                margins: { top: 80, bottom: 120, left: 130, right: 130 },
                children: [
                  new Paragraph({
                    spacing: { after: 120 },
                    children: [
                      new TextRun({
                        text: 'Notas de la consulta de hoy / Plan:',
                        font: FONT_FAMILY,
                        size: 17,
                        bold: true,
                        color: COLOR_MUTED,
                      }),
                    ],
                  }),
                  new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: ' ' })] }),
                  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: ' ' })] }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // Spacer between patients
  blocks.push(new Paragraph({ spacing: { before: 140, after: 140 } }));

  return blocks;
}

export async function generateDailyNotesDocxBlob(
  report: DailyBriefingReport,
  options: DailyNotesExportOptions
): Promise<Blob> {
  const formattedDay = formatLongSpanishDate(report.targetDate);
  const generatedStamp = report.generatedAt.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const doctorMetaParts: string[] = [];
  if (report.doctor.fullName) doctorMetaParts.push(report.doctor.fullName);
  if (report.doctor.specialty) doctorMetaParts.push(report.doctor.specialty);
  if (report.doctor.specialistLicense) {
    doctorMetaParts.push(`Céd. Esp. ${report.doctor.specialistLicense}`);
  } else if (report.doctor.generalLicense) {
    doctorMetaParts.push(`Céd. Prof. ${report.doctor.generalLicense}`);
  }
  if (report.doctor.clinicName) doctorMetaParts.push(report.doctor.clinicName);

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'SONOTOX · HOJA CLÍNICA DE CONSULTA',
          font: FONT_FAMILY,
          size: 18,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `Agenda y Últimas Notas: ${formattedDay}`,
          font: FONT_FAMILY,
          size: 32,
          bold: true,
          color: COLOR_NAVY,
        }),
      ],
    }),
  ];

  if (doctorMetaParts.length > 0) {
    children.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: doctorMetaParts.join('  ·  '),
            font: FONT_FAMILY,
            size: 19,
            color: COLOR_SLATE,
          }),
        ],
      })
    );
  } else {
    children.push(new Paragraph({ spacing: { after: 100 } }));
  }

  children.push(buildSummaryKpiTable(report));
  children.push(new Paragraph({ spacing: { before: 180, after: 80 } }));

  if (report.items.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({
            text: 'No hay pacientes agendados para esta fecha.',
            font: FONT_FAMILY,
            size: 22,
            italics: true,
            color: COLOR_MUTED,
          }),
        ],
      })
    );
  } else {
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 100 },
        children: [
          new TextRun({
            text: '1. Lista de pacientes del día',
            font: FONT_FAMILY,
            size: 24,
            bold: true,
            color: COLOR_NAVY,
          }),
        ],
      }),
      buildOverviewChecklistTable(report.items),
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: '2. Detalle clínico y última nota por paciente',
            font: FONT_FAMILY,
            size: 24,
            bold: true,
            color: COLOR_NAVY,
          }),
        ],
      })
    );

    report.items.forEach((item, index) => {
      children.push(...buildPatientDetailBlocks(item, index, report.targetDate, options));
    });
  }

  const doc = new Document({
    creator: report.doctor.fullName || 'SONOTOX',
    title: `Agenda y Últimas Notas - ${formattedDay}`,
    description: 'Lista de pacientes agendados del día con su última nota clínica y antecedentes.',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.65),
              right: convertInchesToTwip(0.65),
              bottom: convertInchesToTwip(0.65),
              left: convertInchesToTwip(0.65),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: {
                  bottom: { style: BorderStyle.SINGLE, color: COLOR_BORDER, size: 4 },
                },
                spacing: { after: 100 },
                children: [
                  new TextRun({
                    text: `SONOTOX  ·  Agenda del día: ${formattedDay}`,
                    font: FONT_FAMILY,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: {
                  top: { style: BorderStyle.SINGLE, color: COLOR_BORDER, size: 4 },
                },
                spacing: { before: 80 },
                children: [
                  new TextRun({
                    text: `Información clínica confidencial  ·  Generado ${generatedStamp}  ·  Página `,
                    font: FONT_FAMILY,
                    size: 15,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_FAMILY,
                    size: 15,
                    bold: true,
                    color: COLOR_SLATE,
                  }),
                  new TextRun({
                    text: ' de ',
                    font: FONT_FAMILY,
                    size: 15,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: FONT_FAMILY,
                    size: 15,
                    bold: true,
                    color: COLOR_SLATE,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function downloadDailyNotesDocx(
  report: DailyBriefingReport,
  options: DailyNotesExportOptions
): Promise<string> {
  const blob = await generateDailyNotesDocxBlob(report, options);
  const fileName = `Agenda_Notas_${formatFileDate(report.targetDate)}.docx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}
