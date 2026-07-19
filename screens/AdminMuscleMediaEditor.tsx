import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMuscleById } from '../data/muscleData';
import {
  deleteMuscleMedia,
  fetchMuscleMedia,
  uploadMuscleMediaImage,
  upsertMuscleMedia,
} from '../services/muscleMedia';
import type { MuscleMediaImageKind, USGView } from '../types/muscleMedia';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { getAuthUser } from '../utils/auth';

const USG_VIEWS: USGView[] = ['Transversal', 'Longitudinal', 'Ambas'];

const AdminMuscleMediaEditor: React.FC = () => {
  const navigate = useNavigate();
  const { muscleId } = useParams<{ muscleId: string }>();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const muscle = muscleId ? getMuscleById(muscleId) : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<MuscleMediaImageKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasRow, setHasRow] = useState(false);

  const [motorImageUrl, setMotorImageUrl] = useState<string | null>(null);
  const [usgImageUrl, setUsgImageUrl] = useState<string | null>(null);
  const [usgView, setUsgView] = useState<USGView>('Transversal');
  const [coordX, setCoordX] = useState<number | null>(null);
  const [coordY, setCoordY] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const motorInputRef = useRef<HTMLInputElement>(null);
  const usgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdmin || !muscle) return;
    let mounted = true;
    (async () => {
      try {
        const row = await fetchMuscleMedia(muscle.id);
        if (!mounted) return;
        if (row) {
          setHasRow(true);
          setMotorImageUrl(row.motor_point_image_url);
          setUsgImageUrl(row.usg_image_url);
          setUsgView((row.usg_view as USGView) || 'Transversal');
          setCoordX(row.motor_point_coord_x);
          setCoordY(row.motor_point_coord_y);
          setNotes(row.notes || '');
        } else {
          // Seed from static data so the admin sees the current defaults
          setUsgView((muscle.usgGuidance?.view as USGView) || 'Transversal');
          setCoordX(muscle.motorPoint.coordinates?.x ?? null);
          setCoordY(muscle.motorPoint.coordinates?.y ?? null);
        }
      } catch (err) {
        console.error('Error loading media:', err);
        if (mounted) setError('No se pudo cargar la información del músculo.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isAdmin, muscle]);

  const handleUpload = async (file: File, kind: MuscleMediaImageKind) => {
    if (!muscle) return;
    setUploading(kind);
    setError(null);
    setSuccess(null);
    try {
      const url = await uploadMuscleMediaImage(file, muscle.id, kind);
      if (kind === 'motor-point') setMotorImageUrl(url);
      else setUsgImageUrl(url);
      setSuccess('Imagen subida. No olvides guardar los cambios.');
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err?.message || 'Error al subir la imagen.');
    } finally {
      setUploading(null);
    }
  };

  const handleImageClickCoord = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCoordX(Math.round(x * 10) / 10);
    setCoordY(Math.round(y * 10) / 10);
  };

  const handleSave = async () => {
    if (!muscle) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Sesión no válida.');
      await upsertMuscleMedia(
        muscle.id,
        {
          motor_point_image_url: motorImageUrl,
          usg_image_url: usgImageUrl,
          usg_view: usgView,
          motor_point_coord_x: coordX,
          motor_point_coord_y: coordY,
          notes: notes.trim() || null,
        },
        user.id
      );
      setHasRow(true);
      setSuccess('Cambios guardados correctamente.');
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err?.message || 'Error al guardar. Verifica tus permisos de administrador.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!muscle || !hasRow) return;
    if (!window.confirm('¿Restablecer a los valores por defecto? Se eliminarán los medios personalizados de este músculo.')) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteMuscleMedia(muscle.id);
      setHasRow(false);
      setMotorImageUrl(null);
      setUsgImageUrl(null);
      setCoordX(muscle.motorPoint.coordinates?.x ?? null);
      setCoordY(muscle.motorPoint.coordinates?.y ?? null);
      setNotes('');
      setSuccess('Medios personalizados eliminados.');
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err?.message || 'Error al eliminar.');
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
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-6 text-center">
        <span className="material-symbols-outlined text-5xl text-red-500 mb-4">lock</span>
        <h2 className="text-lg font-bold text-text-main dark:text-white mb-1">Acceso restringido</h2>
        <p className="text-sm text-text-muted mb-6">Esta sección es solo para el administrador.</p>
        <button onClick={() => navigate('/settings')} className="px-5 py-2 bg-primary text-white rounded-xl font-bold">
          Volver a Ajustes
        </button>
      </div>
    );
  }

  if (!muscle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-6 text-center">
        <span className="material-symbols-outlined text-5xl text-slate-400 mb-4">error</span>
        <h2 className="text-lg font-bold text-text-main dark:text-white mb-4">Músculo no encontrado</h2>
        <button onClick={() => navigate('/admin/media')} className="px-5 py-2 bg-primary text-white rounded-xl font-bold">
          Volver
        </button>
      </div>
    );
  }

  const effectiveUsg = usgImageUrl || muscle.usgGuidance?.imageUrl || null;
  const effectiveMotor = motorImageUrl || muscle.motorPoint.imageUrl || null;

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-40">
      <header className="bg-white/90 dark:bg-surface-dark/90 backdrop-blur-md px-4 py-3 sticky top-0 z-20 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/media')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-text-main dark:text-white truncate">{muscle.name}</h1>
          <p className="text-xs text-text-muted italic truncate">{muscle.latinName}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 p-3 text-sm text-green-700 dark:text-green-300 flex items-start gap-2">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{success}</span>
              </div>
            )}

            {/* USG image + coordinate picker */}
            <section className="bg-white dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-blue-600">ultrasound</span>
                <h2 className="font-bold text-text-main dark:text-white">Ecografía (USG)</h2>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-slate-900 mb-3">
                {effectiveUsg ? (
                  <img
                    src={effectiveUsg}
                    alt="USG"
                    className="w-full max-h-[60vh] object-contain cursor-crosshair select-none"
                    onClick={handleImageClickCoord}
                    draggable={false}
                  />
                ) : (
                  <div className="aspect-video flex flex-col items-center justify-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl mb-1">add_photo_alternate</span>
                    <p className="text-xs">Sin imagen de ultrasonido</p>
                  </div>
                )}
                {effectiveUsg && coordX != null && coordY != null && (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `${coordX}%`, top: `${coordY}%` }}
                  >
                    <span className="absolute inline-flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary opacity-75" />
                    <div className="relative flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white border-2 border-white shadow-lg">
                      <span className="material-symbols-outlined text-[14px]">target</span>
                    </div>
                  </div>
                )}
              </div>

              {effectiveUsg && (
                <p className="text-[11px] text-text-muted mb-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">touch_app</span>
                  Toca la imagen para colocar el punto motor
                  {coordX != null && coordY != null && (
                    <span className="ml-1 font-bold text-primary">({coordX}%, {coordY}%)</span>
                  )}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => usgInputRef.current?.click()}
                  disabled={uploading === 'usg'}
                  className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-base">upload</span>
                  {uploading === 'usg' ? 'Subiendo...' : effectiveUsg ? 'Cambiar USG' : 'Subir USG'}
                </button>
                {coordX != null && coordY != null && (
                  <button
                    onClick={() => { setCoordX(null); setCoordY(null); }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold"
                  >
                    Quitar punto
                  </button>
                )}
              </div>
              <input
                ref={usgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, 'usg');
                  e.target.value = '';
                }}
              />

              <div>
                <label className="text-xs font-bold text-text-muted uppercase mb-1 block">Vista</label>
                <div className="flex gap-2">
                  {USG_VIEWS.map((v) => (
                    <button
                      key={v}
                      onClick={() => setUsgView(v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                        usgView === v
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Motor point (anatomy) image */}
            <section className="bg-white dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary">pin_drop</span>
                <h2 className="font-bold text-text-main dark:text-white">Imagen de Punto Motor (Anatomía)</h2>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3">
                {effectiveMotor ? (
                  <img src={effectiveMotor} alt="Punto motor" className="w-full max-h-[50vh] object-contain" />
                ) : (
                  <div className="aspect-video flex flex-col items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-1">add_photo_alternate</span>
                    <p className="text-xs">Sin imagen anatómica</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => motorInputRef.current?.click()}
                disabled={uploading === 'motor-point'}
                className="w-full px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-base">upload</span>
                {uploading === 'motor-point' ? 'Subiendo...' : effectiveMotor ? 'Cambiar imagen' : 'Subir imagen'}
              </button>
              <input
                ref={motorInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, 'motor-point');
                  e.target.value = '';
                }}
              />
            </section>

            {/* Admin notes */}
            <section className="bg-white dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-text-muted uppercase mb-2 block">Notas del administrador (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notas internas sobre estas imágenes..."
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border-none p-3 text-sm text-text-main dark:text-white focus:ring-2 focus:ring-primary resize-none"
              />
            </section>

            {hasRow && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="w-full px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm font-bold disabled:opacity-60"
              >
                Restablecer a valores por defecto
              </button>
            )}
          </>
        )}
      </main>

      {/* Sticky save bar */}
      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 lg:pl-64 p-4 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 z-30">
          <button
            onClick={handleSave}
            disabled={saving || uploading !== null}
            className="w-full py-3.5 bg-primary text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span className="material-symbols-outlined">save</span>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminMuscleMediaEditor;
