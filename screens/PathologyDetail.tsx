import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPathologyById } from '../data/pathologyData';

const PathologyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [referencesExpanded, setReferencesExpanded] = useState(false);

  const pathology = getPathologyById(id || '');

  if (!pathology) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-4">
        <span className="material-symbols-outlined text-6xl text-text-muted mb-4">error</span>
        <h2 className="text-xl font-bold text-text-main dark:text-white mb-2">Patología no encontrada</h2>
        <button 
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-6 py-2 bg-primary text-white rounded-lg"
        >
          Volver al Dashboard
        </button>
      </div>
    );
  }

  const categoryColors = {
    neurological: 'bg-blue-500',
    autonomic: 'bg-green-500',
    urological: 'bg-purple-500',
    aesthetic: 'bg-pink-500',
  };

  const categoryLabels = {
    neurological: 'Neurológica',
    autonomic: 'Autonómica',
    urological: 'Urológica',
    aesthetic: 'Estética',
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <button 
          onClick={() => navigate('/dashboard')} 
          className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold leading-tight flex-1 text-center pr-10 text-text-main dark:text-white">
          {pathology.title}
        </h1>
      </header>

      {/* Hero Image */}
      <div className="relative w-full h-48 overflow-hidden">
        <img 
          src={pathology.image} 
          alt={pathology.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent" />
      </div>

      {/* Content */}
      <div className="px-4 -mt-6 relative z-10">
        {/* Category Badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`${categoryColors[pathology.category]} text-white text-xs font-bold px-3 py-1 rounded-full`}>
            {categoryLabels[pathology.category]}
          </span>
          <span className="text-text-muted dark:text-slate-400 text-sm">{pathology.subtitle}</span>
        </div>

        {/* Description */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 mb-4">
          <h2 className="text-base font-bold text-text-main dark:text-white mb-3">Descripción</h2>
          <p className="text-sm text-text-muted dark:text-slate-300 leading-relaxed">
            {pathology.description}
          </p>
        </div>

        {/* Dosage Protocol */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 mb-4">
          <h2 className="text-base font-bold text-text-main dark:text-white mb-4">Protocolo de Dosificación</h2>
          <div className="space-y-3">
            {pathology.protocols.map((protocol, idx) => (
              <div 
                key={idx} 
                className="bg-background-light dark:bg-slate-800/50 rounded-lg p-3 border-l-4 border-primary"
              >
                {protocol.muscle && (
                  <p className="font-bold text-sm text-text-main dark:text-white mb-1">
                    {protocol.muscle}
                  </p>
                )}
                <p className="text-sm text-primary font-semibold mb-1">{protocol.dose}</p>
                {protocol.notes && (
                  <p className="text-xs text-text-muted dark:text-slate-400 italic">
                    {protocol.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 mb-4">
          <h2 className="text-base font-bold text-text-main dark:text-white mb-3">Información Adicional</h2>
          
          {pathology.frequency && (
            <div className="mb-3">
              <p className="text-xs font-bold text-text-muted dark:text-slate-400 uppercase mb-1">Frecuencia</p>
              <p className="text-sm text-text-main dark:text-white">{pathology.frequency}</p>
            </div>
          )}

          {pathology.maxDose && (
            <div className="mb-3">
              <p className="text-xs font-bold text-text-muted dark:text-slate-400 uppercase mb-1">Dosis Máxima</p>
              <p className="text-sm text-text-main dark:text-white">{pathology.maxDose}</p>
            </div>
          )}

          {pathology.additionalInfo && pathology.additionalInfo.length > 0 && (
            <div>
              <p className="text-xs font-bold text-text-muted dark:text-slate-400 uppercase mb-2">Notas Clínicas</p>
              <ul className="space-y-1">
                {pathology.additionalInfo.map((info, idx) => (
                  <li key={idx} className="text-sm text-text-main dark:text-white flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                    <span className="flex-1">{info}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* References */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
          <button
            onClick={() => setReferencesExpanded(!referencesExpanded)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-base font-bold text-text-main dark:text-white">
              Referencias Bibliográficas ({pathology.references.length})
            </h2>
            <span className="material-symbols-outlined text-text-muted">
              {referencesExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {referencesExpanded && (
            <div className="mt-4 space-y-3">
              {pathology.references.map((ref, idx) => {
                // Regex to find URLs
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const parts = ref.split(urlRegex);

                return (
                  <div key={idx} className="text-xs text-text-muted dark:text-slate-300 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-primary mr-1">[{idx + 1}]</span>
                    {parts.map((part, i) => {
                      if (part.match(urlRegex)) {
                        return (
                          <a 
                            key={i} 
                            href={part} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all"
                            onClick={(e) => e.stopPropagation()} 
                          >
                            {part}
                          </a>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB - Go to Calculator */}
      <button 
        onClick={() => navigate('/calculator')}
        className="fixed bottom-24 right-6 bg-primary text-white rounded-full size-14 flex items-center justify-center shadow-lg active:scale-95 transition-transform z-30"
      >
        <span className="material-symbols-outlined text-2xl">calculate</span>
      </button>
    </div>
  );
};

export default PathologyDetail;
