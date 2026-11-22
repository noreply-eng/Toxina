import React from 'react';
import { useNavigate } from 'react-router-dom';
import Facial3DAdminStudio from '../features/super-admin/components/Facial3DAdminStudio';

const AdminFacial3D: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 lg:pb-8">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/super-admin?tab=anatomy3d')}
              className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Volver al panel Admin"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight truncate">
                Anatomía Facial 3D · Admin Studio
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                Visor interactivo 3D, mapeo Z-Anatomy (.glb) y editor de puntos motores
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/super-admin')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold cursor-pointer shrink-0"
          >
            Consola SuperAdmin
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <Facial3DAdminStudio fullscreen />
      </main>
    </div>
  );
};

export default AdminFacial3D;
