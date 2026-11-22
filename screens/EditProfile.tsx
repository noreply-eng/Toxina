import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { useEntitlements } from '../features/entitlements/EntitlementContext';
import {
  ORIGIN_LABELS,
  TIER_LABELS,
  type SubscriptionTier,
} from '../features/entitlements/planCatalog';
import {
  persistPracticeProfileMeta,
  resolvePracticeMeta,
  type PracticeType,
} from '../services/onboardingService';

interface ProfileRouteState {
  fromSignup?: boolean;
  selectedPlanTier?: SubscriptionTier;
  selectedPlanName?: string;
  practiceType?: PracticeType;
  clinicTeamSize?: number;
  clinicName?: string;
  warning?: string;
}

const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { entitlements, effectiveTier, refresh: refreshEntitlements } = useEntitlements();

  const routeState = (location.state as ProfileRouteState | null) || null;
  const isWelcomeFlow = searchParams.get('welcome') === '1' || Boolean(routeState?.fromSignup);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [generalLicense, setGeneralLicense] = useState('');
  const [specialistLicense, setSpecialistLicense] = useState('');
  const [practiceType, setPracticeType] = useState<PracticeType>(
    routeState?.practiceType || 'individual'
  );
  const [clinicTeamSize, setClinicTeamSize] = useState<number>(
    routeState?.clinicTeamSize || (routeState?.practiceType === 'clinic' ? 2 : 1)
  );
  const [clinicName, setClinicName] = useState(routeState?.clinicName || '');
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const user = await getAuthUser();
      if (!user) return;
      setEmail(user.email || '');

      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data) {
        setFullName(data.full_name || user.user_metadata?.full_name || '');
        setSpecialty(data.specialty || '');
        setGeneralLicense(data.general_license || '');
        setSpecialistLicense(data.specialist_license || '');
        setAvatarUrl(data.avatar_url);
        setImagePreview(data.avatar_url);
      } else {
        setFullName(user.user_metadata?.full_name || '');
        setSpecialty(user.user_metadata?.specialty || '');
      }

      const resolvedMeta = resolvePracticeMeta(user.id, data, user.user_metadata);
      setPracticeType(routeState?.practiceType || resolvedMeta.practice_type);
      setClinicTeamSize(
        routeState?.clinicTeamSize ||
          resolvedMeta.clinic_team_size ||
          (resolvedMeta.practice_type === 'clinic' ? 2 : 1)
      );
      setClinicName(routeState?.clinicName || resolvedMeta.clinic_name || '');
    } catch (err) {
      console.error(err);
      setError('Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];

      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen debe ser menor a 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('Error al seleccionar imagen');
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const user = await getAuthUser();
      if (!user) throw new Error('No user');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err: any) {
      console.error(err);
      setError('Error al subir imagen');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (redirectTarget: 'settings' | 'dashboard' | 'clinic' = 'settings') => {
    setError(null);
    setSuccessMsg(null);

    if (isWelcomeFlow && (!fullName.trim() || !specialty.trim() || !generalLicense.trim())) {
      setError(
        'Completa tu nombre, especialidad y cédula médico general para activar tus recetas y continuar.'
      );
      return;
    }

    if (practiceType === 'clinic' && (!Number.isFinite(clinicTeamSize) || clinicTeamSize < 2)) {
      setError('Para modalidad clínica, indica al menos 2 personas en tu unidad.');
      return;
    }

    setSaving(true);
    try {
      const user = await getAuthUser();
      if (!user) throw new Error('No se encontró una sesión activa.');

      let newAvatarUrl = avatarUrl;
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput?.files && fileInput.files.length > 0) {
        newAvatarUrl = await uploadAvatar(fileInput.files[0]);
      }

      const normalizedTeamSize =
        practiceType === 'clinic' ? Math.max(2, Math.min(500, Math.round(clinicTeamSize))) : 1;

      const baseUpdates = {
        id: user.id,
        full_name: fullName.trim(),
        specialty: specialty.trim(),
        general_license: generalLicense.trim(),
        specialist_license: specialistLicense.trim(),
        avatar_url: newAvatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase.from('user_profiles').upsert(baseUpdates);
      if (upsertErr) throw upsertErr;

      await persistPracticeProfileMeta(user.id, {
        practice_type: practiceType,
        clinic_team_size: normalizedTeamSize,
        clinic_name: practiceType === 'clinic' ? clinicName.trim() || null : null,
      });

      await refreshEntitlements();

      if (redirectTarget === 'dashboard') {
        navigate('/dashboard', { replace: true });
        return;
      }
      if (redirectTarget === 'clinic') {
        navigate('/clinic-admin', { replace: true });
        return;
      }

      if (isWelcomeFlow) {
        setSuccessMsg('Perfil actualizado correctamente. Ya puedes comenzar a usar SONOTOX.');
      } else {
        navigate('/settings');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al guardar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const displayTier: SubscriptionTier =
    effectiveTier !== 'free'
      ? effectiveTier
      : routeState?.selectedPlanTier || effectiveTier;
  const displayPlanName =
    effectiveTier !== 'free'
      ? entitlements.plan_name || `Plan ${TIER_LABELS[effectiveTier]}`
      : routeState?.selectedPlanName || `Plan ${TIER_LABELS[displayTier]}`;
  const isClinic = practiceType === 'clinic';
  const missingRequiredClinical = !specialty.trim() || !generalLicense.trim();

  const planGradient =
    displayTier === 'premium'
      ? 'from-primary via-teal-600 to-cyan-700'
      : displayTier === 'plus'
      ? 'from-sky-600 to-indigo-700'
      : 'from-slate-700 to-slate-900';

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32 lg:pb-12">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-surface-dark/90 px-4 py-3 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(isWelcomeFlow && !missingRequiredClinical ? '/dashboard' : '/settings')}
          className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          aria-label="Volver"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-bold leading-tight flex-1 text-center truncate px-2">
          {isWelcomeFlow ? 'Tu Perfil Clínico' : 'Editar Perfil'}
        </h1>
        <div className="size-10" />
      </header>

      <main className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto w-full">
        {/* Welcome Onboarding Confirmation Banner */}
        {isWelcomeFlow && (
          <section className="rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white p-5 sm:p-6 shadow-xl shadow-teal-900/15 space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[26px]">verified</span>
              </div>
              <div className="space-y-1">
                <span className="inline-block text-[10px] font-black uppercase tracking-widest text-emerald-100">
                  Inscripción completada
                </span>
                <h2 className="text-lg sm:text-xl font-black leading-snug">
                  ¡Bienvenido{fullName ? `, ${fullName}` : ''}! Tu cuenta y tu plan ya están guardados.
                </h2>
                <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                  Registramos tu modalidad como{' '}
                  <strong>
                    {isClinic
                      ? `Clínica con equipo (${clinicTeamSize} personas)`
                      : 'Médico particular'}
                  </strong>{' '}
                  y activamos <strong>{displayPlanName}</strong>.
                  {missingRequiredClinical
                    ? ' Completa ahora tu especialidad y cédula profesional para habilitar tus recetas y entrar al panel clínico.'
                    : ' Revisa tu perfil o continúa directamente a tu panel principal.'}
                </p>
              </div>
            </div>
            {routeState?.warning && (
              <p className="text-xs bg-black/20 rounded-xl px-3.5 py-2 text-amber-100">
                Nota: {routeState.warning}
              </p>
            )}
          </section>
        )}

        {/* Active Plan & Practice Modality Summary Card */}
        <section
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${planGradient} text-white p-5 sm:p-6 shadow-lg`}
        >
          <div className="absolute -right-8 -top-8 size-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 border border-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[13px]">workspace_premium</span>
                  {displayPlanName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-0.5 text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[13px]">
                    {isClinic ? 'local_hospital' : 'person'}
                  </span>
                  {isClinic ? `Clínica · ${clinicTeamSize} personas` : 'Médico particular'}
                </span>
              </div>
              <p className="text-xs text-white/80 pt-1">
                {email && <span className="font-semibold text-white">{email} · </span>}
                {ORIGIN_LABELS[entitlements.origin]}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/subscription')}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Gestionar plan
              </button>
              {displayTier !== 'free' && (
                <button
                  type="button"
                  onClick={() => navigate('/clinic-admin')}
                  className="px-3.5 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-black transition-colors cursor-pointer shadow-sm"
                >
                  {isClinic ? 'Panel de mi Clínica' : 'Panel de Consultorio'}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Avatar & Clinical Identity Card */}
        <section className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="relative shrink-0">
              {imagePreview ? (
                <div
                  className="size-24 rounded-full bg-slate-200 dark:bg-slate-700 border-4 border-white dark:border-slate-800 shadow-md bg-cover bg-center"
                  style={{ backgroundImage: `url(${imagePreview})` }}
                />
              ) : (
                <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-md">
                  <span className="material-symbols-outlined text-4xl text-primary">person</span>
                </div>
              )}
              <label className="absolute bottom-0 right-0 size-8 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary-dark transition-colors">
                <span className="material-symbols-outlined text-white text-lg">photo_camera</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {fullName || 'Especialista'}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Información utilizada en tus recetas, reportes de aplicación y encabezado clínico.
              </p>
              {uploading && <p className="text-xs text-primary font-bold mt-1">Subiendo foto…</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                Nombre completo <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Dr. / Dra. Nombre Apellido"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                Especialidad <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Rehabilitación, Neurología, Medicina Estética..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                Cédula Médico General <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={generalLicense}
                onChange={(e) => setGeneralLicense(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Ej. 12345678"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                Cédula Especialidad{' '}
                <span className="text-slate-400 font-normal lowercase">(opcional)</span>
              </label>
              <input
                type="text"
                value={specialistLicense}
                onChange={(e) => setSpecialistLicense(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Ej. 87654321"
              />
            </div>
          </div>
        </section>

        {/* Editable Practice Modality & Clinic Unit Section */}
        <section className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Modalidad de práctica y unidad médica
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Información registrada en tu inscripción. Puedes actualizarla cuando tu consultorio o clínica crezca.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setPracticeType('individual');
                setClinicTeamSize(1);
              }}
              aria-pressed={practiceType === 'individual'}
              className={`flex items-center gap-3 rounded-2xl p-4 border-2 text-left transition-all cursor-pointer ${
                practiceType === 'individual'
                  ? 'border-primary bg-primary/5 dark:bg-primary/15'
                  : 'border-slate-200 dark:border-slate-700/80 hover:border-primary/40'
              }`}
            >
              <div
                className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                  practiceType === 'individual'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">person</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  Médico particular
                </p>
                <p className="text-[11px] text-text-muted">Consultorio individual (1 persona)</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setPracticeType('clinic');
                setClinicTeamSize((prev) => Math.max(2, prev || 2));
              }}
              aria-pressed={practiceType === 'clinic'}
              className={`flex items-center gap-3 rounded-2xl p-4 border-2 text-left transition-all cursor-pointer ${
                practiceType === 'clinic'
                  ? 'border-primary bg-primary/5 dark:bg-primary/15'
                  : 'border-slate-200 dark:border-slate-700/80 hover:border-primary/40'
              }`}
            >
              <div
                className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                  practiceType === 'clinic'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">local_hospital</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  Clínica con un equipo
                </p>
                <p className="text-[11px] text-text-muted">Unidad multi-especialista</p>
              </div>
            </button>
          </div>

          {practiceType === 'clinic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                  Personas en tu unidad <span className="text-primary">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setClinicTeamSize((prev) => Math.max(2, (prev || 2) - 1))}
                    disabled={clinicTeamSize <= 2}
                    className="size-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 font-black text-lg cursor-pointer"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={2}
                    max={500}
                    value={clinicTeamSize}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setClinicTeamSize(Number.isNaN(val) ? 2 : Math.max(1, Math.min(500, val)));
                    }}
                    className="flex-1 text-center bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 text-base font-black focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => setClinicTeamSize((prev) => Math.min(500, (prev || 2) + 1))}
                    className="size-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-lg cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                  Nombre de la clínica o unidad
                </label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Ej. Clínica NeuroRehab"
                />
              </div>
            </div>
          )}
        </section>

        {error && (
          <div
            role="alert"
            className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-2xl text-sm font-medium flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-4 rounded-2xl text-sm font-medium flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => handleSave(isWelcomeFlow ? 'dashboard' : 'settings')}
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary-dark text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-primary/30 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[20px]">
                  progress_activity
                </span>
                Guardando…
              </>
            ) : isWelcomeFlow ? (
              <>
                Guardar perfil y comenzar
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            ) : (
              'Guardar Cambios'
            )}
          </button>

          {isWelcomeFlow && displayTier !== 'free' && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('clinic')}
              className="sm:w-auto px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark hover:border-primary/50 text-sm font-bold text-slate-800 dark:text-white transition-colors cursor-pointer"
            >
              Guardar e ir a mi {isClinic ? 'Clínica' : 'Consultorio'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default EditProfile;
