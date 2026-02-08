import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      alert('¡Registro exitoso! Por favor verifica tu correo para confirmar tu cuenta.');
      navigate('/login');
    }
    setLoading(false);
  };

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-between bg-background-light dark:bg-background-dark p-6 overflow-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-5">
        <span className="material-symbols-outlined absolute -top-10 -right-10 text-[400px]">vaccines</span>
        <span className="material-symbols-outlined absolute -bottom-10 -left-10 text-[350px]">hub</span>
      </div>

      <div className="flex flex-col items-center justify-center w-full max-w-sm flex-1 z-10 gap-12">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-white dark:bg-surface-dark rounded-3xl shadow-xl flex items-center justify-center mb-6 ring-1 ring-slate-100 dark:ring-slate-800">
            <span className="material-symbols-outlined text-primary text-[42px] font-bold">person_add</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Crear Cuenta</h1>
          <p className="text-text-muted font-bold text-sm mt-1 uppercase tracking-widest">Toxina DLM</p>
        </div>

        <form className="w-full space-y-5" onSubmit={handleSignup}>
          {error && (
            <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Correo Electrónico</label>
            <div className="group flex w-full items-stretch rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all overflow-hidden shadow-sm">
              <div className="flex items-center justify-center pl-4 text-slate-400 group-focus-within:text-primary"><span className="material-symbols-outlined">mail</span></div>
              <input 
                className="flex-1 w-full border-none bg-transparent h-14 px-3 text-base focus:ring-0" 
                placeholder="doctor@hospital.com" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Contraseña</label>
            <div className="group flex w-full items-stretch rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all overflow-hidden shadow-sm">
              <div className="flex items-center justify-center pl-4 text-slate-400 group-focus-within:text-primary"><span className="material-symbols-outlined">lock</span></div>
              <input 
                className="flex-1 w-full border-none bg-transparent h-14 px-3 text-base focus:ring-0" 
                placeholder="••••••••" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-black h-14 rounded-2xl text-lg shadow-xl shadow-primary/25 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
            ) : (
              'Registrarse'
            )}
          </button>
        </form>
      </div>

      <div className="w-full text-center py-6 z-10">
        <p className="text-slate-500 text-sm font-bold">¿Ya tienes cuenta? <button onClick={() => navigate('/login')} className="text-primary font-black hover:underline ml-1">Inicia Sesión</button></p>
      </div>
    </div>
  );
};

export default Signup;
