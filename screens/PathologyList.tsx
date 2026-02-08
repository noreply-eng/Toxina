import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { pathologiesData, PathologyData } from '../data/pathologyData';

const PathologyList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const filteredPathologies = useMemo(() => {
    if (!searchQuery.trim()) return pathologiesData;
    const query = searchQuery.toLowerCase();
    return pathologiesData.filter(p => 
      p.title.toLowerCase().includes(query) || 
      p.subtitle.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Group by category
  const categories = useMemo(() => {
    const grouped: Record<string, PathologyData[]> = {};
    filteredPathologies.forEach(p => {
      const cat = p.subtitle || 'Otros';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  }, [filteredPathologies]);

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
            placeholder="Buscar patología..."
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
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-32 px-4 py-6">
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
            {Object.entries(categories).map(([category, pathologies]) => (
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
                        <div className="w-full" style={{ aspectRatio: '1' }}>
                          <img 
                            src={path.image} 
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" 
                            alt={path.title}
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400';
                            }}
                          />
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
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400';
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-text-main dark:text-white truncate">{path.title}</p>
                          <p className="text-xs text-text-muted truncate mt-0.5">{path.subtitle}</p>
                          <p className="text-xs text-slate-400 truncate mt-1">{path.description}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-primary font-medium hidden sm:block">Ver detalles</span>
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
