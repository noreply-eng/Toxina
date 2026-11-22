import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthSplitShell from '../components/auth/AuthSplitShell';
import BrandLogo from '../components/BrandLogo';
import ConsentCheckbox from '../components/ConsentCheckbox';
import { APP_NAME } from '../constants/brand';
import { LEGAL_DOCUMENT_META } from '../constants/legalVersions';
import { useSignupFlow } from '../contexts/SignupFlowContext';
import { evaluatePasswordStrength, isValidEmailFormat } from '../utils/authErrors';

type WizardStep = 1 | 2;

const TEAM_SIZE_PRESETS = [
  { label: '2–5', value: 3, hint: 'Equipo pequeño' },
  { label: '6–10', value: 8, hint: 'Clínica mediana' },
  { label: '11–20', value: 15, hint: 'Centro médico' },
  { label: '25+', value: 25, hint: 'Unidad amplia' },
] as const;

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, updateState } = useSignupFlow();

  const initialStep =
    (location.state as { step?: WizardStep; notice?: string } | null)?.step === 2 ? 2 : 1;
  const initialNotice = (location.state as { notice?: string } | null)?.notice || null;

  const [step, setStep] = useState<WizardStep>(initialStep);
  const [confirmPassword, setConfirmPassword] = useState(state.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(initialNotice);

  const strength = useMemo(() => evaluatePasswordStrength(state.password), [state.password]);
  const emailValid = isValidEmailFormat(state.email);
  const passwordsMatch = Boolean(state.password) && state.password === confirmPassword;

  const handleStep1Continue = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!state.fullName.trim() || state.fullName.trim().length < 3) {
      setError('Ingresa tu nombre completo (ej. Dr. Juan Pérez).');
      return;
    }
    if (!emailValid) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (state.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!passwordsMatch) {
      setError('Las contraseñas no coinciden. Verifícalas para continuar.');
      return;
    }
    if (!state.termsAccepted || !state.privacySensitiveAccepted) {
      setError(
        'Debes aceptar los Términos de Uso y el consentimiento expreso del Aviso de Privacidad para continuar.'
      );
      return;
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStep2Continue = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (state.practiceType === 'clinic') {
      const size = Number(state.clinicTeamSize);
      if (!Number.isFinite(size) || size < 2 || size > 500) {
        setError('Indica cuántas personas integran tu unidad (mínimo 2 personas para clínica).');
        return;
      }
      updateState({ clinicTeamSize: Math.round(size) });
    } else {
      updateState({ clinicTeamSize: 1 });
    }

    navigate('/signup/plan');
  };

  const adjustTeamSize = (delta: number) => {
    const next = Math.max(2, Math.min(500, (Number(state.clinicTeamSize) || 2) + delta));
    updateState({ clinicTeamSize: next });
    if (error) setError(null);
  };

  const stepsMeta = [
    { num: 1, label: 'Cuenta' },
    { num: 2, label: 'Modalidad' },
    { num: 3, label: 'Plan y pago' },
  ];

  const asideSummary = (
    <div className="rounded-2xl bg-white/[0.08] border border-white/15 p-4 space-y-2.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-sky-300">
        Tu progreso de inscripción
      </p>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Especialista</span>
          <span className="font-bold text-white truncate max-w-[200px]">
            {state.fullName.trim() || 'Por completar'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Modalidad</span>
          <span className="font-bold text-white">
            {step === 1
              ? 'Paso siguiente'
              : state.practiceType === 'clinic'
              ? `Clínica · ${state.clinicTeamSize} personas`
              : 'Médico particular'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-300">Pasarela de planes</span>
          <span className="font-bold text-emerald-300">Gratuito · Plus · Premium</span>
        </div>
      </div>
    </div>
  );

  return (
    <AuthSplitShell
      backTo="/"
      backLabel="Inicio"
      badge="Registro Guiado · 3 pasos rápidos"
      asideTitle={`Crea tu cuenta en ${APP_NAME}`}
      asideDescription="Configura tu modalidad de práctica y elige el plan ideal en nuestra pasarela de suscripción. Sin tarjeta requerida hoy."
      asideFooter={asideSummary}
      maxContentWidth={step === 2 ? 'max-w-xl' : 'max-w-lg'}
    >
      <div className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-900/5 p-6 sm:p-8 space-y-6">
        {/* Stepper */}
        <nav aria-label="Progreso de registro" className="flex items-center justify-between gap-2">
          {stepsMeta.map((item, idx) => {
            const isCompleted = step > item.num;
            const isActive = step === item.num;
            return (
              <React.Fragment key={item.num}>
                <button
                  type="button"
                  disabled={item.num > step}
                  onClick={() => {
                    if (item.num < step) {
                      setStep(item.num as WizardStep);
                      setError(null);
                    }
                  }}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : isCompleted
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default'
                  }`}
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-black/10 dark:bg-white/10 text-[11px] font-black">
                    {isCompleted ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      item.num
                    )}
                  </span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
                {idx < stepsMeta.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 rounded-full transition-colors ${
                      step > item.num ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/70 p-4 text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5"
          >
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">error</span>
            <span className="font-medium leading-snug">{error}</span>
          </div>
        )}

        {/* STEP 1: ACCOUNT CREDENTIALS & LEGAL CONSENT */}
        {step === 1 && (
          <form className="space-y-4" onSubmit={handleStep1Continue} noValidate>
            <div className="space-y-1.5">
              <div className="inline-flex lg:hidden items-center justify-center mb-1">
                <BrandLogo size={48} rounded="2xl" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Datos de tu cuenta
              </h1>
              <p className="text-sm text-text-muted">
                Después indicaremos si ejerces como médico particular o clínica y elegirás tu plan.
              </p>
            </div>

            {/* Full Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="signup-name"
                className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider ml-1"
              >
                Nombre completo
              </label>
              <div className="group flex w-full items-stretch rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 transition-all overflow-hidden">
                <div className="flex items-center justify-center pl-4 text-slate-400 group-focus-within:text-primary">
                  <span className="material-symbols-outlined text-[20px]">badge</span>
                </div>
                <input
                  id="signup-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  placeholder="Dr. / Dra. Nombre Apellido"
                  value={state.fullName}
                  onChange={(e) => {
                    updateState({ fullName: e.target.value });
                    if (error) setError(null);
                  }}
                  className="flex-1 w-full border-none bg-transparent py-3.5 px-3 text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="signup-email"
                className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider ml-1"
              >
                Correo electrónico
              </label>
              <div className="group flex w-full items-stretch rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 transition-all overflow-hidden">
                <div className="flex items-center justify-center pl-4 text-slate-400 group-focus-within:text-primary">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="doctor@hospital.com"
                  value={state.email}
                  onChange={(e) => {
                    updateState({ email: e.target.value });
                    if (error) setError(null);
                  }}
                  className="flex-1 w-full border-none bg-transparent py-3.5 px-3 text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0"
                  required
                />
                {state.email.trim().length > 0 && (
                  <div className="flex items-center pr-3.5">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        emailValid ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    >
                      {emailValid ? 'check_circle' : 'alternate_email'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="signup-password"
                className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider ml-1"
              >
                Contraseña
              </label>
              <div className="group flex w-full items-stretch rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 transition-all overflow-hidden">
                <div className="flex items-center justify-center pl-4 text-slate-400 group-focus-within:text-primary">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={state.password}
                  onChange={(e) => {
                    updateState({ password: e.target.value });
                    if (error) setError(null);
                  }}
                  className="flex-1 w-full border-none bg-transparent py-3.5 px-3 text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="px-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {/* Password strength meter */}
              {state.password.length > 0 && (
                <div className="pt-1 px-1 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          strength.score >= bar
                            ? strength.barClass
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                    <span className={`text-[11px] font-black ml-1.5 ${strength.colorClass}`}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        strength.checks.minLength
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {strength.checks.minLength ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      8+ caracteres
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 ${
                        strength.checks.hasLetter && strength.checks.hasNumber
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {strength.checks.hasLetter && strength.checks.hasNumber
                          ? 'check_circle'
                          : 'radio_button_unchecked'}
                      </span>
                      Letras y números
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="signup-confirm-password"
                className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider ml-1"
              >
                Confirmar contraseña
              </label>
              <div className="group flex w-full items-stretch rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 transition-all overflow-hidden">
                <div className="flex items-center justify-center pl-4 text-slate-400 group-focus-within:text-primary">
                  <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                </div>
                <input
                  id="signup-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="flex-1 w-full border-none bg-transparent py-3.5 px-3 text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="px-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p
                  className={`flex items-center gap-1 text-xs font-semibold pl-1 ${
                    passwordsMatch
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500 dark:text-red-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {passwordsMatch ? 'check_circle' : 'cancel'}
                  </span>
                  {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                </p>
              )}
            </div>

            {/* LFPDPPP Legal Consent */}
            <div className="pt-2 space-y-2.5">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">
                Consentimiento legal (LFPDPPP)
              </p>
              <ConsentCheckbox
                id="signup-consent-terms"
                checked={state.termsAccepted}
                onChange={(checked) => {
                  updateState({ termsAccepted: checked });
                  if (error) setError(null);
                }}
                required
                linkHref={LEGAL_DOCUMENT_META.terms.route}
                linkLabel="Términos y Condiciones de Uso"
              >
                He leído y acepto los
              </ConsentCheckbox>

              <ConsentCheckbox
                id="signup-consent-privacy"
                checked={state.privacySensitiveAccepted}
                onChange={(checked) => {
                  updateState({ privacySensitiveAccepted: checked });
                  if (error) setError(null);
                }}
                required
                linkHref={LEGAL_DOCUMENT_META.privacy.route}
                linkLabel="Aviso de Privacidad Integral"
              >
                Consiento expresamente el tratamiento de datos personales sensibles conforme al
              </ConsentCheckbox>

              <ConsentCheckbox
                id="signup-consent-secondary"
                checked={state.secondaryPurposesAccepted}
                onChange={(checked) => updateState({ secondaryPurposesAccepted: checked })}
              >
                Autorizo datos clínicos anonimizados para estadísticas e investigación (opcional)
              </ConsentCheckbox>
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-primary hover:bg-primary-dark text-white font-black py-3.5 px-5 rounded-2xl text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              Continuar: Modalidad de práctica
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400 font-medium pt-2">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-primary font-black hover:underline">
                Inicia sesión
              </Link>
            </p>
          </form>
        )}

        {/* STEP 2: PRACTICE MODALITY (INDIVIDUAL VS CLINIC + TEAM SIZE) */}
        {step === 2 && (
          <form className="space-y-6" onSubmit={handleStep2Continue} noValidate>
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-black text-primary uppercase tracking-wider">
                Paso 2 de 3 · Antes de elegir tu plan
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                ¿Cómo ejercerás en {APP_NAME}?
              </h1>
              <p className="text-sm text-text-muted">
                Cuéntanos si trabajas como médico particular o en una clínica con un equipo para adaptar tus planes y tu perfil.
              </p>
            </div>

            {/* Practice Type Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Individual */}
              <button
                type="button"
                onClick={() => {
                  updateState({ practiceType: 'individual', clinicTeamSize: 1 });
                  if (error) setError(null);
                }}
                aria-pressed={state.practiceType === 'individual'}
                className={`group relative text-left rounded-2xl p-5 border-2 transition-all cursor-pointer ${
                  state.practiceType === 'individual'
                    ? 'border-primary bg-primary/[0.06] dark:bg-primary/15 shadow-lg shadow-primary/10'
                    : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/50 hover:border-primary/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    className={`size-12 rounded-2xl flex items-center justify-center transition-colors ${
                      state.practiceType === 'individual'
                        ? 'bg-primary text-white shadow-md shadow-primary/25'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[26px]">person</span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[22px] ${
                      state.practiceType === 'individual'
                        ? 'text-primary'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  >
                    {state.practiceType === 'individual' ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                </div>

                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Médico particular
                </h2>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Consultorio privado individual para 1 especialista. Expedientes y agenda personales.
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    1 especialista
                  </span>
                  <span className="rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    Consultorio privado
                  </span>
                </div>
              </button>

              {/* Clinic with team */}
              <button
                type="button"
                onClick={() => {
                  updateState({
                    practiceType: 'clinic',
                    clinicTeamSize: Math.max(2, state.clinicTeamSize || 3),
                  });
                  if (error) setError(null);
                }}
                aria-pressed={state.practiceType === 'clinic'}
                className={`group relative text-left rounded-2xl p-5 border-2 transition-all cursor-pointer ${
                  state.practiceType === 'clinic'
                    ? 'border-primary bg-primary/[0.06] dark:bg-primary/15 shadow-lg shadow-primary/10'
                    : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/50 hover:border-primary/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    className={`size-12 rounded-2xl flex items-center justify-center transition-colors ${
                      state.practiceType === 'clinic'
                        ? 'bg-primary text-white shadow-md shadow-primary/25'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[26px]">local_hospital</span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[22px] ${
                      state.practiceType === 'clinic'
                        ? 'text-primary'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  >
                    {state.practiceType === 'clinic' ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                </div>

                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Clínica con un equipo
                </h2>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Unidad médica, centro estético o rehabilitación con varios especialistas o asistentes.
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    Multi-especialista
                  </span>
                  <span className="rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    Sede compartida
                  </span>
                </div>
              </button>
            </div>

            {/* Conditional Clinic Unit Details */}
            {state.practiceType === 'clinic' && (
              <div className="rounded-2xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200/80 dark:border-sky-800/60 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">groups</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      ¿Cuántas personas incluye su unidad? *
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Incluye médicos aplicadores, residentes y personal de apoyo o recepción. Guardaremos este dato en tu perfil y clínica.
                    </p>
                  </div>
                </div>

                {/* Quick presets */}
                <div className="grid grid-cols-4 gap-2">
                  {TEAM_SIZE_PRESETS.map((preset) => {
                    const active = state.clinicTeamSize === preset.value;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => updateState({ clinicTeamSize: preset.value })}
                        className={`rounded-xl py-2 px-2 text-center border transition-all cursor-pointer ${
                          active
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-primary/50'
                        }`}
                      >
                        <span className="block text-sm font-black leading-tight">{preset.label}</span>
                        <span
                          className={`block text-[10px] mt-0.5 ${
                            active ? 'text-white/85' : 'text-slate-400'
                          }`}
                        >
                          {preset.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Exact stepper + number input */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3.5">
                  <div>
                    <label
                      htmlFor="clinic-team-size"
                      className="block text-xs font-black text-slate-700 dark:text-slate-200"
                    >
                      Número exacto de integrantes
                    </label>
                    <p className="text-[11px] text-text-muted">Mínimo 2 personas en la unidad</p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => adjustTeamSize(-1)}
                      disabled={state.clinicTeamSize <= 2}
                      className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center font-black text-lg cursor-pointer"
                      aria-label="Reducir integrantes"
                    >
                      −
                    </button>
                    <input
                      id="clinic-team-size"
                      type="number"
                      min={2}
                      max={500}
                      value={state.clinicTeamSize}
                      onChange={(e) => {
                        const raw = parseInt(e.target.value, 10);
                        updateState({ clinicTeamSize: Number.isNaN(raw) ? 2 : Math.max(1, Math.min(500, raw)) });
                      }}
                      className="w-20 text-center rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2 text-base font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/30"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => adjustTeamSize(1)}
                      className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-black text-lg cursor-pointer"
                      aria-label="Aumentar integrantes"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Optional Clinic Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-clinic-name"
                    className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider ml-1"
                  >
                    Nombre de tu clínica o unidad{' '}
                    <span className="font-normal lowercase text-slate-400">(opcional)</span>
                  </label>
                  <input
                    id="signup-clinic-name"
                    type="text"
                    placeholder="Ej. Clínica de Rehabilitación y Toxina Mérida"
                    value={state.clinicName}
                    onChange={(e) => updateState({ clinicName: e.target.value })}
                    className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                </div>
              </div>
            )}

            {/* Navigation actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                className="sm:w-auto px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                ← Volver
              </button>
              <button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary-dark text-white font-black py-3.5 px-6 rounded-2xl text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                Ir a pasarela de planes
                <span className="material-symbols-outlined text-[20px]">payments</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthSplitShell>
  );
};

export default Signup;
