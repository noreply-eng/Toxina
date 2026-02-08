import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMuscleById } from '../data/muscleData';

const MotorPoints: React.FC = () => {
  const navigate = useNavigate();
  const { muscleId } = useParams<{ muscleId: string }>();
  const [view, setView] = useState<'Anatomía' | 'USG'>('USG');

  // Get muscle data
  const muscle = muscleId ? getMuscleById(muscleId) : null;

  if (!muscle) {
    return (
      <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark items-center justify-center p-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-4xl text-slate-400">error</span>
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          Músculo no encontrado
        </h3>
        <p className="text-sm text-slate-500 text-center mb-4">
          El músculo solicitado no existe en la base de datos
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-primary text-white rounded-lg font-bold"
        >
          Volver
        </button>
      </div>
    );
  }

  // Get category name in Spanish
  const categoryNames = {
    'face': 'Cara',
    'neck': 'Cuello',
    'upper-limb': 'Miembro Superior',
    'lower-limb': 'Miembro Inferior',
    'trunk': 'Tronco'
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-surface-dark/90 px-4 py-3 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-bold leading-tight flex-1 text-center truncate px-2 text-text-main dark:text-white">
          {muscle.name}
        </h1>
        <button className="flex size-10 items-center justify-center rounded-full">
          <span className="material-symbols-outlined">bookmark_border</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-5 pt-6 pb-2">
          <span className="inline-block px-2 py-1 mb-2 text-[10px] font-bold tracking-widest text-primary bg-primary/10 rounded uppercase">
            {categoryNames[muscle.category]}
          </span>
          <h2 className="text-3xl font-black tracking-tight leading-none mb-1 text-text-main dark:text-white">{muscle.latinName}</h2>
          <h3 className="text-xl font-medium text-text-muted">{muscle.region}</h3>
          <p className="mt-4 text-base font-normal leading-relaxed text-text-muted">
            <span className="font-bold text-text-main dark:text-white">Función Primaria:</span> {muscle.anatomy.function}
          </p>
        </div>

        {/* Anatomy/USG Toggle */}
        {muscle.usgGuidance && (
          <div className="px-5 py-4 sticky top-[60px] z-40 bg-background-light dark:bg-background-dark">
            <div className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 p-1">
              <button 
                onClick={() => setView('Anatomía')}
                className={`flex-1 h-full rounded-lg text-sm font-bold transition-all ${view === 'Anatomía' ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-slate-500'}`}
              >
                Anatomía
              </button>
              <button 
                onClick={() => setView('USG')}
                className={`flex-1 h-full rounded-lg text-sm font-bold transition-all ${view === 'USG' ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-slate-500'}`}
              >
                Ultrasonido (USG)
              </button>
            </div>
          </div>
        )}

        {/* Image Section */}
        {muscle.usgGuidance && view === 'USG' ? (
          <div className="px-5 pb-6">
            <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-lg bg-gray-900 group">
               <div 
                 className="absolute inset-0 bg-cover bg-center opacity-80" 
                 style={{backgroundImage: muscle.usgGuidance.imageUrl ? `url('${muscle.usgGuidance.imageUrl}')` : `url('https://images.unsplash.com/photo-1559757175-0eb30cd8c063?auto=format&fit=crop&q=80&w=800')`}}
               />
               <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold border border-white/10">
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    {muscle.usgGuidance.view.toUpperCase()}
                  </span>
               </div>
               
               {/* Interactive Pin */}
               {muscle.motorPoint.coordinates && (
                 <div 
                   className="absolute flex flex-col items-center group-hover:scale-110 transition-transform cursor-pointer"
                   style={{ 
                     top: `${muscle.motorPoint.coordinates.y}%`, 
                     left: `${muscle.motorPoint.coordinates.x}%` 
                   }}
                 >
                    <div className="relative flex items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                      <div className="relative flex size-6 items-center justify-center rounded-full bg-primary text-white shadow-lg border-2 border-white">
                        <span className="material-symbols-outlined text-[14px] font-bold">target</span>
                      </div>
                    </div>
                    <div className="mt-2 px-3 py-1.5 bg-white/95 dark:bg-surface-dark/95 backdrop-blur rounded-lg shadow-xl border border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] font-black text-primary uppercase">Punto Motor</p>
                      <p className="text-[8px] text-text-muted font-bold uppercase">{muscle.region}</p>
                    </div>
                 </div>
               )}
            </div>
            
            <div className="mt-3 flex items-start gap-2 text-[10px] text-text-muted px-1">
              <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
              <p className="font-medium">{muscle.motorPoint.description}</p>
            </div>
          </div>
        ) : (
          /* Anatomy View - Show anatomical details */
          <div className="px-5 pb-6">
            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div>
                <h4 className="font-bold text-sm text-text-main dark:text-white mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">neurology</span>
                  Inervación
                </h4>
                <p className="text-sm text-text-muted">{muscle.anatomy.innervation}</p>
              </div>
              <div>
                <h4 className="font-bold text-sm text-text-main dark:text-white mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">start</span>
                  Origen
                </h4>
                <p className="text-sm text-text-muted">{muscle.anatomy.origin}</p>
              </div>
              <div>
                <h4 className="font-bold text-sm text-text-main dark:text-white mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                  Inserción
                </h4>
                <p className="text-sm text-text-muted">{muscle.anatomy.insertion}</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 space-y-4">
          {/* Dosing Information */}
          <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
             <div className="flex items-center gap-3 mb-4">
               <div className="size-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                 <span className="material-symbols-outlined">medication</span>
               </div>
               <h3 className="font-bold text-text-main dark:text-white">Dosificación</h3>
             </div>
             <div className="space-y-3">
               <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                 <span className="font-bold text-sm text-text-main dark:text-white">Botox</span>
                 <span className="text-sm text-primary font-bold">{muscle.dosing.botox.min}-{muscle.dosing.botox.max} U</span>
               </div>
               <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                 <span className="font-bold text-sm text-text-main dark:text-white">Dysport</span>
                 <span className="text-sm text-primary font-bold">{muscle.dosing.dysport.min}-{muscle.dosing.dysport.max} U</span>
               </div>
               <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                 <span className="font-bold text-sm text-text-main dark:text-white">Xeomin</span>
                 <span className="text-sm text-primary font-bold">{muscle.dosing.xeomin.min}-{muscle.dosing.xeomin.max} U</span>
               </div>
             </div>
          </div>

          {/* Injection Technique */}
          <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
             <div className="flex items-center gap-3 mb-4">
               <div className="size-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary">
                 <span className="material-symbols-outlined">vaccines</span>
               </div>
               <h3 className="font-bold text-text-main dark:text-white">Técnica de Inyección</h3>
             </div>
             <ul className="space-y-3">
               {muscle.motorPoint.techniqueNotes.map((note, idx) => (
                 <li key={idx} className="flex gap-3 text-xs leading-relaxed text-text-muted">
                   <div className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                   <span>{note}</span>
                 </li>
               ))}
             </ul>
          </div>

          {/* USG Guidance Section */}
          {muscle.usgGuidance && (
            <>
              <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                 <div className="flex items-center gap-3 mb-4">
                   <div className="size-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                     <span className="material-symbols-outlined">ultrasound</span>
                   </div>
                   <h3 className="font-bold text-text-main dark:text-white">Guía de Ultrasonido</h3>
                 </div>
                 <div className="space-y-3">
                   <div>
                     <p className="text-xs font-bold text-text-main dark:text-white mb-1">Transductor:</p>
                     <p className="text-xs text-text-muted">{muscle.usgGuidance.transducerType}</p>
                   </div>
                   <div>
                     <p className="text-xs font-bold text-text-main dark:text-white mb-1">Abordaje:</p>
                     <p className="text-xs text-text-muted">{muscle.usgGuidance.approach}</p>
                   </div>
                   <div>
                     <p className="text-xs font-bold text-text-main dark:text-white mb-1">Puntos de Referencia:</p>
                     <ul className="space-y-1">
                       {muscle.usgGuidance.landmarks.map((landmark, idx) => (
                         <li key={idx} className="flex gap-2 text-xs text-text-muted">
                           <div className="size-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                           <span>{landmark}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 </div>
              </div>

              {/* Precautions */}
              <div className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                 <div className="flex items-center gap-3 mb-3">
                   <div className="size-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600">
                     <span className="material-symbols-outlined">warning</span>
                   </div>
                   <h3 className="font-bold text-orange-900 dark:text-orange-200">Precauciones</h3>
                 </div>
                 <ul className="space-y-2">
                   {muscle.usgGuidance.precautions.map((precaution, idx) => (
                     <li key={idx} className="flex gap-2 text-xs text-orange-800 dark:text-orange-300 leading-relaxed">
                       <div className="size-1.5 rounded-full bg-orange-600 mt-1.5 shrink-0" />
                       <span>{precaution}</span>
                     </li>
                   ))}
                 </ul>
              </div>
            </>
          )}

          {/* Clinical Indications */}
          <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
             <div className="flex items-center gap-3 mb-4">
               <div className="size-10 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                 <span className="material-symbols-outlined">clinical_notes</span>
               </div>
               <h3 className="font-bold text-text-main dark:text-white">Indicaciones Clínicas</h3>
             </div>
             <div className="flex flex-wrap gap-2">
               {muscle.indications.map((indication, idx) => (
                 <span 
                   key={idx}
                   className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full"
                 >
                   {indication}
                 </span>
               ))}
             </div>
          </div>
        </div>
      </main>
      
      <div className="fixed bottom-[85px] left-0 right-0 p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-lg flex justify-center z-40">
        <button 
          onClick={() => navigate('/calculator')}
          className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <span className="material-symbols-outlined">calculate</span>
          CALCULAR DOSIS
        </button>
      </div>
    </div>
  );
};

export default MotorPoints;
