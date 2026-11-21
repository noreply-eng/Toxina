import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitlements } from '../entitlements/EntitlementContext';
import { TIER_LABELS } from '../entitlements/planCatalog';

const ClinicManagementSection: React.FC = () => {
  const navigate = useNavigate();
  const { entitlements, effectiveTier } = useEntitlements();

  const managedClinics = entitlements.clinics.filter((c) =>
    ['owner', 'director', 'clinic_admin'].includes(c.role_in_clinic)
  );

  const hasActivePaidPackage =
    effectiveTier !== 'free' && entitlements.role !== 'enterprise';

  if (managedClinics.length === 0 && !hasActivePaidPackage) return null;

  const isClinicPlan =
    (entitlements.plan_slug || '').includes('clinic') ||
    managedClinics.some((c) => c.type && c.type !== 'solo_practice');

  const tierLabel = TIER_LABELS[effectiveTier];

  return (
    <section>
      <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {isClinicPlan
          ? `Mi Clínica Privada ${tierLabel}`
          : `Mi Consultorio Privado ${tierLabel}`}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-teal-500/10 to-cyan-500/10 dark:from-primary/20 dark:via-teal-900/20 dark:to-slate-900 shadow-sm border border-primary/25 divide-y divide-primary/10">
        {managedClinics.length > 0 ? (
          managedClinics.map((clinic) => {
            const clinicIsSolo =
              clinic.type === 'solo_practice' &&
              !(entitlements.plan_slug || '').includes('clinic');
            return (
              <div
                key={clinic.clinic_id}
                onClick={() => navigate(`/clinic-admin/${clinic.clinic_id}`)}
                className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shrink-0 shadow-sm">
                    <span className="material-symbols-outlined">
                      {clinicIsSolo ? 'medical_services' : 'local_hospital'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-sm truncate">{clinic.name}</p>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 uppercase">
                        {clinicIsSolo ? 'Consultorio Privado' : 'Clínica Privada'} {tierLabel}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      Configurar datos fiscales/COFEPRIS, horarios, agenda y asientos
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/clinic-admin/${clinic.clinic_id}`);
                  }}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black shrink-0 transition-colors cursor-pointer shadow-sm"
                >
                  Abrir Panel
                </button>
              </div>
            );
          })
        ) : (
          <div
            onClick={() => navigate('/clinic-admin')}
            className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-primary/5 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shrink-0 shadow-sm">
                <span className="material-symbols-outlined">
                  {isClinicPlan ? 'local_hospital' : 'medical_services'}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-sm truncate">
                    {isClinicPlan
                      ? `Clínica de ${entitlements.full_name || 'Dr. Especialista'}`
                      : `Consultorio de ${entitlements.full_name || 'Dr. Especialista'}`}
                  </p>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 uppercase">
                    Paquete {tierLabel} Activo
                  </span>
                </div>
                <p className="text-xs text-text-muted truncate mt-0.5">
                  Abrir panel de configuración de tu {isClinicPlan ? 'clínica privada' : 'consultorio privado'}, horarios y agenda
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/clinic-admin');
              }}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black shrink-0 transition-colors cursor-pointer shadow-sm"
            >
              Abrir Panel
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ClinicManagementSection;
