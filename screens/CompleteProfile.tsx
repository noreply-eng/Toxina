import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const CompleteProfile: React.FC = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [generalLicense, setGeneralLicense] = useState('');
  const [specialistLicense, setSpecialistLicense] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (data) {
          setFullName(data.full_name || '');
          setSpecialty(data.specialty || '');
          setGeneralLicense(data.general_license || '');
          setSpecialistLicense(data.specialist_license || '');
      }
    };
    fetchProfile();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        setError("No se encontró usuario autenticado.");
        setLoading(false);
        return;
    }

    if (!fullName.trim() || !specialty.trim() || !generalLicense.trim()) {
        setError("Por favor completa los campos obligatorios.");
        setLoading(false);
        return;
    }

    try {
        // Upsert allows us to create the profile if it doesn't exist (e.g., if the trigger failed)
        const { error: upsertError } = await supabase
            .from('user_profiles')
            .upsert({
                id: user.id,
                full_name: fullName,
                specialty,
                general_license: generalLicense,
                specialist_license: specialistLicense,
                updated_at: new Date().toISOString(),
            });

        if (upsertError) throw upsertError;

        navigate('/dashboard');
    } catch (err: any) {
        setError(err.message || 'Error al guardar el perfil.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
      <div className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800 animate-fade-in-up">
        
        <div className="text-center mb-10">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                <span className="material-symbols-outlined text-primary text-[40px]">medical_information</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Completa tu Perfil</h1>
            <p className="text-slate-500 dark:text-slate-400">
                Necesitamos esta información para tus recetas y reportes médicos.
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">error</span>
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Nombre Completo</label>
                    <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 font-medium focus:ring-2 focus:ring-primary/50 transition-all"
                        placeholder="Dr. Juan Pérez"
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Especialidad</label>
                    <input
                        type="text"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 font-medium focus:ring-2 focus:ring-primary/50 transition-all"
                        placeholder="Dermatología, Cirugía Plástica..."
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Cédula Médico General <span className="text-primary">*</span></label>
                    <input
                        type="text"
                        value={generalLicense}
                        onChange={(e) => setGeneralLicense(e.target.value)}
                        className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 font-medium focus:ring-2 focus:ring-primary/50 transition-all"
                        placeholder="Ej. 12345678"
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Cédula Especialidad <span className="text-slate-400 font-normal lowercase">(opcional)</span></label>
                    <input
                        type="text"
                        value={specialistLicense}
                        onChange={(e) => setSpecialistLicense(e.target.value)}
                        className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 font-medium focus:ring-2 focus:ring-primary/50 transition-all"
                        placeholder="Ej. 87654321"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-primary hover:bg-primary-dark text-white font-bold rounded-2xl shadow-lg shadow-primary/25 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
            >
                {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Guardar y Continuar'}
            </button>
        </form>

      </div>
    </div>
  );
};

export default CompleteProfile;
