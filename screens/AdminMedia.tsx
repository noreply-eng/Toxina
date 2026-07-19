import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { musclesData, MuscleData } from '../data/muscleData';
import { fetchAllMuscleMedia } from '../services/muscleMedia';
import type { MuscleMedia } from '../types/muscleMedia';
import { useIsAdmin } from '../hooks/useIsAdmin';

const CATEGORY_LABELS: Record<MuscleData['category'], string> = {
  face: 'Cara',
  neck: 'Cuello',
  'upper-limb': 'M. Superior',
  'lower-limb': 'M. Inferior',
  trunk: 'Tronco',
};

const AdminMedia: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [media, setMedia] = useState<Record<string, MuscleMedia>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    let mounted = true;
    (async () => {
      try {
        const data = await fetchAllMuscleMedia();
        if (mounted) setMedia(data);
      } catch (err) {
        console.error('Error loading muscle media:', err);
        if (mounted) setError('No se pudo cargar la información de medios.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  const filteredMuscles = useMemo(() => {
    const list = [...musclesData].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.latinName.toLowerCase().includes(q) ||
        m.region.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const configuredCount = Object.keys(media).length;

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-6 text-center">
        <span className="material-symbols-outlined text-5xl text-red-500 mb-4">lock</span>
        <h2 className="text-lg font-bold text-text-main dark:text-white mb-1">Acceso restringido</h2>
        <p className="text-sm text-text-muted mb-6">Esta sección es solo para el administrador.</p>
        <button
          onClick={() => navigate('/settings')}
          className="px-5 py-2 bg-primary text-white rounded-xl font-bold"
        >
          Volver a Ajustes
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
      <header className="bg-white dark:bg-surface-dark px-4 pb-3 pt-12 sticky top-0 z-10 shadow-sm border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-text-main dark:text-white flex items-center gap-2">
              Gestión de Medios
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 uppercase">
                Admin
              </span>
            </h1>
            <p className="text-xs text-text-muted">
              {configuredCount} de {musclesData.length} músculos con medios personalizados
            </p>
          </div>
        </div>

        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-primary transition-all"
            placeholder="Buscar músculo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32 px-4 py-4">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMuscles.map((muscle) => {
              const m = media[muscle.id];
              const hasMotor = !!(m?.motor_point_image_url) || !!muscle.motorPoint.imageUrl;
              const hasUsg = !!(m?.usg_image_url) || !!muscle.usgGuidance?.imageUrl;
              const isCustom = !!m;
              return (
                <button
                  key={muscle.id}
                  onClick={() => navigate(`/admin/media/${muscle.id}`)}
                  className="w-full text-left bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:shadow-md transition-all flex items-center gap-3 p-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {m?.usg_image_url || m?.motor_point_image_url ? (
                      <img
                        src={(m.usg_image_url || m.motor_point_image_url) as string}
                        alt={muscle.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-slate-400">image</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-text-main dark:text-white truncate">{muscle.name}</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase shrink-0">
                        {CATEGORY_LABELS[muscle.category]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 italic truncate">{muscle.latinName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${hasMotor ? 'text-green-600' : 'text-slate-400'}`}>
                        <span className="material-symbols-outlined text-[13px]">{hasMotor ? 'check_circle' : 'radio_button_unchecked'}</span>
                        Punto motor
                      </span>
                      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${hasUsg ? 'text-blue-600' : 'text-slate-400'}`}>
                        <span className="material-symbols-outlined text-[13px]">{hasUsg ? 'check_circle' : 'radio_button_unchecked'}</span>
                        USG
                      </span>
                      {isCustom && (
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[13px]">edit</span>
                          Personalizado
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminMedia;
