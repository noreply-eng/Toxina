import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MuscleData } from '../../../data/muscleData';
import { fetchAllMuscleMedia } from '../../../services/muscleMedia';
import { fetchClinicalPearls, type MuscleClinicalPearl } from '../../../services/premiumContent';
import type { MuscleMedia } from '../../../types/muscleMedia';
import type {
  PdfBookConfig,
  PdfColorTheme,
  PdfExportProgress,
  PdfExportResult,
  PdfLayoutMode,
  PdfPaperPreset,
  PdfSortOrder,
} from '../../../types/pdfExport';
import {
  buildResolvedMuscleCatalog,
  CATEGORY_META,
  CATEGORY_ORDER,
  COLOR_THEMES,
  DEFAULT_BOOK_CONFIG,
  estimateBookPages,
  getEffectivePaperSpec,
  LAYOUT_MODES,
  loadSavedBookConfig,
  PAPER_PRESETS,
  saveBookConfig,
  sortMusclesForBook,
} from '../../../utils/muscleBookCatalog';
import { generateFlashcardBookPdf } from '../../../utils/flashcardPdfGenerator';
import { openHtmlPrintBookPreview } from '../../../utils/flashcardPrintHtml';
import FlashcardPreviewCanvas from './FlashcardPreviewCanvas';

type ReadinessFilter = 'all' | 'complete' | 'any-image' | 'only-usg' | 'only-motor' | 'missing';

const PdfExportPanel: React.FC = () => {
  const navigate = useNavigate();

  const [mediaMap, setMediaMap] = useState<Record<string, MuscleMedia>>({});
  const [pearls, setPearls] = useState<MuscleClinicalPearl[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [config, setConfig] = useState<PdfBookConfig>(() => loadSavedBookConfig());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionInitialized, setSelectionInitialized] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MuscleData['category'] | 'all'>('all');
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('all');
  const [previewMuscleId, setPreviewMuscleId] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<PdfExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<PdfExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadCatalogData = useCallback(async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      const [m, p] = await Promise.all([
        fetchAllMuscleMedia(),
        fetchClinicalPearls().catch(() => [] as MuscleClinicalPearl[]),
      ]);
      setMediaMap(m);
      setPearls(p);
    } catch (err: any) {
      setDataError(err?.message || 'No se pudieron cargar las imágenes de músculos desde Supabase.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogData();
  }, [loadCatalogData]);

  // Persist book configuration changes
  useEffect(() => {
    saveBookConfig(config);
  }, [config]);

  const catalog = useMemo(
    () => buildResolvedMuscleCatalog(mediaMap, pearls),
    [mediaMap, pearls]
  );

  // Initialize default selection: all complete muscles if any exist, else all muscles
  useEffect(() => {
    if (loadingData || selectionInitialized || catalog.length === 0) return;
    const withImages = catalog.filter((c) => c.hasMotorImage || c.hasUsgImage);
    const initialSet =
      withImages.length > 0
        ? new Set(withImages.map((c) => c.muscle.id))
        : new Set(catalog.map((c) => c.muscle.id));
    setSelectedIds(initialSet);
    setSelectionInitialized(true);
  }, [loadingData, selectionInitialized, catalog]);

  // Global readiness statistics
  const stats = useMemo(() => {
    let complete = 0;
    let onlyOne = 0;
    let none = 0;
    let withMotor = 0;
    let withUsg = 0;
    catalog.forEach((item) => {
      if (item.hasMotorImage) withMotor++;
      if (item.hasUsgImage) withUsg++;
      if (item.isComplete) complete++;
      else if (item.hasMotorImage || item.hasUsgImage) onlyOne++;
      else none++;
    });
    return { total: catalog.length, complete, onlyOne, none, withMotor, withUsg };
  }, [catalog]);

  // Filtered list for the selection table
  const filteredCatalog = useMemo(() => {
    let list = sortMusclesForBook(catalog, config.sortOrder);

    if (categoryFilter !== 'all') {
      list = list.filter((i) => i.muscle.category === categoryFilter);
    }

    if (readinessFilter === 'complete') list = list.filter((i) => i.isComplete);
    else if (readinessFilter === 'any-image') list = list.filter((i) => i.hasMotorImage || i.hasUsgImage);
    else if (readinessFilter === 'only-usg') list = list.filter((i) => i.hasUsgImage);
    else if (readinessFilter === 'only-motor') list = list.filter((i) => i.hasMotorImage);
    else if (readinessFilter === 'missing') list = list.filter((i) => !i.isComplete);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.muscle.name.toLowerCase().includes(q) ||
          i.muscle.latinName.toLowerCase().includes(q) ||
          i.muscle.region.toLowerCase().includes(q)
      );
    }
    return list;
  }, [catalog, config.sortOrder, categoryFilter, readinessFilter, searchQuery]);

  // Ordered selected muscles that will actually go into the book
  const selectedMuscles = useMemo(
    () =>
      sortMusclesForBook(
        catalog.filter((c) => selectedIds.has(c.muscle.id)),
        config.sortOrder
      ),
    [catalog, selectedIds, config.sortOrder]
  );

  const selectedMissingImagesCount = useMemo(
    () => selectedMuscles.filter((m) => !m.isComplete).length,
    [selectedMuscles]
  );

  const pageEstimate = useMemo(
    () => estimateBookPages(selectedMuscles, config),
    [selectedMuscles, config]
  );

  const effectiveSpec = useMemo(() => getEffectivePaperSpec(config), [config]);

  // Active preview muscle
  const previewIndex = useMemo(() => {
    if (selectedMuscles.length === 0) return -1;
    if (!previewMuscleId) return 0;
    const idx = selectedMuscles.findIndex((m) => m.muscle.id === previewMuscleId);
    return idx >= 0 ? idx : 0;
  }, [selectedMuscles, previewMuscleId]);

  const activePreviewItem = previewIndex >= 0 ? selectedMuscles[previewIndex] : null;

  const updateConfig = <K extends keyof PdfBookConfig>(key: K, value: PdfBookConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleLayoutChange = (mode: PdfLayoutMode) => {
    const modeMeta = LAYOUT_MODES.find((m) => m.id === mode);
    setConfig((prev) => {
      let nextPaper = prev.paperPreset;
      if (mode === 'cut-sheet-2up' && !PAPER_PRESETS[prev.paperPreset].supportsCutSheet2Up) {
        nextPaper = 'letter';
      } else if (modeMeta && mode === 'duplex-flashcards' && (prev.paperPreset === 'letter' || prev.paperPreset === 'a4')) {
        nextPaper = modeMeta.defaultPaper;
      }
      return { ...prev, layoutMode: mode, paperPreset: nextPaper };
    });
  };

  const toggleMuscle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredCatalog.forEach((item) => next.add(item.muscle.id));
      return next;
    });
  };

  const deselectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredCatalog.forEach((item) => next.delete(item.muscle.id));
      return next;
    });
  };

  const selectPreset = (preset: 'complete' | 'any-image' | 'all' | 'none') => {
    if (preset === 'none') {
      setSelectedIds(new Set());
      return;
    }
    if (preset === 'all') {
      setSelectedIds(new Set(catalog.map((c) => c.muscle.id)));
      return;
    }
    if (preset === 'complete') {
      setSelectedIds(new Set(catalog.filter((c) => c.isComplete).map((c) => c.muscle.id)));
      return;
    }
    setSelectedIds(
      new Set(catalog.filter((c) => c.hasMotorImage || c.hasUsgImage).map((c) => c.muscle.id))
    );
  };

  const handleGeneratePdf = async () => {
    if (selectedMuscles.length === 0) {
      setExportError('Selecciona al menos un músculo antes de generar el PDF.');
      return;
    }
    setExporting(true);
    setExportError(null);
    setExportResult(null);
    setProgress({
      phase: 'preparing',
      current: 0,
      total: selectedMuscles.length,
      message: 'Preparando exportación editorial...',
    });

    try {
      const res = await generateFlashcardBookPdf(selectedMuscles, config, setProgress);
      setExportResult(res);
    } catch (err: any) {
      console.error('PDF export failed:', err);
      setExportError(err?.message || 'Ocurrió un error al generar el archivo PDF.');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenHtmlPrint = () => {
    if (selectedMuscles.length === 0) {
      setExportError('Selecciona al menos un músculo para abrir la vista de impresión.');
      return;
    }
    const opened = openHtmlPrintBookPreview(selectedMuscles, config);
    if (!opened) {
      setExportError(
        'El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio o usa "Descargar Libro PDF".'
      );
    }
  };

  const readinessPercent =
    stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white border border-slate-800 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/35 text-amber-300 text-[10px] font-black uppercase tracking-wider">
            <span className="material-symbols-outlined text-xs">auto_stories</span>
            Estudio Editorial de Imprenta · Libro Comercial de Flashcards
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight">
            Exportación PDF — Atlas Imprimible de Músculos (Anatomía + USG)
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Compila todas las fichas musculares con sus fotos anatómicas de punto motor, capturas ecográficas (USG),
            dosis comparativas y precauciones en un libro profesional listo para imprenta y venta comercial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/admin/media')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-base">add_photo_alternate</span>
            Subir / Editar Fotos
          </button>
          <button
            type="button"
            onClick={loadCatalogData}
            disabled={loadingData}
            className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">sync</span>
            {loadingData ? 'Sincronizando...' : 'Actualizar Medios'}
          </button>
        </div>
      </div>

      {dataError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3.5 text-xs font-bold text-red-700 dark:text-red-300">
          {dataError}
        </div>
      )}

      {/* Pre-flight Readiness KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Listos (Anatomía + USG)</span>
            <span className="material-symbols-outlined text-emerald-500 text-xl">verified</span>
          </div>
          <p className="text-2xl font-black mt-1.5">
            {loadingData ? '…' : stats.complete}
            <span className="text-xs font-bold text-slate-400 ml-1">/ {stats.total}</span>
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
            {readinessPercent}% del catálogo completo para imprenta
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Cobertura de Fotos</span>
            <span className="material-symbols-outlined text-sky-500 text-xl">photo_library</span>
          </div>
          <p className="text-2xl font-black mt-1.5">
            {loadingData ? '…' : stats.withMotor + stats.withUsg}
            <span className="text-xs font-bold text-slate-400 ml-1">imágenes</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Anatomía: <strong className="text-slate-800 dark:text-slate-200">{stats.withMotor}</strong> · USG:{' '}
            <strong className="text-slate-800 dark:text-slate-200">{stats.withUsg}</strong>
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
            {stats.onlyOne} con 1 foto · {stats.none} sin fotos
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">En Esta Edición</span>
            <span className="material-symbols-outlined text-primary text-xl">checklist</span>
          </div>
          <p className="text-2xl font-black mt-1.5">
            {selectedMuscles.length}
            <span className="text-xs font-bold text-slate-400 ml-1">músculos</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Perlas CMS vinculadas:{' '}
            <strong className="text-amber-600">
              {selectedMuscles.reduce((acc, m) => acc + m.pearls.length, 0)}
            </strong>
          </p>
          <p className="text-[11px] font-bold text-slate-400 mt-0.5">
            {selectedMissingImagesCount === 0
              ? '✓ Todos los seleccionados tienen ambas fotos'
              : `${selectedMissingImagesCount} con foto pendiente`}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Volumen Estimado</span>
            <span className="material-symbols-outlined text-purple-500 text-xl">menu_book</span>
          </div>
          <p className="text-2xl font-black mt-1.5">
            {pageEstimate.totalPages}
            <span className="text-xs font-bold text-slate-400 ml-1">páginas</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            ~<strong>{pageEstimate.physicalSheets}</strong> hojas físicas (impresión dúplex)
          </p>
          <p className="text-[11px] text-primary font-bold mt-0.5 truncate">
            {effectiveSpec.dimensionsLabel} {config.cropMarks ? '+ marcas de corte' : ''}
          </p>
        </div>
      </div>

      {/* Main 2-column Editorial Studio */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): Muscle Picker + Editorial Book Metadata */}
        <div className="xl:col-span-7 space-y-6">
          {/* 1. Muscle Selection & Pre-Flight Media Audit */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">fact_check</span>
                  1. Selección y Auditoría de Músculos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elige qué músculos entran en el libro. Haz clic en cualquier fila para previsualizar su flashcard.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => selectPreset('complete')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold cursor-pointer hover:bg-emerald-100 transition-colors"
                >
                  Solo completos ({stats.complete})
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset('any-image')}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[11px] font-bold cursor-pointer hover:bg-sky-100 transition-colors"
                >
                  Con alguna foto ({stats.complete + stats.onlyOne})
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset('all')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  Todos ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => selectPreset('none')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-bold cursor-pointer hover:text-red-500 transition-colors"
                >
                  Ninguno
                </button>
              </div>
            </div>

            {/* Search + Category + Readiness Filters */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    search
                  </span>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar músculo por nombre, latín o región..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>
                <select
                  value={readinessFilter}
                  onChange={(e) => setReadinessFilter(e.target.value as ReadinessFilter)}
                  className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
                >
                  <option value="all">Estado: Todos</option>
                  <option value="complete">Listos (Anatomía + USG)</option>
                  <option value="any-image">Con al menos 1 imagen</option>
                  <option value="only-motor">Con foto anatómica</option>
                  <option value="only-usg">Con foto USG</option>
                  <option value="missing">Con fotos pendientes</option>
                </select>
              </div>

              {/* Regional chapter pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    categoryFilter === 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Todas las regiones ({catalog.length})
                </button>
                {CATEGORY_ORDER.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const count = catalog.filter((c) => c.muscle.category === cat).length;
                  const active = categoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1.5 transition-colors ${
                        active
                          ? 'text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                      style={active ? { backgroundColor: meta.hex } : undefined}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: active ? '#ffffff' : meta.hex }}
                      />
                      {meta.shortLabel} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>
                  Mostrando <strong>{filteredCatalog.length}</strong> músculos ·{' '}
                  <strong className="text-primary">{selectedIds.size}</strong> seleccionados para el libro
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="text-primary font-bold hover:underline cursor-pointer"
                  >
                    Marcar visibles
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllVisible}
                    className="text-slate-500 font-bold hover:text-red-500 hover:underline cursor-pointer"
                  >
                    Desmarcar visibles
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Muscle Audit List */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {loadingData ? (
                <div className="py-14 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  <span className="text-xs font-bold">Cargando catálogo de músculos y medios...</span>
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No hay músculos que coincidan con el filtro actual.
                </div>
              ) : (
                <div className="max-h-[430px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCatalog.map((item) => {
                    const checked = selectedIds.has(item.muscle.id);
                    const isPreviewed = activePreviewItem?.muscle.id === item.muscle.id;
                    const meta = CATEGORY_META[item.muscle.category];
                    return (
                      <div
                        key={item.muscle.id}
                        onClick={() => setPreviewMuscleId(item.muscle.id)}
                        className={`px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                          isPreviewed
                            ? 'bg-primary/5 dark:bg-primary/10'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleMuscle(item.muscle.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="size-4 rounded accent-primary cursor-pointer shrink-0"
                        />

                        {/* Dual mini thumbnails (Anatomy + USG) */}
                        <div className="flex items-center gap-1 shrink-0">
                          <div
                            className="size-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center"
                            title={item.hasMotorImage ? 'Tiene imagen anatómica' : 'Falta imagen anatómica'}
                          >
                            {item.effectiveMotorImageUrl ? (
                              <img
                                src={item.effectiveMotorImageUrl}
                                alt="Anatomía"
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-base">
                                accessibility_new
                              </span>
                            )}
                          </div>
                          <div
                            className="size-9 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center"
                            title={item.hasUsgImage ? 'Tiene captura USG' : 'Falta captura USG'}
                          >
                            {item.effectiveUsgImageUrl ? (
                              <img
                                src={item.effectiveUsgImageUrl}
                                alt="USG"
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-slate-600 text-base">
                                ultrasound
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Muscle info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {item.muscle.name}
                            </span>
                            <span
                              className="text-[9px] font-black px-1.5 py-0.5 rounded text-white uppercase shrink-0"
                              style={{ backgroundColor: meta.hex }}
                            >
                              {meta.shortLabel}
                            </span>
                            {item.pearls.length > 0 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                {item.pearls.length} perla{item.pearls.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 italic truncate">
                            {item.muscle.latinName} · {item.muscle.region}
                          </p>
                          <div className="flex items-center gap-2.5 mt-0.5">
                            <span
                              className={`text-[10px] font-bold flex items-center gap-0.5 ${
                                item.hasMotorImage ? 'text-emerald-600' : 'text-slate-400'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                {item.hasMotorImage ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                              Anatomía
                            </span>
                            <span
                              className={`text-[10px] font-bold flex items-center gap-0.5 ${
                                item.hasUsgImage ? 'text-sky-600' : 'text-slate-400'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                {item.hasUsgImage ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                              USG ({item.effectiveUsgView})
                            </span>
                            {item.effectiveCoordinates && (
                              <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">target</span>
                                Pin
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick-jump to upload/edit images */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/media/${item.muscle.id}`);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                          title="Subir o editar imágenes de este músculo"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 2. Commercial Book Metadata & Structure */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500">menu_book</span>
                  2. Datos Editoriales y Estructura del Libro
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personaliza la portada, créditos legales, ISBN y contraportada para la edición impresa a la venta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfig(DEFAULT_BOOK_CONFIG)}
                className="text-[11px] font-bold text-slate-400 hover:text-primary cursor-pointer"
              >
                Restablecer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-500 mb-1">Título del Libro</label>
                <input
                  value={config.title}
                  onChange={(e) => updateConfig('title', e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-500 mb-1">Subtítulo</label>
                <input
                  value={config.subtitle}
                  onChange={(e) => updateConfig('subtitle', e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Autor / Director Médico</label>
                <input
                  value={config.author}
                  onChange={(e) => updateConfig('author', e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Editorial / Sello</label>
                <input
                  value={config.publisher}
                  onChange={(e) => updateConfig('publisher', e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Edición</label>
                <input
                  value={config.edition}
                  onChange={(e) => updateConfig('edition', e.target.value)}
                  placeholder="1.ª Edición"
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Año</label>
                <input
                  value={config.year}
                  onChange={(e) => updateConfig('year', e.target.value)}
                  placeholder="2026"
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Sitio Web / Marca</label>
                <input
                  value={config.website}
                  onChange={(e) => updateConfig('website', e.target.value)}
                  placeholder="sonotox.com"
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">ISBN (Opcional para venta)</label>
                <input
                  value={config.isbn}
                  onChange={(e) => updateConfig('isbn', e.target.value)}
                  placeholder="978-607-XXXX-XX-X"
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-500 mb-1">Cintillo superior de Portada</label>
                <input
                  value={config.coverBadge}
                  onChange={(e) => updateConfig('coverBadge', e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
              </div>
            </div>

            {/* Book Sections Checkboxes */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[11px] font-black uppercase text-slate-400 mb-2.5">
                Páginas Editoriales Incluidas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(
                  [
                    ['includeCover', 'Portada comercial a color'],
                    ['includeCopyright', 'Página legal, aviso médico y leyenda de lectura'],
                    ['includeToc', 'Índice general con numeración exacta'],
                    ['includeChapterDividers', 'Portadillas de capítulo por región anatómica'],
                    ['includeBackCover', 'Contraportada comercial + recuadro ISBN'],
                    ['includePageNumbers', 'Numeración de páginas y pie editorial'],
                  ] as [keyof PdfBookConfig, string][]
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(config[key])}
                      onChange={(e) => updateConfig(key, e.target.checked as any)}
                      className="size-4 rounded accent-primary"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (5 cols): Live Preview + Print Format + Content Toggles + Export CTA */}
        <div className="xl:col-span-5 space-y-5 xl:sticky xl:top-20">
          {/* Live Interactive Flashcard / Cover Preview */}
          <FlashcardPreviewCanvas
            item={activePreviewItem}
            cardNumber={previewIndex >= 0 ? previewIndex + 1 : 0}
            totalSelected={selectedMuscles.length}
            config={config}
            onPrev={() => {
              if (selectedMuscles.length <= 1) return;
              const prevIdx =
                (previewIndex - 1 + selectedMuscles.length) % selectedMuscles.length;
              setPreviewMuscleId(selectedMuscles[prevIdx].muscle.id);
            }}
            onNext={() => {
              if (selectedMuscles.length <= 1) return;
              const nextIdx = (previewIndex + 1) % selectedMuscles.length;
              setPreviewMuscleId(selectedMuscles[nextIdx].muscle.id);
            }}
          />

          {/* 3. Print Shop & Imposition Format */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">print</span>
              3. Formato de Imprenta y Maquetación
            </h3>

            {/* Layout mode cards */}
            <div className="space-y-2">
              {LAYOUT_MODES.map((m) => {
                const selected = config.layoutMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleLayoutChange(m.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      selected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-lg ${selected ? 'text-primary' : 'text-slate-400'}`}>
                          {m.icon}
                        </span>
                        <span className="text-xs font-black">{m.title}</span>
                      </div>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{m.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Paper Size + Color Theme + Sort Order */}
            <div className="grid grid-cols-1 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-500 mb-1">Tamaño de Papel / Tarjeta</label>
                <select
                  value={effectiveSpec.id}
                  onChange={(e) => updateConfig('paperPreset', e.target.value as PdfPaperPreset)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                >
                  {Object.values(PAPER_PRESETS).map((preset) => {
                    const disabled =
                      config.layoutMode === 'cut-sheet-2up' && !preset.supportsCutSheet2Up;
                    return (
                      <option key={preset.id} value={preset.id} disabled={disabled}>
                        {preset.label} — {preset.dimensionsLabel}
                        {disabled ? ' (Solo Carta/A4 en 2×1)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">{effectiveSpec.recommendedFor}</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Paleta Editorial</label>
                  <select
                    value={config.colorTheme}
                    onChange={(e) => updateConfig('colorTheme', e.target.value as PdfColorTheme)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 font-bold text-[11px]"
                  >
                    {Object.values(COLOR_THEMES).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Orden de Fichas</label>
                  <select
                    value={config.sortOrder}
                    onChange={(e) => updateConfig('sortOrder', e.target.value as PdfSortOrder)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 font-bold text-[11px]"
                  >
                    <option value="category">Por Región (Capítulos)</option>
                    <option value="alpha-es">Alfabético (Español)</option>
                    <option value="alpha-latin">Alfabético (Latín)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pre-press options */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <label className="flex items-start gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.cropMarks}
                  onChange={(e) => updateConfig('cropMarks', e.target.checked)}
                  className="size-4 mt-0.5 rounded accent-primary"
                />
                <span>
                  <strong>Marcas de corte y sangrado (3 mm)</strong>
                  <span className="block text-[10px] font-normal text-slate-500">
                    Agrega guías de guillotina en las 4 esquinas para corte profesional en imprenta.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.bindingGutter}
                  onChange={(e) => updateConfig('bindingGutter', e.target.checked)}
                  className="size-4 mt-0.5 rounded accent-primary"
                />
                <span>
                  <strong>Margen interior para encuadernación / espiral</strong>
                  <span className="block text-[10px] font-normal text-slate-500">
                    Alterna +4.5 mm en el lomo (páginas pares/impares) para anillado o empastado.
                  </span>
                </span>
              </label>
              {(config.layoutMode === 'duplex-flashcards' || config.layoutMode === 'cut-sheet-2up') && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <span className="material-symbols-outlined text-base shrink-0">verified</span>
                  <span>
                    <strong>Alineación dúplex automática activa:</strong> cada Anverso Anatómico y su Reverso USG
                    quedan pareados en la misma tarjeta física al imprimir tiro y retiro.
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* 4. Content included on each card */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-500 text-lg">tune</span>
              4. Contenido de Cada Flashcard
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {(
                [
                  ['includeMotorPointImage', 'Imagen Anatómica / Punto Motor'],
                  ['includeUsgImage', 'Imagen Ecográfica (USG)'],
                  ['includeMotorPointPin', 'Mira vectorial de Punto Motor'],
                  ['includeAnatomyDetails', 'Origen, Inserción, Inervación y Función'],
                  ['includeDosingTable', 'Dosis Botox / Dysport / Xeomin'],
                  ['includeUsgLandmarks', 'Landmarks y Transductor USG'],
                  ['includeTechniqueNotes', 'Notas de Técnica de Inyección'],
                  ['includePrecautions', 'Caja de Precauciones y Seguridad'],
                  ['includeIndications', 'Indicaciones Clínicas'],
                  ['includeClinicalPearls', 'Perlas Clínicas Premium (CMS)'],
                  ['includeAdminNotes', 'Notas internas del Admin'],
                  ['showMissingImagePlaceholder', 'Marco guía si falta foto (maqueta)'],
                ] as [keyof PdfBookConfig, string][]
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config[key])}
                    onChange={(e) => updateConfig(key, e.target.checked as any)}
                    className="size-3.5 rounded accent-primary"
                  />
                  <span className="truncate">{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* 5. Export CTA Card */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-primary/30 p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase text-primary">Listo para Generar</p>
                <p className="text-sm font-black">
                  {selectedMuscles.length} músculos · {pageEstimate.totalPages} páginas
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
                {effectiveSpec.dimensionsLabel}
              </span>
            </div>

            {selectedMissingImagesCount > 0 && selectedMuscles.length > 0 && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-[11px] text-amber-900 dark:text-amber-200 space-y-2">
                <p>
                  <strong>Aviso Pre-Imprenta:</strong> {selectedMissingImagesCount} de los{' '}
                  {selectedMuscles.length} músculos seleccionados aún no tienen ambas imágenes (Anatomía + USG).
                  Puedes exportar un borrador ahora o filtrar solo los completos.
                </p>
                {stats.complete > 0 && (
                  <button
                    type="button"
                    onClick={() => selectPreset('complete')}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] cursor-pointer"
                  >
                    Seleccionar solo los {stats.complete} músculos completos
                  </button>
                )}
              </div>
            )}

            {exporting && progress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-primary truncate">{progress.message}</span>
                  <span>
                    {Math.min(100, Math.round((progress.current / Math.max(1, progress.total)) * 100))}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{
                      width: `${Math.min(100, Math.round((progress.current / Math.max(1, progress.total)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {exportError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs font-bold text-red-700 dark:text-red-300">
                {exportError}
              </div>
            )}

            {exportResult && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs space-y-1.5">
                <p className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  PDF descargado: {exportResult.fileName}
                </p>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                  {exportResult.totalPages} páginas ({exportResult.physicalSheets} hojas dúplex) ·{' '}
                  {exportResult.muscleCount} músculos · {exportResult.imagesLoaded} imágenes incrustadas en alta resolución.
                </p>
                {exportResult.imagesFailed.length > 0 && (
                  <div className="pt-1 text-[10px] text-amber-800 dark:text-amber-300">
                    <strong>Nota:</strong> {exportResult.imagesFailed.length} imagen(es) no pudieron descargarse por red/CORS:{' '}
                    {exportResult.imagesFailed.map((f) => `${f.muscleName} (${f.kind})`).join(', ')}.
                    Puedes usar "Vista Impresión HD (Navegador)" si alguna URL bloquea CORS.
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={exporting || selectedMuscles.length === 0}
                onClick={handleGeneratePdf}
                className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-black text-sm shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-xl">
                  {exporting ? 'hourglass_top' : 'picture_as_pdf'}
                </span>
                {exporting ? 'Generando Libro PDF...' : 'Generar y Descargar Libro PDF'}
              </button>

              <button
                type="button"
                disabled={exporting || selectedMuscles.length === 0}
                onClick={handleOpenHtmlPrint}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Abrir Vista Impresión HD (Navegador)
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PdfExportPanel;
