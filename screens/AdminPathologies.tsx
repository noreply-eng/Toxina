import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getPathologyPatterns,
  getPathologyProtocolVariants,
  type PathologyData,
} from '../data/pathologyData';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { usePathologies } from '../hooks/usePathologies';

type CategoryKey = PathologyData['category'];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  neurological: 'Neurológicas',
  autonomic: 'Autonómicas',
  urological: 'Urológicas',
  aesthetic: 'Estéticas',
};

const CATEGORY_BADGES: Record<CategoryKey, string> = {
  neurological: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  autonomic: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  urological: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  aesthetic: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

const CATEGORY_ORDER: CategoryKey[] = ['neurological', 'autonomic', 'urological', 'aesthetic'];

const AdminPathologies: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { pathologies, isCustomized, isBuiltIn, loading } = usePathologies();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey | 'all'>('all');

  const filtered = useMemo(() => {
    let list = [...pathologies];
    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.suggestedToxin.toLowerCase().includes(q) ||
          p.protocols.some(
            (pr) =>
              (pr.muscle || '').toLowerCase().includes(q) ||
              (pr.muscleName || '').toLowerCase().includes(q)
          )
      );
    }
    return list;
  }, [pathologies, categoryFilter, searchQuery]);

  const customizedCount = useMemo(
    () => pathologies.filter((p) => isCustomized(p.id)).length,
    [pathologies, isCustomized]
  );

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

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
      <header className="bg-white dark:bg-surface-dark px-4 pb-4 pt-12 sticky top-0 z-10 shadow-sm border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-text-main dark:text-white flex items-center gap-2 flex-wrap">
                Editor de Protocolos por Patología
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 uppercase">
                  Admin
                </span>
              </h1>
              <p className="text-xs text-text-muted">
                {pathologies.length} patologías · {customizedCount} personalizada{customizedCount === 1 ? '' : 's'} por Admin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/pathologies/new')}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Nueva Patología
          </button>
        </div>

        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-primary transition-all text-sm"
            placeholder="Buscar patología, músculo o toxina..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar -mx-1 px-1">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Todas ({pathologies.length})
          </button>
          {CATEGORY_ORDER.map((key) => {
            const count = pathologies.filter((p) => p.category === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  categoryFilter === key
                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {CATEGORY_LABELS[key]} ({count})
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32 px-4 py-4">
        {loading && pathologies.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">search_off</span>
            <p className="text-sm font-bold text-text-main dark:text-white">No se encontraron patologías</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((pathology) => {
              const custom = isCustomized(pathology.id);
              const builtIn = isBuiltIn(pathology.id);
              const variants = getPathologyProtocolVariants(pathology.id);
              const patterns = getPathologyPatterns(pathology.id);

              return (
                <div
                  key={pathology.id}
                  onClick={() => navigate(`/admin/pathologies/${pathology.id}`)}
                  className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:border-primary/40 hover:shadow-md transition-all flex items-center gap-3.5 p-3.5 cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {pathology.image ? (
                      <img
                        src={pathology.image}
                        alt={pathology.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-slate-400">medical_information</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm sm:text-base text-text-main dark:text-white truncate">
                        {pathology.title}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${CATEGORY_BADGES[pathology.category]}`}>
                        {CATEGORY_LABELS[pathology.category]}
                      </span>
                      {custom && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[12px]">edit</span>
                          {builtIn ? 'Editado' : 'Personalizada'}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-text-muted truncate mt-0.5">{pathology.subtitle}</p>

                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">vaccines</span>
                        {pathology.protocols.length} músculo{pathology.protocols.length === 1 ? '' : 's'}
                      </span>
                      {variants.length > 1 && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">tune</span>
                          Variantes: {variants.join(' / ')}
                        </span>
                      )}
                      {patterns.length > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">category</span>
                          {patterns.length} patrones
                        </span>
                      )}
                      <span className="truncate">Toxina: {pathology.suggestedToxin}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/pathology/${pathology.id}`);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Ver ficha clínica"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      <span className="hidden sm:inline">Ver</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/pathologies/${pathology.id}`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      <span>Editar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPathologies;
