import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import AuthSplitShell from '../components/auth/AuthSplitShell';
import BrandLogo from '../components/BrandLogo';
import { APP_NAME } from '../constants/brand';
import { isValidEmailFormat, translateAuthError } from '../utils/authErrors';
import { syncPendingOnboardingForSessionUser } from '../services/onboardingService';
import { useEntitlements } from '../features/entitlements/EntitlementContext';

type LoginMode = 'signin' | 'forgot';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh: refreshEntitlements } = useEntitlements();

  const initialEmail = (location.state as { email?: string } | null)?.email || '';

  const [mode, setMode] = useState<LoginMode>('signin');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handlePasswordKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!isValidEmailFormat(trimmedEmail)) {
      setError({ message: 'Ingresa un correo electrónico válido.' });
      return;
    }

    if (!password) {
      setError({ message: 'Ingresa tu contraseña para continuar.' });
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(translateAuthError(signInError.message));
        return;
      }

      if (data.user) {
        const appliedPending = await syncPendingOnboardingForSessionUser(data.user);
        await refreshEntitlements();
        if (appliedPending) {
          navigate('/profile?welcome=1', { replace: true });
          return;
        }
      }

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(translateAuthError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!isValidEmailFormat(trimmedEmail)) {
      setError({ message: 'Ingresa un correo válido para enviar el enlace de recuperación.' });
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (resetError) {
        setError(translateAuthError(resetError.message));
        return;
      }

      setInfoMessage(
        `Enviamos un enlace de recuperación a ${trimmedEmail}. Revisa tu bandeja de entrada y carpeta de spam.`
      );
    } catch (err: any) {
      setError(translateAuthError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const trimmedEmail = email.trim();
    if (!isValidEmailFormat(trimmedEmail)) return;
    setResendingConfirmation(true);
    setInfoMessage(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (resendError) {
        setError(translateAuthError(resendError.message));
      } else {
        setError(null);
        setInfoMessage(`Reenviamos el enlace de confirmación a ${trimmedEmail}.`);
      }
    } finally {
      setResendingConfirmation(false);
    }
  };

  return (
    <AuthSplitShell
      backTo="/"
      backLabel="Inicio"
      badge="Acceso Seguro · Médicos y Clínicas"
      asideTitle={`Bienvenido de vuelta a ${APP_NAME}`}
      asideDescription="Accede a tu calculadora de toxina botulínica, expedientes, agenda y configuración de consultorio o clínica."
    >
      <div className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-900/5 p-6 sm:p-8 space-y-6">
        {/* Heading */}
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex lg:hidden items-center justify-center mb-2">
            <BrandLogo size={56} rounded="2xl" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {mode === 'signin' ? 'Iniciar sesión' : 'Recuperar contraseña'}
          </h1>
          <p className="text-sm text-text-muted">
            {mode === 'signin'
              ? 'Ingresa con tu correo registrado para continuar a tu espacio clínico.'
              : 'Te enviaremos un enlace seguro para crear una nueva contraseña.'}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/70 p-4 text-sm text-red-700 dark:text-red-300 space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">error</span>
              <span className="font-medium leading-snug">{error.message}</span>
            </div>
            {error.code === 'email_not_confirmed' && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendingConfirmation}
                className="inline-flex items-center gap-1.5 text-xs font-black text-red-800 dark:text-red-200 underline underline-offset-2 hover:opacity-80 cursor-pointer disabled:opacity-50 ml-7"
              >
                <span className="material-symbols-outlined text-[15px]">forward_to_inbox</span>
                {resendingConfirmation ? 'Reenviando...' : 'Reenviar correo de confirmación'}
              </button>
            )}
          </div>
        )}

        {infoMessage && (
          <div
            role="status"
            className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 p-4 text-sm text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5"
          >
            <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">check_circle</span>
            <span className="font-medium leading-snug">{infoMessage}</span>
          </div>
        )}

        {/* Sign-in form */}
        {mode === 'signin' ? (
          <form className="space-y-4" onSubmit={handleLogin} noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider ml-1"
              >
                Correo electrónico
              </label>
              <div className="group flex w-full items-stretch rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 transition-all overflow-hidden">
                <div className="flex items-center justify-center pl-4 text-slate-400 group-focus-within:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="doctor@clinica.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className="flex-1 w-full border-none bg-transparent min-h-[52px] py-3.5 px-3 text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label
                  htmlFor="login-password"
                  className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider"
                >
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="group flex w-full items-stretch rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 transition-all overflow-hidden">
                <div className="flex items-center justify-center pl-4 text-slate-400 group-focus-within:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyUp={handlePasswordKeyEvent}
                  onKeyDown={handlePasswordKeyEvent}
                  className="flex-1 w-full border-none bg-transparent min-h-[52px] py-3.5 px-3 text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="px-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {capsLockOn && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 pl-1">
                  <span className="material-symbols-outlined text-[15px]">keyboard_capslock</span>
                  Bloq Mayús está activado
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-primary hover:bg-primary-dark text-white font-black min-h-[52px] py-3.5 rounded-2xl text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  Verificando acceso…
                </>
              ) : (
                <>
                  Iniciar sesión
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleForgotPassword} noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="forgot-email"
                className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider ml-1"
              >
                Correo registrado
              </label>
              <div className="group flex w-full items-stretch rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 transition-all overflow-hidden">
                <div className="flex items-center justify-center pl-4 text-slate-400 group-focus-within:text-primary">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="doctor@clinica.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className="flex-1 w-full border-none bg-transparent py-3.5 px-3 text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-black py-3.5 rounded-2xl text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  Enviando enlace…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">send</span>
                  Enviar enlace de recuperación
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
                setInfoMessage(null);
              }}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ← Volver a iniciar sesión
            </button>
          </form>
        )}

        {/* Divider & Signup CTA */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
            ¿Aún no tienes cuenta en {APP_NAME}?
          </p>
          <Link
            to="/signup"
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 hover:border-primary/50 hover:bg-primary/5 py-3 px-4 text-sm font-black text-slate-800 dark:text-white transition-all"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">person_add</span>
            Crear cuenta y elegir plan (Gratuito, Plus o Premium)
          </Link>
        </div>
      </div>
    </AuthSplitShell>
  );
};

export default Login;
