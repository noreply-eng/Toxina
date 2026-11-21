import React from 'react';
import { parseVideoUrl } from '../utils/videoEmbed';
import type { PathologyVideoCategory } from '../data/pathologyData';

export const VIDEO_CATEGORY_LABELS: Record<PathologyVideoCategory, string> = {
  technique: 'Técnica de Inyección',
  usg_guided: 'Guía Ecográfica (USG)',
  anatomy: 'Anatomía y Punto Motor',
  reconstitution: 'Reconstitución y Dilución',
  clinical_case: 'Caso Clínico',
};

interface ClinicalVideoPlayerProps {
  url: string;
  title?: string;
  description?: string | null;
  category?: PathologyVideoCategory | string | null;
  muscleLabel?: string | null;
  compact?: boolean;
}

const PROVIDER_BADGE_STYLES: Record<string, { bg: string; icon: string }> = {
  youtube: {
    bg: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
    icon: 'smart_display',
  },
  google_drive: {
    bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: 'cloud_done',
  },
  vimeo: {
    bg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
    icon: 'play_circle',
  },
  direct_video: {
    bg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    icon: 'videocam',
  },
  external: {
    bg: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
    icon: 'open_in_new',
  },
};

const ClinicalVideoPlayer: React.FC<ClinicalVideoPlayerProps> = ({
  url,
  title,
  description,
  category,
  muscleLabel,
  compact = false,
}) => {
  const parsed = parseVideoUrl(url);
  const badge = PROVIDER_BADGE_STYLES[parsed.provider] || PROVIDER_BADGE_STYLES.external;
  const categoryLabel =
    category && category in VIDEO_CATEGORY_LABELS
      ? VIDEO_CATEGORY_LABELS[category as PathologyVideoCategory]
      : category;

  if (!parsed.isValid || !parsed.embedUrl) {
    return (
      <div className="rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500 flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-amber-500">info</span>
        <span>Ingresa un enlace válido de YouTube o Google Drive para previsualizar el video.</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col">
      {/* 16:9 Embedded Video Frame */}
      <div className="relative w-full bg-slate-950" style={{ aspectRatio: '16 / 9' }}>
        {parsed.provider === 'direct_video' ? (
          <video
            src={parsed.embedUrl}
            controls
            preload="metadata"
            className="w-full h-full object-contain"
          />
        ) : (
          <iframe
            src={parsed.embedUrl}
            title={title || 'Video clínico'}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        )}
      </div>

      {/* Metadata footer */}
      <div className={compact ? 'p-3 space-y-1.5' : 'p-4 space-y-2'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${badge.bg}`}
            >
              <span className="material-symbols-outlined text-[13px]">{badge.icon}</span>
              {parsed.providerLabel}
            </span>
            {categoryLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                {categoryLabel}
              </span>
            )}
            {muscleLabel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-[12px]">vaccines</span>
                {muscleLabel}
              </span>
            )}
          </div>

          <a
            href={parsed.externalViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline shrink-0"
          >
            <span>Abrir en {parsed.providerLabel}</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>

        {title && (
          <h4 className="font-bold text-sm text-text-main dark:text-white leading-snug">
            {title}
          </h4>
        )}

        {description && (
          <p className="text-xs text-text-muted dark:text-slate-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default ClinicalVideoPlayer;
