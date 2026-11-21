import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { musclesData } from '../../../data/muscleData';
import { usePathologies } from '../../../hooks/usePathologies';
import {
  deleteClinicalPearl,
  deleteProcedureVideo,
  fetchClinicalPearls,
  fetchProcedureVideos,
  upsertClinicalPearl,
  upsertProcedureVideo,
  type MuscleClinicalPearl,
  type ProcedureVideo,
} from '../../../services/premiumContent';

const PremiumCmsPanel: React.FC = () => {
  const navigate = useNavigate();
  const { pathologies, isCustomized } = usePathologies();
  const [subTab, setSubTab] = useState<'protocols' | 'media' | 'pearls' | 'videos'>('protocols');
  const [pearls, setPearls] = useState<MuscleClinicalPearl[]>([]);
  const [videos, setVideos] = useState<ProcedureVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pearlMuscleId, setPearlMuscleId] = useState(musclesData[0]?.id || '');
  const [pearlTitle, setPearlTitle] = useState('');
  const [pearlContent, setPearlContent] = useState('');
  const [pearlType, setPearlType] = useState<MuscleClinicalPearl['pearl_type']>('usg_tip');

  const [videoMuscleId, setVideoMuscleId] = useState(musclesData[0]?.id || '');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoCategory, setVideoCategory] = useState<ProcedureVideo['category']>('usg_guided');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, v] = await Promise.all([fetchClinicalPearls(), fetchProcedureVideos()]);
      setPearls(p); setVideos(v);
    } catch (err: any) { setError(err?.message || 'Error cargando contenido CMS Premium.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (subTab === 'pearls' || subTab === 'videos') load(); }, [subTab, load]);

  const handleAddPearl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pearlTitle.trim() || !pearlContent.trim()) return;
    try {
      await upsertClinicalPearl({ muscle_id: pearlMuscleId, title: pearlTitle.trim(), content: pearlContent.trim(), pearl_type: pearlType, required_tier: 'premium', is_published: true });
      setPearlTitle(''); setPearlContent(''); await load();
    } catch (err: any) { setError(err?.message || 'Error guardando perla clínica.'); }
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoTitle.trim()) return;
    try {
      await upsertProcedureVideo({ muscle_id: videoMuscleId || null, title: videoTitle.trim(), video_storage_path: videoUrl.trim() || null, category: videoCategory, required_tier: 'premium', is_published: true });
      setVideoTitle(''); setVideoUrl(''); await load();
    } catch (err: any) { setError(err?.message || 'Error guardando video.'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'protocols', label: 'Protocolos por Patología', icon: 'medical_information' },
          { id: 'media', label: 'Imágenes Punto Motor y USG', icon: 'photo_library' },
          { id: 'pearls', label: 'Perlas Clínicas Premium', icon: 'lightbulb' },
          { id: 'videos', label: 'Videos de Procedimientos', icon: 'video_library' },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => setSubTab(t.id as any)} className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${subTab === t.id ? 'bg-primary text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}>
            <span className="material-symbols-outlined text-base">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 p-3 text-xs font-bold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {subTab === 'protocols' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="font-black text-base">Editor de Protocolos de Patologías ({pathologies.length} patologías)</h4>
              <p className="text-xs text-slate-500 mt-1">
                Edita músculos, dosis sugeridas por marca (Botox, Dysport, Xeomin), patrones de espasticidad, variantes A/B/C, línea de tiempo y seguridad clínica.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/admin/pathologies/new')}
                className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                Nueva Patología
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/pathologies')}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-black flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
                Abrir Gestor Completo
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {pathologies.map((pat) => {
              const custom = isCustomized(pat.id);
              return (
                <div
                  key={pat.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm">{pat.title}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {pat.protocols.length} músculo{pat.protocols.length === 1 ? '' : 's'}
                      </span>
                      {custom && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Editado por Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {pat.subtitle} · Toxina: {pat.suggestedToxin}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/pathology/${pat.id}`)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Ver Ficha
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/pathologies/${pat.id}`)}
                      className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      Editar Protocolo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {subTab === 'media' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="font-black text-base">Editor de Medios por Músculo ({musclesData.length} músculos)</h4>
            <p className="text-xs text-slate-500 mt-1">Sube imágenes de ultrasonido (USG), coloca coordenadas interactivas de punto motor y edita notas clínicas por músculo.</p>
          </div>
          <button type="button" onClick={() => navigate('/admin/media')} className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-black flex items-center gap-2">
            <span className="material-symbols-outlined text-base">open_in_new</span>Abrir Gestor de Medios por Músculo
          </button>
        </div>
      )}
      {subTab === 'pearls' && (
        <div className="space-y-4">
          <form onSubmit={handleAddPearl} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h4 className="font-black text-sm">Nueva Perla Clínica (Solo Premium)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={pearlMuscleId} onChange={(e) => setPearlMuscleId(e.target.value)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold">
                {musclesData.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={pearlType} onChange={(e) => setPearlType(e.target.value as any)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold">
                <option value="usg_tip">Tip Ecográfico (USG)</option><option value="technique">Técnica de Inyección</option><option value="safety_warning">Advertencia de Seguridad</option><option value="dosing_tip">Tip de Dosificación</option><option value="pitfall">Error Frecuente</option>
              </select>
              <input required value={pearlTitle} onChange={(e) => setPearlTitle(e.target.value)} placeholder="Título breve" className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs" />
            </div>
            <textarea required rows={2} value={pearlContent} onChange={(e) => setPearlContent(e.target.value)} placeholder="Descripción clínica detallada..." className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-xs" />
            <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold">Publicar Perla Clínica</button>
          </form>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {loading ? <p className="p-6 text-center text-slate-400">Cargando...</p> : pearls.length === 0 ? <p className="p-6 text-center text-slate-400">Aún no hay perlas clínicas publicadas.</p> : pearls.map((p) => (
              <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                <div><span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 mr-2">{p.muscle_id}</span><strong className="text-sm">{p.title}</strong><p className="text-slate-500 mt-1">{p.content}</p></div>
                <button type="button" onClick={async () => { await deleteClinicalPearl(p.id); await load(); }} className="text-red-500 font-bold hover:underline shrink-0">Eliminar</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {subTab === 'videos' && (
        <div className="space-y-4">
          <form onSubmit={handleAddVideo} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h4 className="font-black text-sm">Registrar Video de Procedimiento (Solo Premium)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="Título del video" className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs" />
              <select value={videoMuscleId} onChange={(e) => setVideoMuscleId(e.target.value)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold">
                {musclesData.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={videoCategory} onChange={(e) => setVideoCategory(e.target.value as any)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold">
                <option value="usg_guided">Guía Ecográfica (USG)</option><option value="anatomical">Anatomía / Punto Motor</option><option value="reconstitution">Reconstitución / Dilución</option><option value="clinical_case">Caso Clínico</option>
              </select>
              <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Ruta Storage o ID Cloudflare Stream / Mux" className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-mono" />
            </div>
            <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold">Guardar Video</button>
          </form>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {videos.length === 0 ? <p className="p-6 text-center text-slate-400">Aún no hay videos registrados.</p> : videos.map((v) => (
              <div key={v.id} className="p-4 flex items-center justify-between gap-3">
                <div><p className="font-bold text-sm">{v.title}</p><p className="text-slate-400">{v.category} · {v.muscle_id || 'General'} · <code>{v.video_storage_path || 'Pendiente'}</code></p></div>
                <button type="button" onClick={async () => { await deleteProcedureVideo(v.id); await load(); }} className="text-red-500 font-bold hover:underline">Eliminar</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PremiumCmsPanel;
