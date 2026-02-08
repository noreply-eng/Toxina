import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { musclesData, searchMuscles, getMusclesByCategory, MuscleData } from '../data/muscleData';

const MuscleList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Todos');

  const categories = ['Todos', 'Cara', 'Cuello', 'Miembro Superior', 'Miembro Inferior'];

  // Category to internal category mapping
  const categoryMap: Record<string, MuscleData['category'] | 'all'> = {
    'Todos': 'all',
    'Cara': 'face',
    'Cuello': 'neck',
    'Miembro Superior': 'upper-limb',
    'Miembro Inferior': 'lower-limb'
  };

  // Filtered muscles based on search and category
  const filteredMuscles = useMemo(() => {
    let muscles = musclesData;

    // Apply category filter
    if (filter !== 'Todos') {
      const internalCategory = categoryMap[filter];
      if (internalCategory && internalCategory !== 'all') {
        muscles = getMusclesByCategory(internalCategory);
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      muscles = searchMuscles(searchQuery);
      
      // If also filtering by category, intersect results
      if (filter !== 'Todos') {
        const categoryFiltered = getMusclesByCategory(categoryMap[filter] as MuscleData['category']);
        const categoryIds = new Set(categoryFiltered.map(m => m.id));
        muscles = muscles.filter(m => categoryIds.has(m.id));
      }
    }

    return muscles;
  }, [searchQuery, filter]);

  // Get icon for muscle category
  const getCategoryIcon = (category: MuscleData['category']): string => {
    const iconMap: Record<MuscleData['category'], string> = {
      'face': 'face',
      'neck': 'accessibility',
      'upper-limb': 'pan_tool',
      'lower-limb': 'directions_walk',
      'trunk': 'accessibility_new'
    };
    return iconMap[category] || 'accessibility';
  };

  // Format dosing display
  const formatDoseRange = (muscle: MuscleData): string => {
    const botoxDose = muscle.dosing.botox;
    return `${botoxDose.min}-${botoxDose.max} U`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
      <header className="bg-white dark:bg-surface-dark px-4 pb-2 pt-12 sticky top-0 z-10 shadow-sm border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-text-main dark:text-white">
            Puntos Motores
          </h1>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-[10px] font-bold bg-primary/10 text-primary rounded">
              {filteredMuscles.length} {filteredMuscles.length === 1 ? 'músculo' : 'músculos'}
            </span>
          </div>
        </div>

        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input 
            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-slate-700 transition-all" 
            placeholder="Buscar músculo (español o latín)..."
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

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="flex gap-2 px-4 py-4 overflow-x-auto hide-scrollbar sticky top-0 z-0 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm">
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setFilter(cat)}
              className={`${
                filter === cat ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              } px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filteredMuscles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl text-slate-400">search_off</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              No se encontraron músculos
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs">
              Intenta con otro término de búsqueda o cambia el filtro de categoría
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex flex-col gap-3 px-4">
              {filteredMuscles.map((muscle) => (
                <div 
                  key={muscle.id}
                  onClick={() => navigate(`/motor-points/${muscle.id}`)}
                  className="group flex items-center p-3 bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center text-primary/80">
                    <span className="material-symbols-outlined text-3xl">{getCategoryIcon(muscle.category)}</span>
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate text-sm">{muscle.name}</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase shrink-0">
                        {muscle.category === 'face' && 'Cara'}
                        {muscle.category === 'neck' && 'Cuello'}
                        {muscle.category === 'upper-limb' && 'M. Superior'}
                        {muscle.category === 'lower-limb' && 'M. Inferior'}
                        {muscle.category === 'trunk' && 'Tronco'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 italic truncate">{muscle.latinName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-slate-400">medical_services</span>
                        <p className="text-[10px] font-medium text-slate-400">Botox: {formatDoseRange(muscle)}</p>
                      </div>
                      {muscle.usgGuidance && (
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-blue-500">ultrasound</span>
                          <p className="text-[10px] font-medium text-blue-500">USG disponible</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined ml-2 text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MuscleList;
