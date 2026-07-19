import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getPathologyById,
  getPathologyPatterns,
  getPathologyProtocolVariants,
  getPathologySafety,
  resolveProtocolSuggestedDose,
  type PathologyProtocol,
  type ProtocolVariant,
  type ToxinBrand,
} from '../data/pathologyData';
import { findMuscleForCalculatorName } from '../data/muscleData';
import { addRecentPathology } from '../utils/pathologyPrefs';
import FacialPlannerModal from '../components/facial/FacialPlannerModal';

const BRANDS: ToxinBrand[] = ['Botox', 'Dysport', 'Xeomin'];

// Límites de dosis total por sesión y marca (referencia para el contador)
const BRAND_SESSION_CAP: Record<ToxinBrand, number> = {
  Botox: 400,
  Xeomin: 400,
  Dysport: 1500,
};

const PathologyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [referencesExpanded, setReferencesExpanded] = useState(false);
  const [safetyExpanded, setSafetyExpanded] = useState(false);
  const [facialPlannerOpen, setFacialPlannerOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const pathology = getPathologyById(id || '');

  const variants = useMemo(
    () => (pathology ? getPathologyProtocolVariants(pathology.id) : []),
    [pathology]
  );
  const patterns = useMemo(
    () => (pathology ? getPathologyPatterns(pathology.id) : []),
    [pathology]
  );
  const [selectedVariant, setSelectedVariant] = useState<ProtocolVariant>('A');
  const [selectedPattern, setSelectedPattern] = useState<string>('all');

  useEffect(() => {
    if (pathology) addRecentPathology(pathology.id);
  }, [pathology]);

  const visibleProtocols = useMemo(() => {
    if (!pathology) return [];
    if (patterns.length > 0) {
      if (selectedPattern === 'all') return pathology.protocols;
      return pathology.protocols.filter((p) => p.pattern === selectedPattern);
    }
    if (variants.length === 0) return pathology.protocols;
    return pathology.protocols.filter(
      (p) => (p.protocolVariant || 'A') === selectedVariant
    );
  }, [pathology, patterns, selectedPattern, variants, selectedVariant]);

  // Suma de dosis sugeridas por marca sobre los protocolos visibles (contador de sesión)
  const brandTotals = useMemo(() => {
    const totals: Record<ToxinBrand, number> = { Botox: 0, Dysport: 0, Xeomin: 0 };
    visibleProtocols.forEach((p) => {
      BRANDS.forEach((brand) => {
        const dose = resolveProtocolSuggestedDose(p, brand).customDose;
        totals[brand] += (dose || 0) * (p.bilateral ? 2 : 1);
      });
    });
    return totals;
  }, [visibleProtocols]);

  const safety = useMemo(
    () => (pathology ? getPathologySafety(pathology.id) : null),
    [pathology]
  );

  const handleShare = async () => {
    if (!pathology) return;
    const lines: string[] = [];
    lines.push(`PROTOCOLO — ${pathology.title}`);
    lines.push(pathology.subtitle);
    lines.push(`Toxina sugerida: ${pathology.suggestedToxin}`);
    if (patterns.length > 0 && selectedPattern !== 'all') {
      const pat = patterns.find((p) => p.id === selectedPattern);
      if (pat) lines.push(`Patrón: ${pat.name}`);
    }
    if (variants.length > 1) lines.push(`Protocolo: ${selectedVariant}`);
    lines.push('');
    lines.push('MÚSCULOS:');
    visibleProtocols.forEach((p) => {
      lines.push(`• ${p.muscle || p.muscleName}: ${p.dose}${p.bilateral ? ' (bilateral)' : ''}`);
    });
    lines.push('');
    lines.push(`Total estimado — Botox: ${brandTotals.Botox} U · Dysport: ${brandTotals.Dysport} U · Xeomin: ${brandTotals.Xeomin} U`);
    if (pathology.maxDose) lines.push(`Dosis máxima: ${pathology.maxDose}`);
    const text = lines.join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: pathology.title, text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareMsg('Protocolo copiado al portapapeles');
        setTimeout(() => setShareMsg(null), 2500);
      }
    } catch {
      /* usuario canceló el diálogo de compartir */
    }
  };

  /** Enlace a la ficha de punto motor / USG del músculo, si existe. */
  const muscleLinkId = (protocol: PathologyProtocol): string | null => {
    const match = findMuscleForCalculatorName(protocol.muscleName || protocol.muscle || '');
    return match?.id ?? null;
  };

  if (!pathology) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-4">
        <span className="material-symbols-outlined text-6xl text-text-muted mb-4">error</span>
        <h2 className="text-xl font-bold text-text-main dark:text-white mb-2">Patología no encontrada</h2>
        <button 
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-6 py-2 bg-primary text-white rounded-lg"
        >
          Volver al Dashboard
        </button>
      </div>
    );
  }

  const categoryColors = {
    neurological: 'bg-blue-500',
    autonomic: 'bg-green-500',
    urological: 'bg-purple-500',
    aesthetic: 'bg-pink-500',
  };

  const categoryLabels = {
    neurological: 'Neurológica',
    autonomic: 'Autonómica',
    urological: 'Urológica',
    aesthetic: 'Estética',
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)} 
          className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold leading-tight flex-1 text-center text-text-main dark:text-white truncate px-2">
          {pathology.title}
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors print:hidden"
            title="Compartir / copiar protocolo"
          >
            <span className="material-symbols-outlined">share</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors print:hidden"
            title="Imprimir / Guardar PDF"
          >
            <span className="material-symbols-outlined">print</span>
          </button>
        </div>
      </header>
      {shareMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
          {shareMsg}
        </div>
      )}

      {/* Hero Image */}
      <div className="relative w-full h-48 overflow-hidden">
        <img 
          src={pathology.image} 
          alt={pathology.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent" />
      </div>

      {/* Content */}
      <div className="px-4 -mt-6 relative z-10">
        {/* Category Badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`${categoryColors[pathology.category]} text-white text-xs font-bold px-3 py-1 rounded-full`}>
            {categoryLabels[pathology.category]}
          </span>
          <span className="text-text-muted dark:text-slate-400 text-sm">{pathology.subtitle}</span>
        </div>

        {/* Description */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 mb-4">
          <h2 className="text-base font-bold text-text-main dark:text-white mb-3">Descripción</h2>
          <p className="text-sm text-text-muted dark:text-slate-300 leading-relaxed">
            {pathology.description}
          </p>
        </div>

        {/* Toxina sugerida y conversión entre marcas */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-start gap-3">
            <div className="size-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">medication</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-text-muted dark:text-slate-400 uppercase mb-0.5">Toxina sugerida</p>
              <p className="text-sm font-semibold text-text-main dark:text-white">{pathology.suggestedToxin}</p>
            </div>
          </div>
          {pathology.conversionNotes && (
            <div className="mt-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 p-3 flex gap-2">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-base mt-0.5">swap_horiz</span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase mb-0.5">Conversión entre marcas</p>
                <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">{pathology.conversionNotes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Línea de tiempo de acción */}
        {pathology.timeline && (pathology.timeline.onset || pathology.timeline.peak || pathology.timeline.duration) && (
          <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 mb-4">
            <h2 className="text-base font-bold text-text-main dark:text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">timeline</span>
              Línea de Tiempo
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { icon: 'bolt', label: 'Inicio', value: pathology.timeline.onset },
                { icon: 'trending_up', label: 'Efecto máximo', value: pathology.timeline.peak },
                { icon: 'hourglass_bottom', label: 'Duración', value: pathology.timeline.duration },
                { icon: 'event_repeat', label: 'Re-tratamiento', value: pathology.frequency },
              ].filter((s) => s.value).map((s) => (
                <div key={s.label} className="rounded-xl bg-background-light dark:bg-slate-800/50 p-3 text-center">
                  <span className="material-symbols-outlined text-primary text-lg">{s.icon}</span>
                  <p className="text-[10px] font-bold text-text-muted dark:text-slate-400 uppercase mt-1">{s.label}</p>
                  <p className="text-xs font-bold text-text-main dark:text-white mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dosage Protocol */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-base font-bold text-text-main dark:text-white">Protocolo de Dosificación</h2>
            {variants.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                {variants.map((v) => (
                  <button
                    key={v}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                      selectedVariant === v
                        ? 'bg-white dark:bg-slate-700 shadow-sm text-primary'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selector de patrón (espasticidad) */}
          {patterns.length > 0 && (
            <div className="mb-4">
              <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
                <button
                  onClick={() => setSelectedPattern('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedPattern === 'all'
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Todos
                </button>
                {patterns.map((pat) => (
                  <button
                    key={pat.id}
                    onClick={() => setSelectedPattern(pat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedPattern === pat.id
                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {pat.name}
                  </button>
                ))}
              </div>
              {selectedPattern !== 'all' && (
                <p className="text-[11px] text-text-muted dark:text-slate-400 mt-2">
                  {patterns.find((p) => p.id === selectedPattern)?.description}
                </p>
              )}
            </div>
          )}

          {variants.length > 1 && (
            <p className="text-[11px] text-text-muted dark:text-slate-400 mb-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">info</span>
              Mostrando músculos del Protocolo {selectedVariant}. La calculadora cargará esta variante.
            </p>
          )}

          {/* Contador de dosis / resumen */}
          <div className="rounded-xl bg-background-light dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-text-muted dark:text-slate-400 uppercase">
                Resumen · {visibleProtocols.length} músculo{visibleProtocols.length === 1 ? '' : 's'}
              </p>
              {patterns.length > 0 && (
                <span className="text-[10px] text-text-muted dark:text-slate-500">Total por sesión (estimado)</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {BRANDS.map((brand) => {
                const total = brandTotals[brand];
                const cap = BRAND_SESSION_CAP[brand];
                const over = total > cap;
                return (
                  <div key={brand} className="rounded-lg bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 px-2 py-1.5 text-center">
                    <p className="text-[9px] font-bold text-text-muted dark:text-slate-400 uppercase">{brand}</p>
                    <p className={`text-sm font-black ${over ? 'text-red-500' : 'text-text-main dark:text-white'}`}>
                      {total} U
                    </p>
                    <p className={`text-[8px] font-medium ${over ? 'text-red-500' : 'text-text-muted dark:text-slate-500'}`}>
                      máx {cap} U
                    </p>
                  </div>
                );
              })}
            </div>
            {(brandTotals.Botox > BRAND_SESSION_CAP.Botox || brandTotals.Dysport > BRAND_SESSION_CAP.Dysport) && (
              <p className="text-[10px] text-red-500 font-semibold mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">warning</span>
                La suma supera el máximo por sesión; priorice patrones o fraccione en sesiones.
              </p>
            )}
          </div>

          <div className="space-y-3">
            {visibleProtocols.map((protocol, idx) => {
              const brandDoses = BRANDS.map((brand) => ({
                brand,
                value: resolveProtocolSuggestedDose(protocol, brand).customDose,
              }));
              const linkId = muscleLinkId(protocol);
              const patternName =
                patterns.length > 0 && selectedPattern === 'all' && protocol.pattern
                  ? patterns.find((p) => p.id === protocol.pattern)?.name
                  : null;
              return (
                <div
                  key={idx}
                  className="bg-background-light dark:bg-slate-800/50 rounded-lg p-3 border-l-4 border-primary"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    {protocol.muscle && (
                      <p className="font-bold text-sm text-text-main dark:text-white">
                        {protocol.muscle}
                      </p>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {patternName && (
                        <span className="inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {patternName}
                        </span>
                      )}
                      {protocol.bilateral && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          <span className="material-symbols-outlined text-[13px]">flip</span>
                          Bilateral
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-primary font-semibold mb-2">{protocol.dose}</p>

                  {/* Dosis sugerida por marca */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {brandDoses.map(({ brand, value }) => (
                      <div
                        key={brand}
                        className="rounded-md bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 px-2 py-1.5 text-center"
                      >
                        <p className="text-[9px] font-bold text-text-muted dark:text-slate-400 uppercase">{brand}</p>
                        <p className="text-xs font-bold text-text-main dark:text-white">
                          {value > 0 ? `${value} U` : '—'}
                        </p>
                      </div>
                    ))}
                  </div>

                  {protocol.notes && (
                    <p className="text-xs text-text-muted dark:text-slate-400 italic mb-2">
                      {protocol.notes}
                    </p>
                  )}

                  {linkId && (
                    <button
                      onClick={() => navigate(`/motor-points/${linkId}`)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline print:hidden"
                    >
                      <span className="material-symbols-outlined text-[15px]">ultrasound</span>
                      Ver punto motor / USG
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-text-muted dark:text-slate-500 mt-3">
            Dosis por marca estimadas a partir del protocolo de referencia (unidades Ona/Xeomin ≈ 1:1; Dysport ≈ 2.5:1). Verifique siempre según la ficha técnica.
          </p>
        </div>

        {/* Additional Info */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 mb-4">
          <h2 className="text-base font-bold text-text-main dark:text-white mb-3">Información Adicional</h2>
          
          {pathology.frequency && (
            <div className="mb-3">
              <p className="text-xs font-bold text-text-muted dark:text-slate-400 uppercase mb-1">Frecuencia</p>
              <p className="text-sm text-text-main dark:text-white">{pathology.frequency}</p>
            </div>
          )}

          {pathology.maxDose && (
            <div className="mb-3">
              <p className="text-xs font-bold text-text-muted dark:text-slate-400 uppercase mb-1">Dosis Máxima</p>
              <p className="text-sm text-text-main dark:text-white">{pathology.maxDose}</p>
            </div>
          )}

          {pathology.additionalInfo && pathology.additionalInfo.length > 0 && (
            <div>
              <p className="text-xs font-bold text-text-muted dark:text-slate-400 uppercase mb-2">Notas Clínicas</p>
              <ul className="space-y-1">
                {pathology.additionalInfo.map((info, idx) => (
                  <li key={idx} className="text-sm text-text-main dark:text-white flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                    <span className="flex-1">{info}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Seguridad clínica: contraindicaciones y efectos adversos */}
        {safety && (
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-4 overflow-hidden">
            <button
              onClick={() => setSafetyExpanded(!safetyExpanded)}
              className="w-full flex items-center justify-between p-5"
            >
              <h2 className="text-base font-bold text-text-main dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">health_and_safety</span>
                Seguridad Clínica
              </h2>
              <span className="material-symbols-outlined text-text-muted">
                {safetyExpanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {safetyExpanded && (
              <div className="px-5 pb-5 space-y-4">
                {/* Contraindicaciones */}
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4">
                  <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">block</span>
                    Contraindicaciones
                  </p>
                  <ul className="space-y-1.5">
                    {safety.contraindications.map((item, idx) => (
                      <li key={idx} className="text-xs text-red-800 dark:text-red-200 flex items-start gap-2 leading-relaxed">
                        <span className="size-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <span className="flex-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Efectos adversos */}
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-4">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">warning</span>
                    Efectos adversos frecuentes
                  </p>
                  <ul className="space-y-1.5">
                    {safety.adverseEffects.map((item, idx) => (
                      <li key={idx} className="text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2 leading-relaxed">
                        <span className="size-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span className="flex-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* References */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
          <button
            onClick={() => setReferencesExpanded(!referencesExpanded)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-base font-bold text-text-main dark:text-white">
              Referencias Bibliográficas ({pathology.references.length})
            </h2>
            <span className="material-symbols-outlined text-text-muted">
              {referencesExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {referencesExpanded && (
            <div className="mt-4 space-y-3">
              {pathology.references.map((ref, idx) => {
                // Regex to find URLs
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const parts = ref.split(urlRegex);

                return (
                  <div key={idx} className="text-xs text-text-muted dark:text-slate-300 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-primary mr-1">[{idx + 1}]</span>
                    {parts.map((part, i) => {
                      if (part.match(urlRegex)) {
                        return (
                          <a 
                            key={i} 
                            href={part} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all"
                            onClick={(e) => e.stopPropagation()} 
                          >
                            {part}
                          </a>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB - Calculadora / Planificador facial */}
      <div className="fixed bottom-24 right-6 flex flex-col gap-3 items-end z-30 print:hidden">
        {(pathology.id === 'estetica-facial' || pathology.id === 'sincinesias-faciales') && (
          <button
            onClick={() => setFacialPlannerOpen(true)}
            className="bg-pink-600 hover:bg-pink-500 text-white rounded-full px-4 h-12 flex items-center gap-2 shadow-lg active:scale-95 transition-transform"
            title="Planificador facial estético"
          >
            <span className="material-symbols-outlined text-xl">face</span>
            <span className="text-xs font-bold hidden sm:inline">Plan facial</span>
          </button>
        )}
        <button
          onClick={() =>
            navigate('/calculator', {
              state: {
                pathologyId: pathology.id,
                autoLoadTemplate: true,
                protocolVariant: variants.length > 1 ? selectedVariant : 'A',
                patternId: patterns.length > 0 && selectedPattern !== 'all' ? selectedPattern : undefined,
                defaultBrand: 'Botox',
              },
            })
          }
          className="bg-primary text-white rounded-full size-14 flex items-center justify-center shadow-lg active:scale-95 transition-transform print:hidden"
          title="Abrir calculadora"
        >
          <span className="material-symbols-outlined text-2xl">calculate</span>
        </button>
      </div>

      <FacialPlannerModal
        isOpen={facialPlannerOpen}
        onClose={() => setFacialPlannerOpen(false)}
        mode={pathology.id === 'sincinesias-faciales' ? 'asymmetric' : 'aesthetic'}
        pathologyId={pathology.id}
        loadPresetOnOpen
      />
    </div>
  );
};

export default PathologyDetail;
