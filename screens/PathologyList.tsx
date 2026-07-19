import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pathologiesData, PathologyData } from '../data/pathologyData';
import {
  getFavoritePathologies,
  getRecentPathologies,
  toggleFavoritePathology,
} from '../utils/pathologyPrefs';

// Placeholder profesional (SVG en data URI) para imágenes que fallan al cargar.
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#e2e8f0'/><stop offset='100%' stop-color='#cbd5e1'/>
      </linearGradient></defs>
      <rect width='400' height='400' fill='url(#g)'/>
      <g fill='none' stroke='#94a3b8' stroke-width='14' stroke-linecap='round' stroke-linejoin='round'>
        <path d='M232 150 L250 168 M150 232 L232 150 L250 168 L168 250 Z'/>
        <path d='M150 232 L132 250 M250 168 L286 132'/>
      </g>
    </svg>`
  );

type CategoryKey = PathologyData['category'];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  neurological: 'Neurológicas',
  autonomic: 'Autonómicas',
  urological: 'Urológicas',
  aesthetic: 'Estéticas',
};

const CATEGORY_ORDER: CategoryKey[] = ['neurological', 'autonomic', 'urological', 'aesthetic'];

const PathologyList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey | 'all'>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(getFavoritePathologies());
    setRecents(getRecentPathologies());
  }, []);

  const handleToggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites(toggleFavoritePathology(id));
  };

  const showQuickAccess = !searchQuery.trim() && categoryFilter === 'all';
  const favoritePathologies = useMemo(
    () => favorites.map((id) => pathologiesData.find((p) => p.id === id)).filter(Boolean) as PathologyData[],
    [favorites]
  );
  const recentPathologies = useMemo(
    () => recents.map((id) => pathologiesData.find((p) => p.id === id)).filter(Boolean) as PathologyData[],
    [recents]
  );

  const filteredPathologies = useMemo(() => {
    let result = pathologiesData;

    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.subtitle.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.suggestedToxin.toLowerCase().includes(query) ||
        p.protocols.some(pr => (pr.muscle || '').toLowerCase().includes(query))
      );
    }

    return result;
  }, [searchQuery, categoryFilter]);

  // Group by clinical category (real categories, ordered)
  const categories = useMemo<Record<string, PathologyData[]>>(() => {
    const grouped: Record<string, PathologyData[]> = {};
    filteredPathologies.forEach(p => {
      const cat = CATEGORY_LABELS[p.category] || 'Otras';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    // Return in a stable clinical order
    const ordered: Record<string, PathologyData[]> = {};
    CATEGORY_ORDER.forEach(key => {
      const label = CATEGORY_LABELS[key];
      if (grouped[label]) ordered[label] = grouped[label];
    });
    return ordered;
  }, [filteredPathologies]);

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = {
      neurological: 0,
      autonomic: 0,
      urological: 0,
      aesthetic: 0,
    };
    pathologiesData.forEach(p => { counts[p.category] += 1; });
    return counts;
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="bg-white dark:bg-surface-dark px-4 pb-4 pt-12 sticky top-0 z-10 shadow-sm border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight text-text-main dark:text-white">
              Patologías
            </h1>
            <p className="text-xs text-text-muted">{filteredPathologies.length} patologías disponibles</p>
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="material-symbols-outlined text-lg">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="material-symbols-outlined text-lg">view_list</span>
            </button>
          </div>
        </div>

        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input 
            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-slate-700 transition-all" 
            placeholder="Buscar patología, músculo o toxina..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar -mx-1 px-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              categoryFilter === 'all'
                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Todas ({pathologiesData.length})
          </button>
          {CATEGORY_ORDER.map(key => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                categoryFilter === key
                  ? 'bg-primary text-white shadow-sm shadow-primary/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {CATEGORY_LABELS[key]} ({categoryCounts[key]})
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-32 px-4 py-6">
        {/* Acceso rápido: favoritos y recientes */}
        {showQuickAccess && (favoritePathologies.length > 0 || recentPathologies.length > 0) && (
          <div className="space-y-6 mb-8">
            {favoritePathologies.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined material-symbols-filled text-amber-400 text-lg">star</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Favoritos</h3>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
                  {favoritePathologies.map((path) => (
                    <button
                      key={path.id}
                      onClick={() => navigate(`/pathology/${path.id}`)}
                      className="shrink-0 w-40 text-left bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-all p-3"
                    >
                      <div className="flex items-start justify-between">
                        <span className="material-symbols-outlined text-primary">medical_information</span>
                        <span
                          onClick={(e) => handleToggleFavorite(e, path.id)}
                          className="material-symbols-outlined material-symbols-filled text-amber-400 text-[18px]"
                        >
                          star
                        </span>
                      </div>
                      <p className="font-bold text-sm text-text-main dark:text-white mt-2 line-clamp-2">{path.title}</p>
                      <p className="text-[11px] text-text-muted truncate mt-0.5">{path.subtitle}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {recentPathologies.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary text-lg">history</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Recientes</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
                  {recentPathologies.map((path) => (
                    <button
                      key={path.id}
                      onClick={() => navigate(`/pathology/${path.id}`)}
                      className="shrink-0 px-3 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      {path.title}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {filteredPathologies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-slate-400">search_off</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">No se encontraron patologías</h3>
            <p className="text-xs text-slate-500 text-center">Intenta con otro término de búsqueda.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {(Object.entries(categories) as [string, PathologyData[]][]).map(([category, pathologies]) => (
              <section key={category}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">{category}</h3>
                  <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                    {pathologies.length}
                  </span>
                </div>
                
                {viewMode === 'grid' ? (
                  /* GRID VIEW - Using flex wrap instead of CSS grid for better compatibility */
                  <div className="flex flex-wrap gap-4">
                    {pathologies.map((path) => (
                      <div 
                        key={path.id}
                        onClick={() => navigate(`/pathology/${path.id}`)}
                        className="bg-white dark:bg-surface-dark rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer active:scale-95"
                        style={{ width: 'calc(50% - 8px)', minWidth: '140px', maxWidth: '200px' }}
                      >
                        {/* Image */}
                        <div className="w-full relative" style={{ aspectRatio: '1' }}>
                          <img 
                            src={path.image} 
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" 
                            alt={path.title}
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER;
                            }}
                          />
                          <button
                            onClick={(e) => handleToggleFavorite(e, path.id)}
                            className="absolute top-2 right-2 size-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                            title={favorites.includes(path.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                          >
                            <span className={`material-symbols-outlined text-[18px] ${favorites.includes(path.id) ? 'material-symbols-filled text-amber-400' : ''}`}>
                              {favorites.includes(path.id) ? 'star' : 'star_border'}
                            </span>
                          </button>
                        </div>
                        {/* Content */}
                        <div className="p-3">
                          <p className="font-bold text-sm text-text-main dark:text-white" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {path.title}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-text-muted truncate flex-1">{path.subtitle}</p>
                            <span className="material-symbols-outlined text-primary text-base ml-1">arrow_forward</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* LIST VIEW */
                  <div className="space-y-2">
                    {pathologies.map((path) => (
                      <div 
                        key={path.id}
                        onClick={() => navigate(`/pathology/${path.id}`)}
                        className="bg-white dark:bg-surface-dark rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer flex items-center gap-4 p-3"
                      >
                        <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                          <img 
                            src={path.image} 
                            className="w-full h-full object-cover" 
                            alt={path.title}
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER;
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-text-main dark:text-white truncate">{path.title}</p>
                          <p className="text-xs text-text-muted truncate mt-0.5">{path.subtitle}</p>
                          <p className="text-xs text-slate-400 truncate mt-1">{path.description}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => handleToggleFavorite(e, path.id)}
                            className="size-8 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={favorites.includes(path.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                          >
                            <span className={`material-symbols-outlined text-[19px] ${favorites.includes(path.id) ? 'material-symbols-filled text-amber-400' : 'text-slate-300'}`}>
                              {favorites.includes(path.id) ? 'star' : 'star_border'}
                            </span>
                          </button>
                          <span className="material-symbols-outlined text-primary">arrow_forward</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PathologyList;
