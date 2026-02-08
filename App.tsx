
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, Outlet } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
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
import Navigation from './components/Navigation';

// layout wrappers
const ProtectedLayout = ({ session }: { session: Session | null }) => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const PublicLayout = ({ session }: { session: Session | null }) => {
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
         // Auto-redirect logic now handled by PublicLayout mostly, but keep for explicit events if needed
         // actually removing explicit redirects as logic is declarative now
      } else if (event === 'SIGNED_OUT') {
         // managed by ProtectedLayout
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user preferences (font size)
  useEffect(() => {
    const loadPreferences = async () => {
      if (!session?.user) return;
      
      const { data } = await supabase
        .from('user_profiles')
        .select('font_size')
        .eq('user_id', session.user.id)
        .single();
      
      if (data?.font_size) {
        document.body.classList.remove('font-small', 'font-large');
        if (data.font_size === 'small') document.body.classList.add('font-small');
        if (data.font_size === 'large') document.body.classList.add('font-large');
      }
    };
    
    loadPreferences();
  }, [session]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      <main className="flex-1 overflow-hidden">
        <Routes>
            <Route element={<PublicLayout session={session} />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/email-confirmation" element={<EmailConfirmation />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
            
            <Route element={<ProtectedLayout session={session} />}>
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/search" element={<Search />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/motor-points" element={<MuscleList />} /> {/* Browse muscles */}
              <Route path="/motor-points/:muscleId" element={<MotorPoints />} /> {/* Dynamic muscle detail */}
              <Route path="/settings" element={<Settings toggleDarkMode={toggleDarkMode} isDarkMode={isDarkMode} />} />
              <Route path="/profile" element={<EditProfile />} />
              <Route path="/patient/new" element={<NewPatient />} />
              <Route path="/patient/:id" element={<PatientProfile />} />
              <Route path="/patient/:id/edit" element={<EditPatient />} />
              <Route path="/pathologies" element={<PathologyList />} />
              <Route path="/pathology/:id" element={<PathologyDetail />} />
              <Route path="/print-preferences" element={<PrintPreferences />} />
              <Route path="/brand-colors" element={<BrandColors />} />
              <Route path="/font-size" element={<FontSize />} />
              <Route path="/templates" element={<TemplateManager />} />
              <Route path="/data-management" element={<DataManagement />} />
              <Route path="/subscription" element={<Subscription />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      
      {session && location.pathname !== '/login' && location.pathname !== '/signup' && (
        <Navigation />
      )}
    </div>
  );
};

export default App;
