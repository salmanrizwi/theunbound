import {
  HomepagePortalTutorialVideoConfig,
  HomepageCashbackRewardsVideoConfig,
} from '../types';

export interface YouTubeValidationResult {
  valid: boolean;
  videoId?: string;
  canonicalUrl?: string;
  embedUrl?: string;
  watchUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface VideoSectionValidationResult {
  valid: boolean;
  errors: string[];
  videoId?: string;
  canonicalUrl?: string;
}

const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Strictly validates a YouTube URL and extracts its canonical 11-character video ID.
 * Supports:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://m.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube-nocookie.com/embed/VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 * Rejects non-YouTube domains, unsafe schemes (javascript:, data:, http:), embedded credentials,
 * and malformed or non-11-character video IDs.
 */
export function parseAndValidateYouTubeUrl(rawUrl?: string | null): YouTubeValidationResult {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter a YouTube video URL.' };
  }

  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'YouTube URL cannot contain spaces.' };
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return { valid: false, error: 'Unsafe URL protocol is not permitted.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: 'Enter a valid full YouTube URL starting with https:// (for example, https://www.youtube.com/watch?v=... or https://youtu.be/...).',
    };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'YouTube URL must use HTTPS.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs containing embedded credentials are not allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_YOUTUBE_HOSTS.has(hostname)) {
    return {
      valid: false,
      error: 'Only official YouTube URLs (youtube.com, youtu.be, youtube-nocookie.com) are allowed.',
    };
  }

  let candidateId = '';
  const pathSegments = parsed.pathname.split('/').filter(Boolean);

  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    candidateId = pathSegments[0] || '';
  } else {
    const first = (pathSegments[0] || '').toLowerCase();
    if (first === 'watch') {
      candidateId = parsed.searchParams.get('v') || '';
    } else if (first === 'embed' || first === 'shorts' || first === 'live') {
      candidateId = pathSegments[1] || '';
    } else {
      // Also support direct watch query parameter if pathname is '/'
      candidateId = parsed.searchParams.get('v') || '';
    }
  }

  if (!YOUTUBE_VIDEO_ID_REGEX.test(candidateId)) {
    return {
      valid: false,
      error: 'Could not extract a valid 11-character YouTube video ID from this URL.',
    };
  }

  return {
    valid: true,
    videoId: candidateId,
    canonicalUrl: getYouTubeWatchUrl(candidateId),
    embedUrl: getYouTubeEmbedUrl(candidateId),
    watchUrl: getYouTubeWatchUrl(candidateId),
    thumbnailUrl: getYouTubeThumbnailCandidates(candidateId)[0],
  };
}

export function isValidYouTubeVideoId(videoId?: string | null): boolean {
  return YOUTUBE_VIDEO_ID_REGEX.test(String(videoId || '').trim());
}

/**
 * Returns the privacy-enhanced YouTube embed URL loaded ONLY after visitor clicks Play.
 * Uses youtube-nocookie.com, standard controls, rel=0, modestbranding=1, playsinline=1.
 */
export function getYouTubeEmbedUrl(videoId: string, options?: { autoplayOnClick?: boolean }): string {
  const cleanId = String(videoId || '').trim();
  if (!YOUTUBE_VIDEO_ID_REGEX.test(cleanId)) return '';
  const autoplay = options?.autoplayOnClick === false ? '0' : '1';
  const params = new URLSearchParams({
    autoplay,
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '0',
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(cleanId)}?${params.toString()}`;
}

export function getYouTubeWatchUrl(videoId: string): string {
  const cleanId = String(videoId || '').trim();
  if (!YOUTUBE_VIDEO_ID_REGEX.test(cleanId)) return '';
  return `https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}`;
}

/**
 * Ordered thumbnail fallback chain from highest quality to universally guaranteed standard quality.
 */
export function getYouTubeThumbnailCandidates(videoId: string, customThumbnailUrl?: string | null): string[] {
  const candidates: string[] = [];
  const custom = String(customThumbnailUrl || '').trim();
  if (custom && isSafeThumbnailUrl(custom)) {
    candidates.push(custom);
  }
  const cleanId = String(videoId || '').trim();
  if (YOUTUBE_VIDEO_ID_REGEX.test(cleanId)) {
    candidates.push(`https://i.ytimg.com/vi/${encodeURIComponent(cleanId)}/maxresdefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${encodeURIComponent(cleanId)}/sddefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${encodeURIComponent(cleanId)}/hqdefault.jpg`);
  }
  return candidates;
}

export function isSafeThumbnailUrl(url?: string | null): boolean {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/jpeg;base64,') || trimmed.startsWith('data:image/png;base64,') || trimmed.startsWith('data:image/webp;base64,') || trimmed.startsWith('data:image/avif;base64,')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function clampTutorialVideoWidthPercent(value?: number | null): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 65;
  return Math.min(70, Math.max(60, Math.round(num)));
}

/**
 * Validates optional CTA destination for Cashback & Rewards section.
 * Accepts relative internal app paths (starting with '/' but not '//') or safe HTTPS URLs.
 */
export function validateCashbackCtaDestination(dest?: string | null): { valid: boolean; normalized?: string; isExternal?: boolean; error?: string } {
  const trimmed = String(dest || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'CTA destination URL or path is required when CTA is enabled.' };
  }
  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'CTA destination cannot contain spaces.' };
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:') || trimmed.startsWith('//')) {
    return { valid: false, error: 'Unsafe CTA destination is not permitted.' };
  }
  if (trimmed.startsWith('/')) {
    return { valid: true, normalized: trimmed, isExternal: false };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'External CTA destinations must use HTTPS.' };
    }
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'CTA URLs cannot include embedded credentials.' };
    }
    return { valid: true, normalized: parsed.toString(), isExternal: true };
  } catch {
    return { valid: false, error: 'Enter an internal route (e.g. /b2b/my-cashback) or a valid https:// URL.' };
  }
}

export function validatePortalTutorialVideoConfig(
  config: HomepagePortalTutorialVideoConfig
): VideoSectionValidationResult {
  const errors: string[] = [];

  if (!config.heading || !config.heading.trim()) {
    errors.push('Section heading is required.');
  }

  const hasUrl = Boolean(config.youtubeUrl && config.youtubeUrl.trim());
  let resolvedVideoId = '';
  let canonicalUrl = '';

  if (hasUrl) {
    const urlCheck = parseAndValidateYouTubeUrl(config.youtubeUrl);
    if (!urlCheck.valid || !urlCheck.videoId) {
      errors.push(urlCheck.error || 'Please enter a valid YouTube URL.');
    } else {
      resolvedVideoId = urlCheck.videoId;
      canonicalUrl = urlCheck.canonicalUrl || config.youtubeUrl.trim();
    }
  } else if (config.isActive) {
    errors.push('A valid YouTube video URL is required before publishing the Portal Tutorial Video section as Active.');
  }

  if (config.customThumbnailUrl && config.customThumbnailUrl.trim() && !isSafeThumbnailUrl(config.customThumbnailUrl)) {
    errors.push('Custom thumbnail URL must be a secure HTTPS image URL or uploaded image.');
  }

  return {
    valid: errors.length === 0,
    errors,
    videoId: resolvedVideoId,
    canonicalUrl,
  };
}

export function validateCashbackRewardsVideoConfig(
  config: HomepageCashbackRewardsVideoConfig
): VideoSectionValidationResult {
  const errors: string[] = [];

  if (!config.heading || !config.heading.trim()) {
    errors.push('Cashback section heading is required.');
  }

  if (!config.description || !config.description.trim()) {
    errors.push('Cashback introductory description is required.');
  }

  const hasUrl = Boolean(config.youtubeUrl && config.youtubeUrl.trim());
  let resolvedVideoId = '';
  let canonicalUrl = '';

  if (hasUrl) {
    const urlCheck = parseAndValidateYouTubeUrl(config.youtubeUrl);
    if (!urlCheck.valid || !urlCheck.videoId) {
      errors.push(urlCheck.error || 'Please enter a valid YouTube URL.');
    } else {
      resolvedVideoId = urlCheck.videoId;
      canonicalUrl = urlCheck.canonicalUrl || config.youtubeUrl.trim();
    }
  } else if (config.isActive) {
    errors.push('A valid YouTube video URL is required before publishing the Cashback & Rewards Video section as Active.');
  }

  if (config.ctaEnabled) {
    if (!config.ctaLabel || !config.ctaLabel.trim()) {
      errors.push('CTA button label is required when CTA is enabled.');
    }
    const destCheck = validateCashbackCtaDestination(config.ctaDestination);
    if (!destCheck.valid) {
      errors.push(destCheck.error || 'Invalid CTA destination.');
    }
  }

  if (config.customThumbnailUrl && config.customThumbnailUrl.trim() && !isSafeThumbnailUrl(config.customThumbnailUrl)) {
    errors.push('Custom thumbnail URL must be a secure HTTPS image URL or uploaded image.');
  }

  return {
    valid: errors.length === 0,
    errors,
    videoId: resolvedVideoId,
    canonicalUrl,
  };
}
