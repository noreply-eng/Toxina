import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitlements } from '../entitlements/EntitlementContext';

const ClinicManagementSection: React.FC = () => {
  const navigate = useNavigate();
  const { entitlements } = useEntitlements();

  const managedClinics = entitlements.clinics.filter((c) =>
    ['owner', 'director', 'clinic_admin'].includes(c.role_in_clinic)
  );

  if (managedClinics.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Administración de Clínica
      </h2>
      <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800">
        {managedClinics.map((clinic) => (
          <div
            key={clinic.clinic_id}
            onClick={() => navigate(`/clinic-admin/${clinic.clinic_id}`)}
            className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 shrink-0">
                <span className="material-symbols-outlined">local_hospital</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{clinic.name}</p>
                <p className="text-xs text-text-muted uppercase">{clinic.role_in_clinic}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/clinic-admin/${clinic.clinic_id}`);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary hover:text-white text-primary text-xs font-bold shrink-0 transition-colors cursor-pointer"
            >
              Configurar Clínica
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ClinicManagementSection;
