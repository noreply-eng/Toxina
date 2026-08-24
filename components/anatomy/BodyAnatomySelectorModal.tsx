import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BodyAnatomySVG from './BodyAnatomySVG';
import {
  BodyRegionKey,
  AnatomyView,
  bodyRegionsDatabase,
  getBodyRegionByKey,
  getBodyRegionsByView,
  getMusclesForRegion
} from '../../data/bodyAnatomyData';
import {
  MuscleData,
  musclesData,
  searchMuscles,
  getMuscleIcon
} from '../../data/muscleData';
import MuscleIcon from '../MuscleIcon';

export interface BodyAnatomySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Modo de interacción: 'browse' (navegar/ver), 'single' (elegir uno), 'multi' (elegir varios) */
  selectionMode?: 'browse' | 'single' | 'multi';
  /** Músculos preseleccionados (para modo multi o single) */
  initialSelectedMuscleIds?: string[];
  /** Callback al seleccionar un solo músculo */
  onSelectMuscle?: (muscle: MuscleData) => void;
  /** Callback al confirmar selección múltiple */
  onSelectMuscles?: (muscles: MuscleData[]) => void;
  /** Callback al filtrar por región anatómica */
  onFilterRegion?: (regionKey: BodyRegionKey, muscles: MuscleData[]) => void;
  /** Título personalizado del modal */
  title?: string;
}

const BodyAnatomySelectorModal: React.FC<BodyAnatomySelectorModalProps> = ({
  isOpen,
  onClose,
  selectionMode = 'browse',
  initialSelectedMuscleIds = [],
  onSelectMuscle,
  onSelectMuscles,
  onFilterRegion,
  title
}) => {
  const navigate = useNavigate();

  const [currentView, setCurrentView] = useState<AnatomyView>('front');
  const [selectedRegionKey, setSelectedRegionKey] = useState<BodyRegionKey>('pecho');
  const [hoveredRegionKey, setHoveredRegionKey] = useState<BodyRegionKey | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedMuscleIds, setSelectedMuscleIds] = useState<Set<string>>(
    new Set(initialSelectedMuscleIds)
  );
  const [svgZoom, setSvgZoom] = useState<number>(1);
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');

  // Sync initial selection
  useEffect(() => {
    if (isOpen) {
      setSelectedMuscleIds(new Set(initialSelectedMuscleIds));
      setSearchQuery('');
      setSvgZoom(1);
    }
  }, [isOpen, initialSelectedMuscleIds]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-switch view if selected region belongs only to other view
  const handleSelectRegion = useCallback((regionKey: BodyRegionKey) => {
    setSelectedRegionKey(regionKey);
    setSelectedCategoryFilter('all');
    const info = getBodyRegionByKey(regionKey);
    if (info && !info.views.includes(currentView)) {
      setCurrentView(info.views[0]);
    }
  }, [currentView]);

  // Handle view switch
  const handleSwitchView = (newView: AnatomyView) => {
    setCurrentView(newView);
    const availableInNewView = getBodyRegionsByView(newView);
    // If current selected region is not in new view, switch to default in new view
    const isCurrentInView = availableInNewView.some((r) => r.key === selectedRegionKey);
    if (!isCurrentInView && availableInNewView.length > 0) {
      setSelectedRegionKey(availableInNewView[0].key);
    }
  };

  // Active region info
  const activeRegionInfo = useMemo(() => {
    return getBodyRegionByKey(selectedRegionKey) || bodyRegionsDatabase.pecho;
  }, [selectedRegionKey]);

  // Muscles for current region / search
  const displayedMuscles = useMemo(() => {
    let list: MuscleData[] = [];

    if (searchQuery.trim()) {
      list = searchMuscles(searchQuery);
    } else {
      list = getMusclesForRegion(selectedRegionKey);
    }

    if (selectedCategoryFilter !== 'all') {
      list = list.filter((m) => m.category === selectedCategoryFilter);
    }

    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
  }, [searchQuery, selectedRegionKey, selectedCategoryFilter]);

  // Toggle muscle selection for multi-mode
  const handleToggleMuscle = (muscle: MuscleData) => {
    if (selectionMode === 'single') {
      onSelectMuscle?.(muscle);
      onClose();
      return;
    }

    if (selectionMode === 'multi') {
      setSelectedMuscleIds((prev) => {
        const next = new Set(prev);
        if (next.has(muscle.id)) {
          next.delete(muscle.id);
        } else {
          next.add(muscle.id);
        }
        return next;
      });
      return;
    }

    // Default browse mode: navigate to motor point screen or fire callback
    if (onSelectMuscle) {
      onSelectMuscle(muscle);
      onClose();
    } else {
      onClose();
      navigate(`/motor-points/${muscle.id}`);
    }
  };

  // Confirm multi-select
  const handleConfirmMultiSelect = () => {
    const selectedList = musclesData.filter((m) => selectedMuscleIds.has(m.id));
    onSelectMuscles?.(selectedList);
    onClose();
  };

  // Apply region filter to caller
  const handleApplyRegionFilter = () => {
    const regionMuscles = getMusclesForRegion(selectedRegionKey);
    onFilterRegion?.(selectedRegionKey, regionMuscles);
    onClose();
  };

  const categories = [
    { id: 'all', label: 'Todos' },
    { id: 'face', label: 'Cara' },
    { id: 'neck', label: 'Cuello' },
    { id: 'upper-limb', label: 'M. Superior' },
    { id: 'trunk', label: 'Tronco' },
    { id: 'lower-limb', label: 'M. Inferior' }
  ];

  const currentViewRegions = useMemo(() => {
    return getBodyRegionsByView(currentView);
  }, [currentView]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Modal Card Container */}
      <div 
        className="relative w-full max-w-6xl h-[92vh] max-h-[900px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* MODAL HEADER */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20">
              <span className="material-symbols-outlined text-2xl">accessibility_new</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {title || 'Explorador Anatómico Corporal'}
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                  {displayedMuscles.length} {displayedMuscles.length === 1 ? 'músculo' : 'músculos'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Selecciona cualquier región en el modelo anatómico para filtrar y explorar músculos clínicos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile Tab Switcher */}
            <div className="flex sm:hidden bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setMobileTab('map')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  mobileTab === 'map'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Mapa SVG
              </button>
              <button
                onClick={() => setMobileTab('list')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  mobileTab === 'list'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Lista
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-black/20 text-white">
                  {displayedMuscles.length}
                </span>
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Cerrar (Esc)"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* QUICK REGION CHIPS BAR (HORIZONTAL SCROLL) */}
        {/* ========================================================================= */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/40 overflow-x-auto no-scrollbar flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">tune</span>
            Zonas:
          </span>
          {currentViewRegions.map((region) => {
            const isSelected = selectedRegionKey === region.key;
            return (
              <button
                key={region.key}
                onClick={() => handleSelectRegion(region.key)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-[1.02]'
                    : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-400/50 hover:bg-sky-50/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className={`material-symbols-outlined text-[15px] ${isSelected ? 'text-white' : 'text-sky-500'}`}>
                  {region.icon}
                </span>
                <span>{region.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* MAIN BODY CONTENT (SPLIT VIEW) */}
        {/* ========================================================================= */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-0">
          {/* ----------------------------------------------------------------------- */}
          {/* LEFT PANEL: SVG ANATOMICAL VIEWER */}
          {/* ----------------------------------------------------------------------- */}
          <div
            className={`md:col-span-5 lg:col-span-5 flex flex-col items-center justify-between p-3 sm:p-5 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 relative overflow-hidden ${
              mobileTab === 'list' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* View Switcher (Anterior / Posterior) & Zoom Toolbar */}
            <div className="w-full flex items-center justify-between z-10 gap-2 mb-2">
              <div className="flex bg-slate-200 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-300/60 dark:border-slate-700">
                <button
                  onClick={() => handleSwitchView('front')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currentView === 'front'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">front_hand</span>
                  <span>Anterior</span>
                </button>
                <button
                  onClick={() => handleSwitchView('back')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currentView === 'back'
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">back_hand</span>
                  <span>Posterior</span>
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-300/60 dark:border-slate-700">
                <button
                  onClick={() => setSvgZoom((z) => Math.max(0.8, z - 0.15))}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-sky-500 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700"
                  title="Alejar"
                >
                  <span className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <span className="text-[11px] font-bold px-1 text-slate-500 min-w-[34px] text-center">
                  {Math.round(svgZoom * 100)}%
                </span>
                <button
                  onClick={() => setSvgZoom((z) => Math.min(1.6, z + 0.15))}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-sky-500 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700"
                  title="Acercar"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
                {svgZoom !== 1 && (
                  <button
                    onClick={() => setSvgZoom(1)}
                    className="px-1.5 h-7 text-[10px] font-bold text-sky-500 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg"
                    title="Restablecer"
                  >
                    1:1
                  </button>
                )}
              </div>
            </div>

            {/* Interactive SVG Body Graphic */}
            <div className="w-full flex-1 flex items-center justify-center relative min-h-[300px] max-h-[520px]">
              <BodyAnatomySVG
                view={currentView}
                selectedRegion={selectedRegionKey}
                hoveredRegion={hoveredRegionKey}
                onSelectRegion={handleSelectRegion}
                onHoverRegion={setHoveredRegionKey}
                zoom={svgZoom}
                className="w-full h-full"
              />
            </div>

            {/* Bottom helper info */}
            <div className="w-full flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 px-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-sky-500">touch_app</span>
                Toca una región para seleccionar
              </span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Vista: {currentView === 'front' ? 'Ventral / Anterior' : 'Dorsal / Posterior'}
              </span>
            </div>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* RIGHT PANEL: MUSCLES & CLINICAL DETAILS */}
          {/* ----------------------------------------------------------------------- */}
          <div
            className={`md:col-span-7 lg:col-span-7 flex flex-col h-full bg-white dark:bg-slate-900 min-h-0 ${
              mobileTab === 'map' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Search and Category Filters */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2.5 bg-slate-50/40 dark:bg-slate-900/60">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-[20px]">search</span>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar músculo por nombre, latín o función..."
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-9 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {categories.map((cat) => {
                  const isCatSelected = selectedCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        isCatSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Region Clinical Summary Header (when not searching) */}
            {!searchQuery.trim() && activeRegionInfo && (
              <div className="px-4 py-3 bg-sky-50/50 dark:bg-sky-950/20 border-b border-sky-100 dark:border-sky-900/30 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    <span className="material-symbols-outlined text-[14px]">{activeRegionInfo.icon}</span>
                    {activeRegionInfo.tag}
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {displayedMuscles.length} músculos registrados
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {activeRegionInfo.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                  {activeRegionInfo.desc}
                </p>
              </div>
            )}

            {/* Muscle List (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
              {displayedMuscles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-3xl text-slate-400">search_off</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    No se encontraron músculos
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs">
                    {searchQuery
                      ? `No hay coincidencias para "${searchQuery}". Intenta con otro término o selecciona otra sección en el mapa.`
                      : 'Esta región no contiene músculos registrados con los filtros actuales.'}
                  </p>
                </div>
              ) : (
                displayedMuscles.map((muscle) => {
                  const isChecked = selectedMuscleIds.has(muscle.id);
                  const muscleIcon = getMuscleIcon(muscle);

                  return (
                    <div
                      key={muscle.id}
                      onClick={() => handleToggleMuscle(muscle)}
                      className={`group relative flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-sky-500/10 border-sky-500/60 shadow-sm'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-sky-400 hover:shadow-md dark:hover:bg-slate-800'
                      }`}
                    >
                      {/* Checkbox for multi-mode */}
                      {selectionMode === 'multi' && (
                        <div className="pt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by container onClick
                            className="w-4 h-4 text-sky-600 rounded border-slate-300 dark:border-slate-600 focus:ring-sky-500 cursor-pointer"
                          />
                        </div>
                      )}

                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-600 group-hover:scale-105 transition-transform">
                        <MuscleIcon icon={muscleIcon} className="text-xl" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-sky-500 transition-colors">
                            {muscle.name}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                            {muscle.region}
                          </span>
                        </div>

                        <p className="text-xs italic text-slate-600 dark:text-slate-300 truncate mt-0.5">
                          {muscle.latinName}
                        </p>

                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 line-clamp-2 leading-tight">
                          {muscle.anatomy.function}
                        </p>

                        {/* Badges: Dosing & USG */}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-sky-500">medication</span>
                            Botox: {muscle.dosing.botox.min}-{muscle.dosing.botox.max} U
                          </span>
                          {muscle.usgGuidance && (
                            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">ultrasound</span>
                              USG
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Chevron / Select icon */}
                      <div className="self-center pl-1 text-slate-400 group-hover:text-sky-500 transition-colors">
                        <span className="material-symbols-outlined text-xl">
                          {selectionMode === 'multi' ? (isChecked ? 'check_circle' : 'add_circle') : 'chevron_right'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ===================================================================== */}
            {/* MODAL FOOTER ACTIONS */}
            {/* ===================================================================== */}
            <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex items-center justify-between gap-3">
              {selectionMode === 'multi' ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {selectedMuscleIds.size} seleccionados
                    </span>
                    {selectedMuscleIds.size > 0 && (
                      <button
                        onClick={() => setSelectedMuscleIds(new Set())}
                        className="text-xs text-rose-500 hover:underline font-semibold"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onClose}
                      className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmMultiSelect}
                      disabled={selectedMuscleIds.size === 0}
                      className="px-4 py-2 text-xs font-bold bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-md shadow-sky-500/25 transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      <span>Aplicar Selección</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={handleApplyRegionFilter}
                    className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">filter_alt</span>
                    Filtrar lista principal por "{activeRegionInfo.title}"
                  </button>

                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 transition-opacity"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BodyAnatomySelectorModal;
