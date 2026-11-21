export type VideoSourceProvider =
  | 'youtube'
  | 'google_drive'
  | 'vimeo'
  | 'direct_video'
  | 'external';

export interface ParsedVideoUrl {
  provider: VideoSourceProvider;
  providerLabel: string;
  originalUrl: string;
  embedUrl: string | null;
  externalViewUrl: string;
  videoId: string | null;
  thumbnailUrl: string | null;
  isValid: boolean;
}

/**
 * Extracts a YouTube 11-char video ID from any YouTube URL format:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 */
export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const patterns = [
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
    /^([A-Za-z0-9_-]{11})$/,
  ];

  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match?.[1]) return match[1];
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    }
  } catch {
    // ignore invalid URL
  }

  return null;
}

/**
 * Extracts a Google Drive File ID from any Google Drive sharing URL:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/file/d/FILE_ID/preview
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://docs.google.com/file/d/FILE_ID/edit
 */
export function extractGoogleDriveFileId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (!/drive\.google\.com|docs\.google\.com/i.test(trimmed)) {
    return null;
  }

  const fileDMatch = trimmed.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/i);
  if (fileDMatch?.[1]) return fileDMatch[1];

  const idParamMatch = trimmed.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
  if (idParamMatch?.[1]) return idParamMatch[1];

  return null;
}

export function extractVimeoId(url: string): string | null {
  const trimmed = url.trim();
  const match = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match?.[1] ?? null;
}

/**
 * Parses a video URL from YouTube, Google Drive, Vimeo, or direct MP4/WebM
 * and returns a normalized embeddable URL + metadata.
 */
export function parseVideoUrl(rawUrl?: string | null): ParsedVideoUrl {
  const originalUrl = (rawUrl || '').trim();
  if (!originalUrl) {
    return {
      provider: 'external',
      providerLabel: 'Sin URL',
      originalUrl: '',
      embedUrl: null,
      externalViewUrl: '',
      videoId: null,
      thumbnailUrl: null,
      isValid: false,
    };
  }

  // 1. YouTube
  const ytId = extractYouTubeId(originalUrl);
  if (ytId) {
    return {
      provider: 'youtube',
      providerLabel: 'YouTube',
      originalUrl,
      embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`,
      externalViewUrl: `https://www.youtube.com/watch?v=${ytId}`,
      videoId: ytId,
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      isValid: true,
    };
  }

  // 2. Google Drive
  const driveId = extractGoogleDriveFileId(originalUrl);
  if (driveId) {
    return {
      provider: 'google_drive',
      providerLabel: 'Google Drive',
      originalUrl,
      embedUrl: `https://drive.google.com/file/d/${driveId}/preview`,
      externalViewUrl: `https://drive.google.com/file/d/${driveId}/view`,
      videoId: driveId,
      thumbnailUrl: null,
      isValid: true,
    };
  }

  // 3. Vimeo
  const vimeoId = extractVimeoId(originalUrl);
  if (vimeoId) {
    return {
      provider: 'vimeo',
      providerLabel: 'Vimeo',
      originalUrl,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      externalViewUrl: `https://vimeo.com/${vimeoId}`,
      videoId: vimeoId,
      thumbnailUrl: null,
      isValid: true,
    };
  }

  // 4. Direct video file (.mp4, .webm, .mov, .ogg)
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(originalUrl)) {
    return {
      provider: 'direct_video',
      providerLabel: 'Video Directo',
      originalUrl,
      embedUrl: originalUrl,
      externalViewUrl: originalUrl,
      videoId: null,
      thumbnailUrl: null,
      isValid: true,
    };
  }

  // 5. Generic https URL fallback
  const isHttp = /^https?:\/\//i.test(originalUrl);
  return {
    provider: 'external',
    providerLabel: 'Enlace Externo',
    originalUrl,
    embedUrl: isHttp ? originalUrl : null,
    externalViewUrl: originalUrl,
    videoId: null,
    thumbnailUrl: null,
    isValid: isHttp,
  };
}
