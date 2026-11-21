import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useLocation, Navigate, Outlet } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import ComplianceLayout from './components/ComplianceLayout';
import Dashboard from './screens/Dashboard';
import Search from './screens/Search';
import Calculator from './screens/Calculator';
import MotorPoints from './screens/MotorPoints';
import MuscleList from './screens/MuscleList';
import Settings from './screens/Settings';
import PatientProfile from './screens/PatientProfile';
import Subscription from './screens/Subscription';
import Login from './screens/Login';
import Signup from './screens/Signup';
import EmailConfirmation from './screens/EmailConfirmation';
import CompleteProfile from './screens/CompleteProfile';
import LegalAcceptance from './screens/LegalAcceptance';
import LegalDocumentPage from './screens/LegalDocumentPage';
import PrivacySettings from './screens/PrivacySettings';
import Landing from './screens/Landing';
import QuickStart from './screens/QuickStart';

import EditProfile from './screens/EditProfile';
import EditPatient from './screens/EditPatient';
import PathologyDetail from './screens/PathologyDetail';
import PathologyList from './screens/PathologyList';
import NewPatient from './screens/NewPatient';
import PrintPreferences from './screens/PrintPreferences';
import BrandColors from './screens/BrandColors';
import FontSize from './screens/FontSize';
import TemplateManager from './screens/TemplateManager';
import DataManagement from './screens/DataManagement';
import Agenda from './screens/Agenda';
import AppointmentSettings from './screens/AppointmentSettings';
import Navigation from './components/Navigation';
import OfflineBanner from './components/OfflineBanner';
import PendingSyncBanner from './components/PendingSyncBanner';
import PWAInstallBanner from './components/PWAInstallBanner';
import UpdatePrompt from './components/UpdatePrompt';
import { useOfflineSync } from './hooks/useOfflineSync';
import UnitPreferences from './screens/UnitPreferences';
import ToxinDoseSettings from './screens/ToxinDoseSettings';
import LanguageSettings from './screens/LanguageSettings';
import { applyBrandColors, applyFontSize, applyDarkMode } from './utils/userPreferences';
import {
  getCachedSession,
  isOnline,
  isSessionUsableOffline,
  refreshSessionIfOnline,
} from './utils/auth';
import { prefetchClinicalData } from './services/clinicalCache';
import {
  EntitlementProvider,
  useEntitlements,
} from './features/entitlements/EntitlementContext';
import {
  FeatureGate,
  PlatformAnnouncementBanner,
} from './features/entitlements/FeatureGate';

// Lazy-loaded privileged portals (never bundled in initial client chunk)
const AdminMedia = lazy(() => import('./screens/AdminMedia'));
const AdminMuscleMediaEditor = lazy(() => import('./screens/AdminMuscleMediaEditor'));
const AdminPathologies = lazy(() => import('./screens/AdminPathologies'));
const AdminPathologyEditor = lazy(() => import('./screens/AdminPathologyEditor'));
const SuperAdminDashboard = lazy(
  () => import('./features/super-admin/pages/SuperAdminDashboard')
);
const SuperAdminClinicDetail = lazy(
  () => import('./features/super-admin/pages/SuperAdminClinicDetail')
);
const EnterprisePortal = lazy(
  () => import('./features/enterprise/pages/EnterprisePortal')
);
const ClinicAdminPage = lazy(
  () => import('./features/clinic-admin/ClinicAdminPage')
);

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh] bg-background-light dark:bg-background-dark">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
  </div>
);

const PUBLIC_ALWAYS_PATHS = ['/aviso-privacidad', '/terminos', '/landing'];
const PUBLIC_SHELL_PATHS = ['/', '/login', '/signup', '/landing', '/aviso-privacidad', '/terminos'];

function isStandaloneShellPath(pathname: string): boolean {
  return (
    PUBLIC_SHELL_PATHS.includes(pathname) ||
    pathname.startsWith('/super-admin') ||
    pathname.startsWith('/enterprise')
  );
}

const ProtectedLayout = ({ session }: { session: Session | null }) => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const PublicLayout = ({ session }: { session: Session | null }) => {
  const location = useLocation();
  const { entitlements, loading } = useEntitlements();

  if (session && !PUBLIC_ALWAYS_PATHS.includes(location.pathname)) {
    if (loading) return <PageLoader />;
    if (entitlements.role === 'enterprise') {
      return <Navigate to="/enterprise" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

// Silent guards: never reveal the existence of privileged routes to non-authorized users
const RequireSuperAdmin: React.FC = () => {
  const { isSuperAdmin, loading } = useEntitlements();
  if (loading) return <PageLoader />;
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

const RequireEnterprise: React.FC = () => {
  const { isEnterpriseManager, isSuperAdmin, loading } = useEntitlements();
  if (loading) return <PageLoader />;
  if (!isEnterpriseManager && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

const RequireClinicAdmin: React.FC = () => {
  const { isClinicAdmin, isSuperAdmin, loading } = useEntitlements();
  if (loading) return <PageLoader />;
  if (!isClinicAdmin && !isSuperAdmin) {
    return <Navigate to="/settings" replace />;
  }
  return <Outlet />;
};

interface AppShellProps {
  effectiveSession: Session | null;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const AppShell: React.FC<AppShellProps> = ({
  effectiveSession,
  isDarkMode,
  toggleDarkMode,
}) => {
  const location = useLocation();
  const { can, entitlements, loading: entitlementsLoading } = useEntitlements();
  const canOfflineSync = can('offline.sync') && entitlements.role !== 'enterprise';

  const {
    pendingCount,
    syncing,
    lastError,
    syncNow,
    retrySync,
  } = useOfflineSync(canOfflineSync ? effectiveSession?.user?.id : undefined);

  useEffect(() => {
    const userId = effectiveSession?.user?.id;
    if (!userId || entitlementsLoading || !canOfflineSync || !isOnline()) return;

    const runPrefetch = () => {
      prefetchClinicalData(userId).catch((error) => {
        console.warn('Clinical prefetch failed:', error);
      });
    };

    runPrefetch();
    window.addEventListener('online', runPrefetch);
    return () => window.removeEventListener('online', runPrefetch);
  }, [effectiveSession?.user?.id, entitlementsLoading, canOfflineSync]);

  const standaloneShell = isStandaloneShellPath(location.pathname);

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      {canOfflineSync && (
        <PendingSyncBanner
          pendingCount={pendingCount}
          syncing={syncing}
          lastError={lastError}
          onSync={syncNow}
          onRetry={retrySync}
        />
      )}
      <OfflineBanner />
      <main
        className={`flex-1 min-w-0 overflow-x-hidden ${
          standaloneShell ? 'overflow-y-auto' : 'overflow-y-hidden'
        } ${
          effectiveSession && !standaloneShell ? 'lg:pl-64 print:pl-0' : ''
        }`}
      >
        {effectiveSession && !standaloneShell && <PlatformAnnouncementBanner />}

        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<PublicLayout session={effectiveSession} />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/email-confirmation" element={<EmailConfirmation />} />
              <Route path="/aviso-privacidad" element={<LegalDocumentPage type="privacy" />} />
              <Route path="/terminos" element={<LegalDocumentPage type="terms" />} />
              <Route path="/" element={<QuickStart />} />
              <Route path="/landing" element={<Landing />} />
            </Route>

            <Route element={<ProtectedLayout session={effectiveSession} />}>
              <Route path="/legal-acceptance" element={<LegalAcceptance />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/aviso-privacidad" element={<LegalDocumentPage type="privacy" />} />
              <Route path="/terminos" element={<LegalDocumentPage type="terms" />} />

              {/* SuperAdmin standalone console (invisible & silent redirect for non-admins) */}
              <Route element={<RequireSuperAdmin />}>
                <Route path="/super-admin" element={<SuperAdminDashboard />} />
                <Route path="/super-admin/clinics/:clinicId" element={<SuperAdminClinicDetail />} />
              </Route>

              {/* Enterprise B2B2C sponsor portal (Zero-PHI isolation) */}
              <Route element={<RequireEnterprise />}>
                <Route path="/enterprise" element={<EnterprisePortal />} />
              </Route>

              <Route element={<ComplianceLayout session={effectiveSession!} />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/search" element={<Search />} />
                <Route
                  path="/agenda"
                  element={
                    <FeatureGate
                      feature="agenda.manage"
                      requiredTier="plus"
                      title="Agenda y Horarios Clínicos"
                      description="Organiza tus citas, recordatorios de seguimiento y disponibilidad con Plan Plus o Premium."
                    >
                      <Agenda />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/appointment-settings"
                  element={
                    <FeatureGate
                      feature="agenda.manage"
                      requiredTier="plus"
                      title="Configuración de Agenda y Horarios"
                    >
                      <AppointmentSettings />
                    </FeatureGate>
                  }
                />
                <Route path="/calculator" element={<Calculator />} />
                <Route
                  path="/motor-points"
                  element={
                    <FeatureGate
                      feature="guides.anatomy"
                      requiredTier="premium"
                      title="Guía Anatómica, Puntos Motores y USG"
                      description="Accede al atlas de puntos motores, guía ecográfica, videos y perlas clínicas con Plan Premium."
                    >
                      <MuscleList />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/motor-points/:muscleId"
                  element={
                    <FeatureGate
                      feature="guides.anatomy"
                      requiredTier="premium"
                      title="Guía Anatómica, Puntos Motores y USG"
                    >
                      <MotorPoints />
                    </FeatureGate>
                  }
                />
                <Route element={<RequireSuperAdmin />}>
                  <Route path="/admin/media" element={<AdminMedia />} />
                  <Route path="/admin/media/:muscleId" element={<AdminMuscleMediaEditor />} />
                  <Route path="/admin/pathologies" element={<AdminPathologies />} />
                  <Route path="/admin/pathologies/:pathologyId" element={<AdminPathologyEditor />} />
                </Route>
                <Route
                  path="/settings"
                  element={<Settings toggleDarkMode={toggleDarkMode} isDarkMode={isDarkMode} />}
                />
                <Route path="/profile" element={<EditProfile />} />
                <Route
                  path="/patient/new"
                  element={
                    <FeatureGate
                      feature="patients.manage"
                      requiredTier="plus"
                      title="Registro de Expedientes de Pacientes"
                      description="Crea y gestiona expedientes clínicos, evolución y metas GAS con Plan Plus o Premium."
                    >
                      <NewPatient />
                    </FeatureGate>
                  }
                />
                <Route path="/patient/:id" element={<PatientProfile />} />
                <Route
                  path="/patient/:id/edit"
                  element={
                    <FeatureGate
                      feature="patients.manage"
                      requiredTier="plus"
                      title="Edición de Expedientes"
                    >
                      <EditPatient />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/pathologies"
                  element={
                    <FeatureGate
                      feature="content.protocols"
                      requiredTier="premium"
                      title="Protocolos Clínicos por Patología"
                      description="Explora protocolos prediseñados de dosificación por patología y patrones de espasticidad con Plan Premium."
                    >
                      <PathologyList />
                    </FeatureGate>
                  }
                />
                <Route
                  path="/pathology/:id"
                  element={
                    <FeatureGate
                      feature="content.protocols"
                      requiredTier="premium"
                      title="Protocolos Clínicos por Patología"
                    >
                      <PathologyDetail />
                    </FeatureGate>
                  }
                />
                <Route path="/print-preferences" element={<PrintPreferences />} />
                <Route path="/brand-colors" element={<BrandColors />} />
                <Route path="/font-size" element={<FontSize />} />
                <Route
                  path="/templates"
                  element={
                    <FeatureGate
                      feature="templates.manage"
                      requiredTier="plus"
                      title="Plantillas Clínicas Personales"
                    >
                      <TemplateManager />
                    </FeatureGate>
                  }
                />
                <Route path="/data-management" element={<DataManagement />} />
                <Route path="/unit-preferences" element={<UnitPreferences />} />
                <Route path="/toxin-dose-settings" element={<ToxinDoseSettings />} />
                <Route path="/language" element={<LanguageSettings />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/privacidad" element={<PrivacySettings />} />
                <Route element={<RequireClinicAdmin />}>
                  <Route path="/clinic-admin" element={<ClinicAdminPage />} />
                  <Route path="/clinic-admin/:clinicId" element={<ClinicAdminPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>

      {effectiveSession && !standaloneShell && <Navigation />}
      <PWAInstallBanner />
      <UpdatePrompt />
    </div>
  );
};

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('dark_mode');
    return saved !== null ? saved === 'true' : true;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [offlineSession, setOfflineSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveSession = session ?? offlineSession;

  useEffect(() => {
    let mounted = true;

    const resolveInitialSession = async () => {
      const cached = await getCachedSession();
      if (mounted) {
        setSession(cached);
        setLoading(false);
      }

      if (isOnline()) {
        const refreshed = await refreshSessionIfOnline();
        if (mounted && refreshed) {
          setSession(refreshed);
        }
      }
    };

    resolveInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === 'SIGNED_OUT' && !isOnline()) {
        const cached = await getCachedSession();
        if (isSessionUsableOffline(cached)) {
          setSession(cached);
          return;
        }
      }

      setSession(nextSession);
    });

    const handleOnline = async () => {
      const refreshed = await refreshSessionIfOnline();
      if (refreshed) {
        setSession(refreshed);
      }
    };

    const handleOffline = async () => {
      const cached = await getCachedSession();
      if (isSessionUsableOffline(cached)) {
        setOfflineSession(cached);
        setSession((current) => current ?? cached);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (session || isOnline()) {
      setOfflineSession(null);
      return;
    }

    getCachedSession().then((cached) => {
      if (isSessionUsableOffline(cached)) {
        setOfflineSession(cached);
      }
    });
  }, [session]);

  useEffect(() => {
    applyDarkMode(isDarkMode);
    localStorage.setItem('dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!effectiveSession?.user) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('font_size, primary_color, secondary_color, dark_mode')
        .eq('id', effectiveSession.user.id)
        .single();

      if (!data) return;

      applyFontSize(data.font_size);
      applyBrandColors(data.primary_color, data.secondary_color);

      if (data.dark_mode !== null && data.dark_mode !== undefined) {
        setIsDarkMode(data.dark_mode);
      }
    };

    loadPreferences();
  }, [effectiveSession]);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (effectiveSession?.user) {
      supabase
        .from('user_profiles')
        .update({ dark_mode: next })
        .eq('id', effectiveSession.user.id)
        .then(({ error }) => {
          if (error) console.error('Error saving dark mode:', error);
        });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <EntitlementProvider userId={effectiveSession?.user?.id}>
      <AppShell
        effectiveSession={effectiveSession}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />
    </EntitlementProvider>
  );
};

export default App;
