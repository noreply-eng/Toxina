import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Search: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    const { data } = await supabase.from('patients').select('*').order('full_name');
    if (data) setPatients(data);
    setLoadingPatients(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    
    // Delete patient and related data
    await supabase.from('consultations').delete().eq('patient_id', deleteConfirm.id);
    await supabase.from('patients').delete().eq('id', deleteConfirm.id);
    
    // Refresh list
    await fetchPatients();
    setDeleteConfirm(null);
    setDeleting(false);
  };

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const query = searchQuery.toLowerCase();
    return patients.filter(p => 
      p.full_name?.toLowerCase().includes(query) || 
      p.email?.toLowerCase().includes(query) ||
      p.phone?.includes(query)
    );
  }, [searchQuery, patients]);

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
      <header className="bg-white dark:bg-surface-dark px-4 pb-2 pt-12 sticky top-0 z-10 shadow-sm border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-text-main dark:text-white">
            Buscar Pacientes
          </h1>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-[10px] font-bold bg-primary/10 text-primary rounded">
              {filteredPatients.length} {filteredPatients.length === 1 ? 'paciente' : 'pacientes'}
            </span>
          </div>
        </div>

        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input 
            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 pl-10 pr-4 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-slate-700 transition-all" 
            placeholder="Buscar paciente por nombre, email o teléfono..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="p-4 space-y-3">
          {loadingPatients ? (
            <div className="flex justify-center p-8">
              <p className="text-text-muted animate-pulse">Cargando pacientes...</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-slate-400">person_off</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">No se encontraron pacientes</h3>
              <p className="text-xs text-slate-500 text-center">Intenta con otro nombre o crea un nuevo paciente.</p>
              <button 
                onClick={() => navigate('/patient/new')}
                className="mt-4 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl"
              >
                Crear Paciente
              </button>
            </div>
          ) : (
            filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center p-3 bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-primary/50"
              >
                {/* Avatar - clickable to view patient */}
                <div 
                  onClick={() => navigate(`/patient/${patient.id}`)}
                  className="cursor-pointer"
                >
                  {patient.avatar_url ? (
                    <div className="size-12 rounded-full bg-center bg-cover border border-slate-100 dark:border-slate-700" style={{ backgroundImage: `url('${patient.avatar_url}')` }} />
                  ) : (
                    <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                  )}
                </div>
                
                {/* Info - clickable to view patient */}
                <div 
                  onClick={() => navigate(`/patient/${patient.id}`)}
                  className="ml-3 flex-1 min-w-0 cursor-pointer"
                >
                  <p className="font-bold text-slate-900 dark:text-white truncate">{patient.full_name}</p>
                  <p className="text-xs text-text-muted truncate">{patient.email || patient.phone || 'Sin contacto'}</p>
                </div>
                
                {/* Quick action buttons */}
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/patient/${patient.id}/edit`);
                    }}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-primary transition-colors"
                    title="Editar paciente"
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ id: patient.id, name: patient.full_name });
                    }}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-600 transition-colors"
                    title="Eliminar paciente"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
              <span className="material-symbols-outlined text-2xl text-red-600">warning</span>
            </div>
            <h3 className="text-lg font-bold text-center text-slate-900 dark:text-white mb-2">
              ¿Eliminar paciente?
            </h3>
            <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">
              Se eliminará permanentemente a <strong>{deleteConfirm.name}</strong> y todas sus consultas asociadas. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Eliminando...
                  </>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;

