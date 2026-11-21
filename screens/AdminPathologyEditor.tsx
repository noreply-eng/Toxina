import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dosisData } from '../constants/toxinData';
import { findMuscleForCalculatorName, musclesData } from '../data/muscleData';
import {
  GENERAL_BONT_ADVERSE_EFFECTS,
  GENERAL_BONT_CONTRAINDICATIONS,
  getDefaultPathologyById,
  resolveProtocolAutoSuggestedDose,
  resolveProtocolSuggestedDose,
  type PathologyData,
  type PathologyProtocol,
  type ProtocolVariant,
  type SpasticityPattern,
  type ToxinBrand,
} from '../data/pathologyData';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { usePathology } from '../hooks/usePathologies';
import {
  resetPathologyProtocol,
  savePathologyProtocol,
  uploadPathologyCoverImage,
} from '../services/pathologyProtocols';
import { getAuthUser } from '../utils/auth';

const BRANDS: ToxinBrand[] = ['Botox', 'Dysport', 'Xeomin'];
const BRAND_SESSION_CAP: Record<ToxinBrand, number> = {
  Botox: 400,
  Xeomin: 400,
  Dysport: 1500,
};

const CATEGORIES: { id: PathologyData['category']; label: string }[] = [
  { id: 'neurological', label: 'Neurológica' },
  { id: 'autonomic', label: 'Autonómica' },
  { id: 'urological', label: 'Urológica' },
  { id: 'aesthetic', label: 'Estética' },
];

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DEFAULT_COVER_IMAGE = `${
  import.meta.env.VITE_SUPABASE_URL || 'https://qwhrdmllpznvqrxygytp.supabase.co'
}/storage/v1/object/public/PortadasPatologias/espasticidad.jpeg`;

const AdminPathologyEditor: React.FC = () => {
  const navigate = useNavigate();
  const { pathologyId } = useParams<{ pathologyId: string }>();
  const isNewMode = pathologyId === 'new';

  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { pathology: existingPathology, isCustomized, isBuiltIn } = usePathology(
    isNewMode ? undefined : pathologyId
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [slugDraft, setSlugDraft] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<PathologyData['category']>('neurological');
  const [description, setDescription] = useState('');
  const [suggestedToxin, setSuggestedToxin] = useState('Botox, Xeomin o Dysport');
  const [conversionNotes, setConversionNotes] = useState('');
  const [frequency, setFrequency] = useState('');
  const [maxDose, setMaxDose] = useState('');
  const [onset, setOnset] = useState('');
  const [peak, setPeak] = useState('');
  const [duration, setDuration] = useState('');
  const [image, setImage] = useState(DEFAULT_COVER_IMAGE);

  const [patterns, setPatterns] = useState<SpasticityPattern[]>([]);
  const [protocols, setProtocols] = useState<PathologyProtocol[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState<string[]>([]);
  const [contraindications, setContraindications] = useState<string[]>([]);
  const [adverseEffects, setAdverseEffects] = useState<string[]>([]);
  const [references, setReferences] = useState<string[]>([]);

  // Filter / preview states inside protocol editor
  const [protocolSearch, setProtocolSearch] = useState('');
  const [previewVariant, setPreviewVariant] = useState<ProtocolVariant | 'ALL'>('ALL');
  const [previewPattern, setPreviewPattern] = useState<string>('all');

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Available calculator muscles (union of dosisData keys and musclesData)
  const calculatorMuscleOptions = useMemo(() => {
    const keys = new Set<string>();
    Object.keys(dosisData.Botox || {}).forEach((k) => keys.add(k));
    Object.keys(dosisData.Dysport || {}).forEach((k) => keys.add(k));
    Object.keys(dosisData.Xeomin || {}).forEach((k) => keys.add(k));

    return Array.from(keys)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
      .map((key) => {
        const match = findMuscleForCalculatorName(key);
        const botoxRange = dosisData.Botox?.[key];
        return {
          key,
          spanishName: match?.name || key,
          hasAtlas: Boolean(match),
          botoxRange: botoxRange ? `${botoxRange.min}-${botoxRange.max} U` : null,
        };
      });
  }, []);

  // Load initial data
  useEffect(() => {
    if (isNewMode) {
      setSlugDraft('');
      setTitle('');
      setSubtitle('');
      setCategory('neurological');
      setDescription('');
      setSuggestedToxin('Botox, Xeomin o Dysport');
      setConversionNotes('Botox:Xeomin ratio 1:1. Dysport ratio aproximado 2.5:1.');
      setFrequency('Cada 12 semanas');
      setMaxDose('400 U (Botox/Xeomin) / 1000 U (Dysport)');
      setOnset('3-7 días');
      setPeak('2-4 semanas');
      setDuration('12 semanas');
      setImage(DEFAULT_COVER_IMAGE);
      setPatterns([]);
      setProtocols([
        {
          muscle: '',
          muscleName: '',
          dose: '50 U',
          bilateral: false,
          notes: '',
        },
      ]);
      setAdditionalInfo([]);
      setContraindications([]);
      setAdverseEffects([...GENERAL_BONT_ADVERSE_EFFECTS]);
      setReferences([]);
      return;
    }

    if (!existingPathology) return;
    const baseDefault = getDefaultPathologyById(existingPathology.id);

    setSlugDraft(existingPathology.id);
    setTitle(existingPathology.title);
    setSubtitle(existingPathology.subtitle);
    setCategory(existingPathology.category);
    setDescription(existingPathology.description);
    setSuggestedToxin(existingPathology.suggestedToxin);
    setConversionNotes(existingPathology.conversionNotes || '');
    setFrequency(existingPathology.frequency || '');
    setMaxDose(existingPathology.maxDose || '');
    setOnset(existingPathology.timeline?.onset || '');
    setPeak(existingPathology.timeline?.peak || '');
    setDuration(existingPathology.timeline?.duration || '');
    setImage(existingPathology.image || DEFAULT_COVER_IMAGE);

    setPatterns(
      existingPathology.patterns
        ? JSON.parse(JSON.stringify(existingPathology.patterns))
        : []
    );
    setProtocols(
      existingPathology.protocols
        ? JSON.parse(JSON.stringify(existingPathology.protocols))
        : []
    );
    setAdditionalInfo([...(existingPathology.additionalInfo || [])]);
    setContraindications([
      ...(existingPathology.contraindications ?? baseDefault?.contraindications ?? []),
    ]);
    setAdverseEffects([
      ...(existingPathology.adverseEffects ??
        baseDefault?.adverseEffects ??
        GENERAL_BONT_ADVERSE_EFFECTS),
    ]);
    setReferences([...(existingPathology.references || [])]);
  }, [isNewMode, existingPathology]);

  const activeVariants = useMemo(() => {
    const set = new Set<ProtocolVariant>();
    protocols.forEach((p) => {
      if (p.protocolVariant) set.add(p.protocolVariant);
    });
    return Array.from(set).sort();
  }, [protocols]);

  // Live dose summary calculation (same rules as PathologyDetail)
  const previewProtocols = useMemo(() => {
    return protocols.filter((p) => {
      if (patterns.length > 0 && previewPattern !== 'all') {
        if (p.pattern !== previewPattern) return false;
      }
      if (activeVariants.length > 0 && previewVariant !== 'ALL') {
        if ((p.protocolVariant || 'A') !== previewVariant) return false;
      }
      return true;
    });
  }, [protocols, patterns, previewPattern, activeVariants, previewVariant]);

  const brandTotals = useMemo(() => {
    const totals: Record<ToxinBrand, number> = { Botox: 0, Dysport: 0, Xeomin: 0 };
    previewProtocols.forEach((p) => {
      BRANDS.forEach((brand) => {
        const dose = resolveProtocolSuggestedDose(p, brand).customDose;
        totals[brand] += (dose || 0) * (p.bilateral ? 2 : 1);
      });
    });
    return totals;
  }, [previewProtocols]);

  // Protocol item helpers
  const updateProtocolItem = (index: number, patch: Partial<PathologyProtocol>) => {
    setProtocols((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  const updateProtocolBrandDose = (
    index: number,
    brand: ToxinBrand,
    rawVal: string
  ) => {
    setProtocols((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const nextBrandDoses = { ...(item.brandDoses || {}) };
        if (rawVal.trim() === '') {
          delete nextBrandDoses[brand];
        } else {
          const parsed = Number(rawVal);
          if (!Number.isNaN(parsed) && parsed >= 0) {
            nextBrandDoses[brand] = parsed;
          }
        }
        return {
          ...item,
          brandDoses:
            Object.keys(nextBrandDoses).length > 0 ? nextBrandDoses : undefined,
        };
      })
    );
  };

  const handleAddProtocolMuscle = () => {
    const defaultPattern =
      patterns.length > 0 && previewPattern !== 'all'
        ? previewPattern
        : patterns[0]?.id;
    const defaultVariant =
      activeVariants.length > 0 && previewVariant !== 'ALL'
        ? previewVariant
        : undefined;

    setProtocols((prev) => [
      ...prev,
      {
        muscle: '',
        muscleName: '',
        dose: '50 U',
        bilateral: false,
        notes: '',
        ...(defaultPattern ? { pattern: defaultPattern } : {}),
        ...(defaultVariant ? { protocolVariant: defaultVariant } : {}),
      },
    ]);
  };

  const handleDuplicateProtocolMuscle = (index: number) => {
    setProtocols((prev) => {
      const copy = JSON.parse(JSON.stringify(prev[index])) as PathologyProtocol;
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const handleMoveProtocolMuscle = (index: number, dir: -1 | 1) => {
    setProtocols((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleRemoveProtocolMuscle = (index: number) => {
    setProtocols((prev) => prev.filter((_, i) => i !== index));
  };

  // Pattern helpers
  const handleAddPattern = () => {
    const idx = patterns.length + 1;
    setPatterns((prev) => [
      ...prev,
      {
        id: `patron-${idx}`,
        name: `Patrón ${idx}`,
        description: '',
      },
    ]);
  };

  const handleUpdatePattern = (index: number, patch: Partial<SpasticityPattern>) => {
    setPatterns((prev) => {
      const oldId = prev[index]?.id;
      const next = prev.map((pat, i) => (i === index ? { ...pat, ...patch } : pat));
      const newId = next[index]?.id;
      if (oldId && newId && oldId !== newId) {
        setProtocols((curr) =>
          curr.map((pr) => (pr.pattern === oldId ? { ...pr, pattern: newId } : pr))
        );
      }
      return next;
    });
  };

  const handleRemovePattern = (index: number) => {
    const removedId = patterns[index]?.id;
    setPatterns((prev) => prev.filter((_, i) => i !== index));
    if (removedId) {
      setProtocols((prev) =>
        prev.map((pr) =>
          pr.pattern === removedId ? { ...pr, pattern: undefined } : pr
        )
      );
    }
  };

  const handleUploadCover = async (file: File) => {
    setUploadingImage(true);
    setError(null);
    setSuccess(null);
    try {
      const targetId = isNewMode ? slugify(title || 'nueva-patologia') : pathologyId!;
      const url = await uploadPathologyCoverImage(file, targetId);
      setImage(url);
      setSuccess('Imagen de portada subida. Recuerda guardar el protocolo.');
    } catch (err: any) {
      setError(err?.message || 'Error al subir la imagen de portada.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError('El título de la patología es obligatorio.');
      return;
    }

    const finalId = isNewMode
      ? slugify(slugDraft.trim() || title.trim())
      : pathologyId!;

    if (!finalId) {
      setError('El identificador (slug) de la patología no es válido.');
      return;
    }

    const cleanedProtocols = protocols
      .map((p) => ({
        ...p,
        muscle: (p.muscle || p.muscleName || '').trim(),
        muscleName: (p.muscleName || p.muscle || '').trim() || undefined,
        dose: (p.dose || '').trim() || '—',
        notes: p.notes?.trim() || undefined,
        pattern: patterns.length > 0 && p.pattern ? p.pattern : undefined,
        protocolVariant: p.protocolVariant || undefined,
      }))
      .filter((p) => p.muscle || p.muscleName);

    if (cleanedProtocols.length === 0) {
      setError('Agrega al menos un músculo o sitio en el Protocolo de Dosificación.');
      return;
    }

    const timelineObj =
      onset.trim() || peak.trim() || duration.trim()
        ? {
            ...(onset.trim() ? { onset: onset.trim() } : {}),
            ...(peak.trim() ? { peak: peak.trim() } : {}),
            ...(duration.trim() ? { duration: duration.trim() } : {}),
          }
        : undefined;

    const payload: PathologyData = {
      id: finalId,
      title: title.trim(),
      subtitle: subtitle.trim(),
      category,
      description: description.trim(),
      suggestedToxin: suggestedToxin.trim() || 'Botox, Xeomin o Dysport',
      conversionNotes: conversionNotes.trim() || undefined,
      protocols: cleanedProtocols,
      patterns:
        patterns.length > 0
          ? patterns
              .map((pat) => ({
                id: slugify(pat.id || pat.name) || 'patron',
                name: pat.name.trim() || pat.id,
                description: pat.description?.trim() || undefined,
                region: pat.region,
              }))
              .filter((pat) => pat.name)
          : undefined,
      frequency: frequency.trim() || undefined,
      maxDose: maxDose.trim() || undefined,
      timeline: timelineObj,
      additionalInfo: additionalInfo.map((s) => s.trim()).filter(Boolean),
      contraindications: contraindications.map((s) => s.trim()).filter(Boolean),
      adverseEffects: adverseEffects.map((s) => s.trim()).filter(Boolean),
      references: references.map((s) => s.trim()).filter(Boolean),
      image: image.trim() || DEFAULT_COVER_IMAGE,
    };

    setSaving(true);
    try {
      const user = await getAuthUser();
      const result = await savePathologyProtocol(payload, user?.id);
      if (result.syncedToCloud) {
        setSuccess('Protocolo guardado y sincronizado en la nube correctamente.');
      } else {
        setSuccess('Protocolo guardado y activo en la aplicación.');
      }
      if (isNewMode) {
        navigate(`/admin/pathologies/${finalId}`, { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Error al guardar el protocolo.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetOrDelete = async () => {
    if (!pathologyId || isNewMode) return;
    const confirmMsg = isBuiltIn
      ? '¿Restablecer esta patología a su protocolo original de fábrica? Se perderán las ediciones personalizadas.'
      : '¿Eliminar esta patología personalizada de forma permanente?';
    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await resetPathologyProtocol(pathologyId);
      if (!isBuiltIn) {
        navigate('/admin/pathologies', { replace: true });
        return;
      }
      setSuccess('Protocolo restablecido a sus valores originales.');
    } catch (err: any) {
      setError(err?.message || 'No se pudo restablecer el protocolo.');
    } finally {
      setSaving(false);
    }
  };

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  if (!isNewMode && !existingPathology) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-6 text-center">
        <span className="material-symbols-outlined text-5xl text-slate-400 mb-4">error</span>
        <h2 className="text-lg font-bold text-text-main dark:text-white mb-4">Patología no encontrada</h2>
        <button
          type="button"
          onClick={() => navigate('/admin/pathologies')}
          className="px-5 py-2 bg-primary text-white rounded-xl font-bold"
        >
          Volver a Gestión de Protocolos
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-44">
      {/* Top Header */}
      <header className="bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md px-4 py-3 sticky top-0 z-20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/admin/pathologies')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Volver al listado de protocolos"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-text-main dark:text-white truncate">
                {isNewMode ? 'Nueva Patología y Protocolo' : title || existingPathology?.title}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 uppercase shrink-0">
                Editor Admin
              </span>
              {!isNewMode && isCustomized && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">
                  Personalizado
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted truncate">
              {isNewMode
                ? 'Configura la ficha clínica y los músculos del protocolo'
                : `ID: ${pathologyId} · ${protocols.length} músculo(s) en protocolo`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isNewMode && (
            <button
              type="button"
              onClick={() => navigate(`/pathology/${pathologyId}`)}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">visibility</span>
              <span className="hidden sm:inline">Ver Ficha</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">save</span>
            <span>{saving ? 'Guardando...' : 'Guardar'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto flex-1 px-4 py-5 space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3.5 text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{success}</span>
          </div>
        )}

        {/* 1. Datos Generales e Imagen de Portada */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="material-symbols-outlined text-primary">medical_information</span>
            <h2 className="text-base font-bold text-text-main dark:text-white">
              1. Información General y Portada
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase block mb-1">
                    Título de la Patología *
                  </label>
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (isNewMode) setSlugDraft(slugify(e.target.value));
                    }}
                    placeholder="Ej. Blefaroespasmo"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-bold text-text-main dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase block mb-1">
                    Subtítulo / Indicación Clínica
                  </label>
                  <input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Ej. Espasmo del Orbicular de los Ojos"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-text-main dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase block mb-1">
                    Categoría Clínica
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PathologyData['category'])}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-bold text-text-main dark:text-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase block mb-1">
                    Identificador URL (Slug)
                  </label>
                  <input
                    value={isNewMode ? slugDraft : pathologyId || ''}
                    disabled={!isNewMode}
                    onChange={(e) => setSlugDraft(slugify(e.target.value))}
                    placeholder="ej. blefaroespasmo"
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-mono text-slate-600 dark:text-slate-400 disabled:opacity-70"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase block mb-1">
                  Descripción Clínica
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción clínica detallada de la patología y enfoque terapéutico..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-sm text-text-main dark:text-white"
                />
              </div>
            </div>

            {/* Cover Image */}
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold text-text-muted uppercase block">
                Imagen de Portada
              </label>
              <div className="relative h-36 w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700">
                {image ? (
                  <img src={image} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                    Sin imagen
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex-1 py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">upload</span>
                  {uploadingImage ? 'Subiendo...' : 'Subir Portada'}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadCover(file);
                  e.target.value = '';
                }}
              />
              <input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="URL de imagen..."
                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300"
              />
            </div>
          </div>
        </section>

        {/* 2. Toxina Sugerida, Conversión y Línea de Tiempo */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="material-symbols-outlined text-primary">timeline</span>
            <h2 className="text-base font-bold text-text-main dark:text-white">
              2. Toxina Sugerida, Conversión y Línea de Tiempo
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase block mb-1">
                Toxina Sugerida
              </label>
              <input
                value={suggestedToxin}
                onChange={(e) => setSuggestedToxin(e.target.value)}
                placeholder="Ej. Botox, Xeomin o Dysport"
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-text-main dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase block mb-1">
                Dosis Máxima por Sesión / Ciclo
              </label>
              <input
                value={maxDose}
                onChange={(e) => setMaxDose(e.target.value)}
                placeholder="Ej. 400 U (Botox/Xeomin) / 1000 U (Dysport)"
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-text-main dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-text-muted uppercase block mb-1">
                Notas de Conversión entre Marcas
              </label>
              <input
                value={conversionNotes}
                onChange={(e) => setConversionNotes(e.target.value)}
                placeholder="Ej. Botox:Xeomin ratio 1:1. Dysport ratio aproximado 2.5:1."
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-text-main dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                Inicio del Efecto
              </label>
              <input
                value={onset}
                onChange={(e) => setOnset(e.target.value)}
                placeholder="Ej. 3-4 días"
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-text-main dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                Efecto Máximo
              </label>
              <input
                value={peak}
                onChange={(e) => setPeak(e.target.value)}
                placeholder="Ej. 1-2 semanas"
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-text-main dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                Duración
              </label>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ej. 3-4 meses"
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-text-main dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                Re-tratamiento / Frecuencia
              </label>
              <input
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="Ej. Cada 3-4 meses"
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-text-main dark:text-white"
              />
            </div>
          </div>
        </section>

        {/* 3. Patrones Clínicos (Opcional, ej. Espasticidad) */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">category</span>
              <div>
                <h2 className="text-base font-bold text-text-main dark:text-white">
                  3. Patrones Clínicos / Subgrupos ({patterns.length})
                </h2>
                <p className="text-[11px] text-text-muted">
                  Opcional. Útil cuando la patología se divide en patrones (ej. Codo flexionado, Pie equinovaro).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddPattern}
              className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Agregar Patrón
            </button>
          </div>

          {patterns.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              Esta patología no utiliza agrupación por patrones (usa protocolo directo o variantes A/B/C).
            </p>
          ) : (
            <div className="space-y-2.5">
              {patterns.map((pat, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700"
                >
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold text-text-muted uppercase block mb-0.5">
                      ID Patrón
                    </label>
                    <input
                      value={pat.id}
                      onChange={(e) =>
                        handleUpdatePattern(idx, { id: slugify(e.target.value) })
                      }
                      placeholder="ej. codo-flexionado"
                      className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="text-[10px] font-bold text-text-muted uppercase block mb-0.5">
                      Nombre del Patrón
                    </label>
                    <input
                      value={pat.name}
                      onChange={(e) => handleUpdatePattern(idx, { name: e.target.value })}
                      placeholder="Ej. Codo flexionado"
                      className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="text-[10px] font-bold text-text-muted uppercase block mb-0.5">
                      Descripción breve
                    </label>
                    <input
                      value={pat.description || ''}
                      onChange={(e) =>
                        handleUpdatePattern(idx, { description: e.target.value })
                      }
                      placeholder="Descripción del patrón..."
                      className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => handleRemovePattern(idx)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                      title="Eliminar patrón"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. Protocolo de Dosificación (Músculos y Dosis) */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">vaccines</span>
              <div>
                <h2 className="text-base font-bold text-text-main dark:text-white">
                  4. Protocolo de Dosificación ({protocols.length} músculos/sitios)
                </h2>
                <p className="text-[11px] text-text-muted">
                  Edita cada músculo, su rango de dosis descriptiva, unidades sugeridas por marca, lateralidad y notas clínicas.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddProtocolMuscle}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              Agregar Músculo / Sitio
            </button>
          </div>

          {/* Live Summary Preview Card */}
          <div className="rounded-xl bg-background-light dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-text-muted dark:text-slate-300 uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">calculate</span>
                Vista Previa del Resumen · {previewProtocols.length} músculo{previewProtocols.length === 1 ? '' : 's'}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {activeVariants.length > 0 && (
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                    {(['ALL', 'A', 'B', 'C'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setPreviewVariant(v)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                          previewVariant === v
                            ? 'bg-primary text-white'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {v === 'ALL' ? 'Todas' : `Prot. ${v}`}
                      </button>
                    ))}
                  </div>
                )}

                {patterns.length > 0 && (
                  <select
                    value={previewPattern}
                    onChange={(e) => setPreviewPattern(e.target.value)}
                    className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-bold"
                  >
                    <option value="all">Todos los patrones ({protocols.length})</option>
                    {patterns.map((pat) => (
                      <option key={pat.id} value={pat.id}>
                        {pat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {BRANDS.map((brand) => {
                const total = brandTotals[brand];
                const cap = BRAND_SESSION_CAP[brand];
                const over = total > cap;
                return (
                  <div
                    key={brand}
                    className="rounded-lg bg-white dark:bg-slate-900/70 border border-slate-100 dark:border-slate-700 px-2 py-2 text-center"
                  >
                    <p className="text-[9px] font-bold text-text-muted dark:text-slate-400 uppercase">
                      {brand}
                    </p>
                    <p className={`text-sm font-black ${over ? 'text-red-500' : 'text-text-main dark:text-white'}`}>
                      {total} U
                    </p>
                    <p className="text-[9px] text-text-muted">máx ref. {cap} U</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search bar when there are many muscles */}
          {protocols.length > 4 && (
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">
                filter_list
              </span>
              <input
                value={protocolSearch}
                onChange={(e) => setProtocolSearch(e.target.value)}
                placeholder="Filtrar músculos dentro de este protocolo..."
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-9 pr-4 py-2 text-xs"
              />
            </div>
          )}

          {/* List of protocol muscles */}
          <div className="space-y-3">
            {protocols.map((protocol, idx) => {
              // Apply filter if active
              if (patterns.length > 0 && previewPattern !== 'all' && protocol.pattern !== previewPattern) {
                return null;
              }
              if (activeVariants.length > 0 && previewVariant !== 'ALL' && (protocol.protocolVariant || 'A') !== previewVariant) {
                return null;
              }
              if (protocolSearch.trim()) {
                const q = protocolSearch.toLowerCase();
                const match =
                  (protocol.muscle || '').toLowerCase().includes(q) ||
                  (protocol.muscleName || '').toLowerCase().includes(q) ||
                  (protocol.notes || '').toLowerCase().includes(q) ||
                  (protocol.dose || '').toLowerCase().includes(q);
                if (!match) return null;
              }

              const matchedAtlas = findMuscleForCalculatorName(
                protocol.muscleName || protocol.muscle || ''
              );
              const calcReference = protocol.muscleName
                ? dosisData.Botox?.[protocol.muscleName]
                : undefined;

              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 p-4 space-y-3 border-l-4 border-l-primary"
                >
                  {/* Top bar of muscle card */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm text-text-main dark:text-white">
                        {protocol.muscle || protocol.muscleName || 'Nuevo músculo / sitio'}
                      </span>
                      {matchedAtlas && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">ultrasound</span>
                          Vinculado a Atlas USG ({matchedAtlas.name})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveProtocolMuscle(idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Subir"
                      >
                        <span className="material-symbols-outlined text-base">arrow_upward</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveProtocolMuscle(idx, 1)}
                        disabled={idx === protocols.length - 1}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Bajar"
                      >
                        <span className="material-symbols-outlined text-base">arrow_downward</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateProtocolMuscle(idx)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                        title="Duplicar músculo"
                      >
                        <span className="material-symbols-outlined text-base">content_copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveProtocolMuscle(idx)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 cursor-pointer"
                        title="Eliminar músculo"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Display name */}
                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Nombre en Protocolo (Visible) *
                      </label>
                      <input
                        value={protocol.muscle || ''}
                        onChange={(e) =>
                          updateProtocolItem(idx, { muscle: e.target.value })
                        }
                        placeholder="Ej. Orbicular de los ojos"
                        className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-text-main dark:text-white"
                      />
                    </div>

                    {/* Calculator / Atlas link */}
                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Músculo en Calculadora / Atlas USG
                      </label>
                      <select
                        value={protocol.muscleName || ''}
                        onChange={(e) => {
                          const selectedKey = e.target.value;
                          const matched = findMuscleForCalculatorName(selectedKey);
                          const autoDisplayName =
                            protocol.muscle?.trim() ||
                            matched?.name ||
                            selectedKey;
                          updateProtocolItem(idx, {
                            muscleName: selectedKey || undefined,
                            muscle: autoDisplayName,
                          });
                        }}
                        className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-text-main dark:text-white"
                      >
                        <option value="">— Sin vínculo / Sitio libre (ej. Axila, Detrusor) —</option>
                        {calculatorMuscleOptions.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.spanishName} ({opt.key})
                            {opt.botoxRange ? ` · Botox ${opt.botoxRange}` : ''}
                          </option>
                        ))}
                      </select>
                      {calcReference && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Rango ref. calculadora: Botox {calcReference.min}-{calcReference.max} U · Dysport{' '}
                          {dosisData.Dysport?.[protocol.muscleName!]?.min}-
                          {dosisData.Dysport?.[protocol.muscleName!]?.max} U
                        </p>
                      )}
                    </div>

                    {/* Dose descriptive text */}
                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Dosis Descriptiva del Protocolo *
                      </label>
                      <input
                        value={protocol.dose}
                        onChange={(e) =>
                          updateProtocolItem(idx, { dose: e.target.value })
                        }
                        placeholder="Ej. 50-100 U o 1.25-2.5 U por sitio"
                        className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-primary"
                      />
                    </div>
                  </div>

                  {/* Per-brand suggested doses & Laterality & Variant & Pattern */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                    {BRANDS.map((brand) => {
                      const autoVal = resolveProtocolAutoSuggestedDose(protocol, brand).customDose;
                      const manualVal = protocol.brandDoses?.[brand];
                      return (
                        <div key={brand} className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                            {brand} (U / lado)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={manualVal !== undefined ? String(manualVal) : ''}
                            onChange={(e) =>
                              updateProtocolBrandDose(idx, brand, e.target.value)
                            }
                            placeholder={`Auto: ${autoVal} U`}
                            className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-bold text-center text-text-main dark:text-white"
                          />
                        </div>
                      );
                    })}

                    {/* Bilateral toggle */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Lateralidad
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateProtocolItem(idx, { bilateral: !protocol.bilateral })
                        }
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          protocol.bilateral
                            ? 'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/40 dark:border-purple-700 dark:text-purple-200'
                            : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">flip</span>
                        {protocol.bilateral ? 'Bilateral (x2)' : 'Unilateral'}
                      </button>
                    </div>

                    {/* Variant selector */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Variante (A/B/C)
                      </label>
                      <select
                        value={protocol.protocolVariant || ''}
                        onChange={(e) =>
                          updateProtocolItem(idx, {
                            protocolVariant: (e.target.value || undefined) as ProtocolVariant | undefined,
                          })
                        }
                        className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-semibold"
                      >
                        <option value="">Estándar</option>
                        <option value="A">Protocolo A</option>
                        <option value="B">Protocolo B</option>
                        <option value="C">Protocolo C</option>
                      </select>
                    </div>

                    {/* Pattern selector */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Patrón Clínico
                      </label>
                      <select
                        value={protocol.pattern || ''}
                        disabled={patterns.length === 0}
                        onChange={(e) =>
                          updateProtocolItem(idx, {
                            pattern: e.target.value || undefined,
                          })
                        }
                        className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-semibold disabled:opacity-50"
                      >
                        <option value="">
                          {patterns.length === 0 ? 'Sin patrones' : '— Sin patrón —'}
                        </option>
                        {patterns.map((pat) => (
                          <option key={pat.id} value={pat.id}>
                            {pat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                      Notas Clínicas / Sitios de Inyección / Guía USG
                    </label>
                    <input
                      value={protocol.notes || ''}
                      onChange={(e) =>
                        updateProtocolItem(idx, { notes: e.target.value })
                      }
                      placeholder="Ej. Dividir en 3-4 sitios; guía USG/EMG recomendada..."
                      className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-text-main dark:text-white"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddProtocolMuscle}
            className="w-full py-3 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary text-primary text-xs font-black flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Agregar otro músculo o sitio al protocolo
          </button>
        </section>

        {/* 5. Notas Clínicas Adicionales */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">clinical_notes</span>
              <h2 className="text-base font-bold text-text-main dark:text-white">
                5. Notas Clínicas e Información Adicional ({additionalInfo.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setAdditionalInfo((prev) => [...prev, ''])}
              className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Agregar Nota
            </button>
          </div>

          {additionalInfo.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sin notas clínicas adicionales.</p>
          ) : (
            <div className="space-y-2">
              {additionalInfo.map((info, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                  <input
                    value={info}
                    onChange={(e) =>
                      setAdditionalInfo((prev) =>
                        prev.map((item, i) => (i === idx ? e.target.value : item))
                      )
                    }
                    placeholder="Escribe una recomendación o nota clínica..."
                    className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-text-main dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAdditionalInfo((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 6. Seguridad Clínica (Contraindicaciones y Efectos Adversos) */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="material-symbols-outlined text-amber-500">health_and_safety</span>
            <div>
              <h2 className="text-base font-bold text-text-main dark:text-white">
                6. Seguridad Clínica (Contraindicaciones y Efectos Adversos)
              </h2>
              <p className="text-[11px] text-text-muted">
                Las contraindicaciones generales de toxina botulínica ({GENERAL_BONT_CONTRAINDICATIONS.length}) se incluyen automáticamente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contraindicaciones específicas */}
            <div className="rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">block</span>
                  Contraindicaciones Específicas ({contraindications.length})
                </p>
                <button
                  type="button"
                  onClick={() => setContraindications((prev) => [...prev, ''])}
                  className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 text-[11px] font-bold cursor-pointer"
                >
                  + Agregar
                </button>
              </div>
              {contraindications.length === 0 ? (
                <p className="text-[11px] text-red-600/70 dark:text-red-300/70 italic">
                  Solo aplican las contraindicaciones generales de BoNT.
                </p>
              ) : (
                <div className="space-y-2">
                  {contraindications.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        value={item}
                        onChange={(e) =>
                          setContraindications((prev) =>
                            prev.map((c, i) => (i === idx ? e.target.value : c))
                          )
                        }
                        placeholder="Contraindicación específica..."
                        className="flex-1 rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800/60 px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setContraindications((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Efectos adversos frecuentes */}
            <div className="rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">warning</span>
                  Efectos Adversos Frecuentes ({adverseEffects.length})
                </p>
                <button
                  type="button"
                  onClick={() => setAdverseEffects((prev) => [...prev, ''])}
                  className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[11px] font-bold cursor-pointer"
                >
                  + Agregar
                </button>
              </div>
              <div className="space-y-2">
                {adverseEffects.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      value={item}
                      onChange={(e) =>
                        setAdverseEffects((prev) =>
                          prev.map((a, i) => (i === idx ? e.target.value : a))
                        )
                      }
                      placeholder="Efecto adverso frecuente..."
                      className="flex-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAdverseEffects((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="p-1 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 7. Referencias Bibliográficas */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">menu_book</span>
              <h2 className="text-base font-bold text-text-main dark:text-white">
                7. Referencias Bibliográficas ({references.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setReferences((prev) => [...prev, ''])}
              className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Agregar Referencia
            </button>
          </div>

          {references.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sin referencias bibliográficas registradas.</p>
          ) : (
            <div className="space-y-2">
              {references.map((ref, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary w-6 text-right">
                    [{idx + 1}]
                  </span>
                  <input
                    value={ref}
                    onChange={(e) =>
                      setReferences((prev) =>
                        prev.map((item, i) => (i === idx ? e.target.value : item))
                      )
                    }
                    placeholder="Autor (Año). Título. Revista. https://..."
                    className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-text-main dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setReferences((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reset or delete button */}
        {!isNewMode && (isCustomized || !isBuiltIn) && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetOrDelete}
              disabled={saving}
              className="w-full px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
            >
              {isBuiltIn
                ? 'Restablecer protocolo a los valores originales de fábrica'
                : 'Eliminar esta patología personalizada'}
            </button>
          </div>
        )}
      </main>

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:pl-64 p-4 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-30">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          {!isNewMode && (
            <button
              type="button"
              onClick={() => navigate(`/pathology/${pathologyId}`)}
              className="px-4 py-3.5 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">visibility</span>
              <span>Ver ficha</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploadingImage}
            className="flex-1 py-3.5 bg-primary hover:bg-primary-dark text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer text-sm"
          >
            <span className="material-symbols-outlined">save</span>
            {saving ? 'Guardando protocolo...' : 'Guardar cambios del protocolo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPathologyEditor;
