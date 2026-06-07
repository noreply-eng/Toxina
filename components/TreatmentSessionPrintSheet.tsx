import React from 'react';
import type { PrintPreferences } from '../hooks/usePrintPreferences';
import {
  getMuscleGuideSections,
  getVolumeMl,
  sortTreatmentDetails,
  type TreatmentReportData,
} from '../utils/treatmentReport';

interface TreatmentSessionPrintSheetProps {
  report: TreatmentReportData;
  preferences: PrintPreferences;
}

const TreatmentSessionPrintSheet: React.FC<TreatmentSessionPrintSheetProps> = ({
  report,
  preferences,
}) => {
  const sortedDetails = sortTreatmentDetails(report.details);
  const totalVolume = getVolumeMl(report.totalUnits, report.productName, report.dilution);
  const guides = getMuscleGuideSections(report.details, preferences);

  return (
    <div id="treatment-print-root" className="treatment-print-sheet" aria-hidden="true">
      <header className="tps-header">
        <div>
          <h1>Reporte de Aplicación de Toxina</h1>
          <p className="tps-subtitle">Sesión archivada — Toxina DLM</p>
        </div>
        <div className="tps-header-meta">
          {preferences.includeDate && (
            <p className="tps-date">
              {new Date(report.sessionDate).toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
          {report.treatmentId && <p className="tps-ref">Ref: {report.treatmentId.slice(0, 8)}</p>}
        </div>
      </header>

      <section className="tps-info-grid">
        <div>
          <p className="tps-label">Paciente</p>
          <p className="tps-value">{report.patientName}</p>
          {preferences.showPatientAge && (report.patientAge || report.patientWeight) && (
            <p className="tps-meta">
              {report.patientAge ? `Edad: ${report.patientAge} años` : ''}
              {report.patientAge && report.patientWeight ? ' · ' : ''}
              {report.patientWeight ? `Peso: ${report.patientWeight} kg` : ''}
            </p>
          )}
        </div>
        <div>
          <p className="tps-label">Producto</p>
          {preferences.showProductBrand && <p className="tps-value">{report.productName}</p>}
          <p className="tps-meta">
            {preferences.showDilution && report.dilution ? `Dilución: ${report.dilution} ml` : ''}
            {preferences.showDilution && report.dilution && report.pathologyTitle ? ' · ' : ''}
            {report.pathologyTitle ? `Patología: ${report.pathologyTitle}` : ''}
          </p>
        </div>
      </section>

      {report.clinicalSummary && preferences.includeNotes && (
        <section className="tps-box">
          <p className="tps-label">Resumen clínico</p>
          <p className="tps-text">{report.clinicalSummary}</p>
        </section>
      )}

      {report.notes && preferences.includeNotes && (
        <section className="tps-box">
          <p className="tps-label">Notas</p>
          <p className="tps-text">{report.notes}</p>
        </section>
      )}

      <table className="tps-table">
        <thead>
          <tr>
            <th>Músculo</th>
            <th>Lado</th>
            <th className="tps-num">Dosis (U)</th>
            <th className="tps-num">Vol. (ml)</th>
            <th className="tps-num">%</th>
          </tr>
        </thead>
        <tbody>
          {sortedDetails.map((d, idx) => (
            <tr key={idx}>
              <td className="tps-muscle">{d.muscle_name}</td>
              <td>{d.side}</td>
              <td className="tps-num">{d.units} U</td>
              <td className="tps-num">{getVolumeMl(d.units, report.productName, report.dilution)}</td>
              <td className="tps-num">
                {report.totalUnits > 0 ? ((d.units / report.totalUnits) * 100).toFixed(1) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="tps-total-label">
              Total aplicado
            </td>
            <td className="tps-num tps-total">{report.totalUnits} U</td>
            <td className="tps-num tps-total">{totalVolume}</td>
            <td className="tps-num tps-total">100%</td>
          </tr>
        </tfoot>
      </table>

      {guides.motorPoints.length > 0 && (
        <section className="tps-guide">
          <h2>Guía de Puntos Motores</h2>
          {guides.motorPoints.map(({ muscle, text }) => (
            <p key={muscle}>
              <strong>{muscle}:</strong> {text}
            </p>
          ))}
        </section>
      )}

      {guides.usgGuide.length > 0 && (
        <section className="tps-guide">
          <h2>Guía Ecográfica (USG)</h2>
          {guides.usgGuide.map(({ muscle, text }) => (
            <p key={muscle}>
              <strong>{muscle}:</strong> {text}
            </p>
          ))}
        </section>
      )}

      <footer className="tps-footer">
        <p className="tps-disclaimer">
          Documento reimpreso desde el historial clínico. El médico tratante es responsable de la
          aplicación final.
        </p>
        {preferences.includeDoctorSignature && (
          <div className="tps-signature">
            <div className="tps-signature-line" />
            <p>{report.doctorName || '________________'}</p>
            <p className="tps-signature-caption">Firma y Sello</p>
          </div>
        )}
      </footer>
    </div>
  );
};

export default TreatmentSessionPrintSheet;
