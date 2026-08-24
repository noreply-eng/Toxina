import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  searchMuscles, 
  getMuscleIcon,
  MuscleData,
  getMusclesByCategory
} from '../data/muscleData';
import MuscleIcon from '../components/MuscleIcon';
import BodyAnatomySVG from '../components/anatomy/BodyAnatomySVG';
import { 
  BodyRegionKey, 
  AnatomyView,
  bodyRegionsDatabase,
  getBodyRegionByKey,
  getBodyRegionsByView,
  getMusclesForRegion
} from '../data/bodyAnatomyData';

const MuscleList: React.FC = () => {
  const navigate = useNavigate();

  const [currentView, setCurrentView] = useState<AnatomyView>('front');
  const [selectedRegionKey, setSelectedRegionKey] = useState<BodyRegionKey>('pecho');
  const [hoveredRegionKey, setHoveredRegionKey] = useState<BodyRegionKey | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [svgZoom, setSvgZoom] = useState<number>(1);
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');

  // Categories list
  const categories = [
    { id: 'all', label: 'Todos', icon: 'apps' },
    { id: 'face', label: 'Cara', icon: 'face' },
    { id: 'neck', label: 'Cuello', icon: 'accessibility' },
    { id: 'upper-limb', label: 'M. Superior', icon: 'back_hand' },
    { id: 'trunk', label: 'Tronco', icon: 'accessibility_new' },
    { id: 'lower-limb', label: 'M. Inferior', icon: 'directions_walk' },
  ];

  // Auto-switch view and reset category when selecting an anatomical region
  const handleSelectRegion = useCallback((regionKey: BodyRegionKey) => {
    setSelectedRegionKey(regionKey);
    setSelectedCategoryFilter('all'); // Reset category filter so muscles of the selected region are always shown
    const info = getBodyRegionByKey(regionKey);
    if (info && !info.views.includes(currentView)) {
      setCurrentView(info.views[0]);
    }
  }, [currentView]);

  // Handle view switch
  const handleSwitchView = (newView: AnatomyView) => {
    setCurrentView(newView);
    const availableInNewView = getBodyRegionsByView(newView);
    const isCurrentInView = availableInNewView.some((r) => r.key === selectedRegionKey);
    if (!isCurrentInView && availableInNewView.length > 0) {
      setSelectedRegionKey(availableInNewView[0].key);
      setSelectedCategoryFilter('all');
    }
  };

  // When clicking a category filter, if not 'all', select a representative region or show category muscles
  const handleCategoryFilterClick = (catId: string) => {
    setSelectedCategoryFilter(catId);
    if (catId === 'face') {
      setSelectedRegionKey('cabeza');
      if (currentView !== 'front') setCurrentView('front');
    } else if (catId === 'neck') {
      setSelectedRegionKey('cuello');
    } else if (catId === 'upper-limb') {
      if (!['hombros', 'pecho', 'brazos', 'triceps', 'antebrazos', 'dorsales', 'trapecio'].includes(selectedRegionKey)) {
        setSelectedRegionKey('hombros');
      }
    } else if (catId === 'trunk') {
      setSelectedRegionKey('abdomen');
      if (currentView !== 'front') setCurrentView('front');
    } else if (catId === 'lower-limb') {
      if (!['pelvis', 'gluteos', 'cuadriceps', 'isquiotibiales', 'pantorrillas'].includes(selectedRegionKey)) {
        setSelectedRegionKey('cuadriceps');
        if (currentView !== 'front') setCurrentView('front');
      }
    }
  };

  // Active region info
  const activeRegionInfo = useMemo(() => {
    return getBodyRegionByKey(selectedRegionKey) || bodyRegionsDatabase.pecho;
  }, [selectedRegionKey]);

  // Regions available in current view
  const currentViewRegions = useMemo(() => {
    return getBodyRegionsByView(currentView);
  }, [currentView]);

  // Filtered muscles based on search, region and category
  const displayedMuscles = useMemo(() => {
    let list: MuscleData[] = [];

    if (searchQuery.trim()) {
      list = searchMuscles(searchQuery);
    } else {
      list = getMusclesForRegion(selectedRegionKey);
    }

    // If user explicitly picked a category and is searching or looking at all
    if (selectedCategoryFilter !== 'all') {
      const categoryMuscles = getMusclesByCategory(selectedCategoryFilter as MuscleData['category']);
      const categoryIds = new Set(categoryMuscles.map((m) => m.id));
      const filtered = list.filter((m) => categoryIds.has(m.id));
      // If region has muscles matching the category, show them; otherwise show all category muscles
      if (filtered.length > 0) {
        list = filtered;
      } else if (searchQuery.trim()) {
        list = filtered;
      } else {
        // Fallback: show the category's muscles
        list = categoryMuscles;
      }
    }

    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
  }, [searchQuery, selectedRegionKey, selectedCategoryFilter]);

  // Format dosing display
  const formatDoseRange = (muscle: MuscleData): string => {
    const botoxDose = muscle.dosing.botox;
    return `${botoxDose.min}-${botoxDose.max} U`;
  };

  const getCategoryColor = (category: MuscleData['category']) => {
    switch (category) {
      case 'face':
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20',
          badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        };
      case 'neck':
        return {
          bg: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/20',
          badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
        };
      case 'upper-limb':
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20',
          badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
        };
      case 'lower-limb':
        return {
          bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        };
      case 'trunk':
        return {
          bg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20',
          badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
        };
      default:
        return {
          bg: 'bg-primary/10 text-primary border-primary/20',
          badge: 'bg-primary/10 text-primary'
        };
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-28 lg:pb-12">
      {/* ========================================================================= */}
      {/* HEADER */}
      {/* ========================================================================= */}
      <header className="bg-white dark:bg-surface-dark px-4 sm:px-6 pt-12 pb-3 sticky top-0 z-20 shadow-sm border-b border-slate-200/80 dark:border-slate-800 backdrop-blur-md bg-white/95 dark:bg-slate-900/95">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-main dark:text-white">
                Explorador Anatómico Corporal
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                {displayedMuscles.length} {displayedMuscles.length === 1 ? 'músculo' : 'músculos'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Selecciona cualquier sección en el modelo anatómico para filtrar y explorar los músculos clínicos
            </p>
          </div>

          {/* Mobile Tab Switcher */}
          <div className="flex md:hidden bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setMobileTab('map')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                mobileTab === 'map'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">accessibility_new</span>
              <span>Mapa SVG</span>
            </button>
            <button
              onClick={() => setMobileTab('list')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                mobileTab === 'list'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">format_list_bulleted</span>
              <span>Lista ({displayedMuscles.length})</span>
            </button>
          </div>
        </div>

        {/* Horizontal Quick Region Chips */}
        <div className="max-w-7xl mx-auto mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">tune</span>
            Zonas:
          </span>
          {currentViewRegions.map((region) => {
            const isSelected = selectedRegionKey === region.key && !searchQuery.trim();
            return (
              <button
                key={region.key}
                onClick={() => {
                  setSearchQuery('');
                  handleSelectRegion(region.key);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-[1.02]'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-400/50 hover:bg-sky-50/50 dark:hover:bg-slate-700/50'
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
      </header>

      {/* ========================================================================= */}
      {/* MAIN BODY: 2-COLUMN SPLIT LAYOUT */}
      {/* ========================================================================= */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 items-start">
          
          {/* --------------------------------------------------------------------- */}
          {/* LEFT PANEL: INTERACTIVE ANATOMICAL BODY SVG */}
          {/* --------------------------------------------------------------------- */}
          <div
            className={`md:col-span-5 lg:col-span-5 bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm md:sticky md:top-36 flex-col items-center justify-between relative overflow-hidden ${
              mobileTab === 'list' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* View Switcher & Zoom Controls Bar */}
            <div className="w-full flex items-center justify-between z-10 gap-2 mb-2">
              <div className="flex bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <button
                  onClick={() => handleSwitchView('front')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <button
                  onClick={() => setSvgZoom((z) => Math.max(0.8, z - 0.15))}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-sky-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Alejar"
                >
                  <span className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <span className="text-[11px] font-bold px-1 text-slate-500 min-w-[34px] text-center">
                  {Math.round(svgZoom * 100)}%
                </span>
                <button
                  onClick={() => setSvgZoom((z) => Math.min(1.6, z + 0.15))}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-sky-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Acercar"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
                {svgZoom !== 1 && (
                  <button
                    onClick={() => setSvgZoom(1)}
                    className="px-1.5 h-7 text-[10px] font-bold text-sky-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                    title="Restablecer escala original"
                  >
                    1:1
                  </button>
                )}
              </div>
            </div>

            {/* Interactive SVG Body */}
            <div className="w-full flex-1 flex items-center justify-center relative min-h-[380px] max-h-[560px] my-2">
              <BodyAnatomySVG
                view={currentView}
                selectedRegion={selectedRegionKey}
                hoveredRegion={hoveredRegionKey}
                onSelectRegion={(reg) => {
                  setSearchQuery('');
                  handleSelectRegion(reg);
                }}
                onHoverRegion={setHoveredRegionKey}
                zoom={svgZoom}
                className="w-full h-full"
              />
            </div>

            {/* Bottom helper text */}
            <div className="w-full flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                <span className="material-symbols-outlined text-[14px] text-sky-500">touch_app</span>
                Toca cualquier sección corporal
              </span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Vista: {currentView === 'front' ? 'Ventral / Anterior' : 'Dorsal / Posterior'}
              </span>
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* RIGHT PANEL: SEARCH, CATEGORIES & MUSCLE DETAILS */}
          {/* --------------------------------------------------------------------- */}
          <div
            className={`md:col-span-7 lg:col-span-7 flex flex-col gap-3.5 ${
              mobileTab === 'map' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Search Input Bar */}
            <div className="bg-white dark:bg-surface-dark p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-3">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-[20px]">search</span>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar músculo por nombre, latín o función clínica..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl py-3 pl-10 pr-9 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
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
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {categories.map((cat) => {
                  const isCatSelected = selectedCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryFilterClick(cat.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        isCatSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Region Clinical Summary Header (when not searching) */}
            {!searchQuery.trim() && activeRegionInfo && (
              <div className="p-4 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-slate-900 border border-sky-200/60 dark:border-sky-800/40 rounded-2xl flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    <span className="material-symbols-outlined text-[15px]">{activeRegionInfo.icon}</span>
                    {activeRegionInfo.tag}
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-sky-200/50 dark:border-slate-700">
                    {displayedMuscles.length} registrados
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {activeRegionInfo.title}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {activeRegionInfo.desc}
                </p>
                {activeRegionInfo.clinicalFocus.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {activeRegionInfo.clinicalFocus.slice(0, 2).map((focus, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700"
                      >
                        <span className="material-symbols-outlined text-[12px] text-sky-500">check_circle</span>
                        {focus}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Muscle Cards List */}
            <div className="space-y-2.5">
              {displayedMuscles.length === 0 ? (
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-3xl text-slate-400">search_off</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                    No se encontraron músculos
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    {searchQuery
                      ? `No hay coincidencias para "${searchQuery}". Intenta con otro término o selecciona otra sección en el mapa anatómico.`
                      : 'Esta región no contiene músculos registrados con los filtros seleccionados.'}
                  </p>
                </div>
              ) : (
                displayedMuscles.map((muscle) => {
                  const colors = getCategoryColor(muscle.category);
                  const muscleIcon = getMuscleIcon(muscle);

                  return (
                    <div
                      key={muscle.id}
                      onClick={() => navigate(`/motor-points/${muscle.id}`)}
                      className="group relative flex items-start gap-3.5 p-3.5 sm:p-4 bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm hover:border-sky-400/80 hover:shadow-md dark:hover:bg-slate-800/90 transition-all cursor-pointer"
                    >
                      {/* Muscle Icon */}
                      <div className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center ${colors.bg} transition-transform group-hover:scale-105 border border-slate-200/40 dark:border-slate-700/50`}>
                        <MuscleIcon icon={muscleIcon} className="text-2xl" />
                      </div>

                      {/* Muscle Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate group-hover:text-sky-500 transition-colors">
                            {muscle.name}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${colors.badge}`}>
                            {muscle.category === 'face' && 'Cara'}
                            {muscle.category === 'neck' && 'Cuello'}
                            {muscle.category === 'upper-limb' && 'M. Superior'}
                            {muscle.category === 'lower-limb' && 'M. Inferior'}
                            {muscle.category === 'trunk' && 'Tronco'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="italic truncate">{muscle.latinName}</span>
                          {muscle.region && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="truncate text-slate-400 dark:text-slate-500 font-medium">
                                {muscle.region}
                              </span>
                            </>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
                          {muscle.anatomy.function}
                        </p>

                        {/* Badges: Dosing & USG */}
                        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-slate-400">medical_services</span>
                            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              Botox: {formatDoseRange(muscle)}
                            </p>
                          </div>
                          {muscle.usgGuidance && (
                            <div className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-sky-500">ultrasound</span>
                              <p className="text-[11px] font-bold text-sky-500 uppercase tracking-wide">
                                Guía USG
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Chevron */}
                      <span className="material-symbols-outlined self-center text-slate-300 dark:text-slate-600 group-hover:text-sky-500 group-hover:translate-x-1 transition-all text-2xl">
                        chevron_right
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MuscleList;
