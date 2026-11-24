import React, { useState, useEffect, useMemo } from 'react';
import { Play, ExternalLink, Video, AlertCircle } from 'lucide-react';
import {
  isValidYouTubeVideoId,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
  getYouTubeThumbnailCandidates,
} from '../../utils/youtubeValidation';

interface YouTubeClickToPlayPlayerProps {
  videoId?: string | null;
  title: string;
  customThumbnailUrl?: string | null;
  darkSurface?: boolean;
  previewMode?: boolean;
  emptyPreviewLabel?: string;
  playAriaLabel?: string;
  compact?: boolean;
}

/**
 * Privacy-conscious, performance-optimized YouTube video player.
 * - Reserves exact 16:9 aspect ratio (zero Cumulative Layout Shift).
 * - Renders thumbnail + Play button on initial load (ZERO iframe mounted on page load).
 * - Never autoplays on page load; loads official youtube-nocookie.com embed ONLY after visitor clicks Play.
 * - Provides graceful thumbnail fallback chain (custom -> maxresdefault -> sddefault -> hqdefault -> clean branded card)
 *   and a direct Watch on YouTube fallback link if embedding is blocked or unavailable.
 */
export const YouTubeClickToPlayPlayer: React.FC<YouTubeClickToPlayPlayerProps> = ({
  videoId,
  title,
  customThumbnailUrl,
  darkSurface = false,
  previewMode = false,
  emptyPreviewLabel = 'Paste a valid YouTube URL in the editor to preview playback here.',
  playAriaLabel,
  compact = false,
}) => {
  const cleanVideoId = String(videoId || '').trim();
  const hasValidVideo = isValidYouTubeVideoId(cleanVideoId);

  const thumbnailCandidates = useMemo(
    () => (hasValidVideo ? getYouTubeThumbnailCandidates(cleanVideoId, customThumbnailUrl) : []),
    [hasValidVideo, cleanVideoId, customThumbnailUrl]
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbIndex, setThumbIndex] = useState(0);
  const [iframeError, setIframeError] = useState(false);

  // Reset player state when admin changes the video or thumbnail in preview/CMS
  useEffect(() => {
    setIsPlaying(false);
    setThumbIndex(0);
    setIframeError(false);
  }, [cleanVideoId, customThumbnailUrl]);

  const activeThumbnail = thumbnailCandidates[thumbIndex] || '';
  const embedUrl = hasValidVideo ? getYouTubeEmbedUrl(cleanVideoId, { autoplayOnClick: true }) : '';
  const watchUrl = hasValidVideo ? getYouTubeWatchUrl(cleanVideoId) : '';

  const frameBorderClass = darkSurface
    ? 'border-slate-700/80 bg-slate-900 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.65)]'
    : 'border-slate-200/90 bg-slate-950 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.22)]';

  if (!hasValidVideo) {
    if (!previewMode) return null;
    return (
      <div
        className={`relative aspect-video w-full overflow-hidden rounded-2xl border ${
          darkSurface
            ? 'border-slate-700 bg-slate-900/90 text-slate-300'
            : 'border-dashed border-slate-300 bg-slate-50 text-slate-600'
        } flex flex-col items-center justify-center p-6 text-center`}
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            darkSurface ? 'bg-slate-800 text-[#00C6A6]' : 'bg-teal-50 text-[#008972]'
          }`}
        >
          <Video className="h-5 w-5" />
        </div>
        <p className={`mt-3 text-sm font-semibold ${darkSurface ? 'text-white' : 'text-slate-900'}`}>
          YouTube Video Preview Ready
        </p>
        <p className={`mt-1 max-w-sm text-xs leading-relaxed ${darkSurface ? 'text-slate-400' : 'text-slate-500'}`}>
          {emptyPreviewLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className={`relative aspect-video w-full overflow-hidden rounded-2xl border ${frameBorderClass} transition-shadow duration-300`}
        data-youtube-player="true"
        data-video-id={cleanVideoId}
        data-player-state={isPlaying ? 'playing' : 'thumbnail'}
      >
        {isPlaying && !iframeError ? (
          <iframe
            src={embedUrl}
            title={title || 'TheUnbound Video'}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            loading="lazy"
            onError={() => setIframeError(true)}
          />
        ) : iframeError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 px-6 text-center text-white">
            <AlertCircle className="h-8 w-8 text-[#00C6A6]" />
            <p className="mt-3 text-sm font-semibold">
              Unable to load embedded player
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-300">
              This video may restrict third-party embedding or your network may block YouTube embeds.
            </p>
            {watchUrl && (
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#008972] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#00735F]"
              >
                Watch on YouTube
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            aria-label={playAriaLabel || `Play video: ${title}`}
            className="group relative block h-full w-full cursor-pointer overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C6A6] focus-visible:ring-offset-2"
          >
            {activeThumbnail ? (
              <img
                src={activeThumbnail}
                alt={title || 'Video preview thumbnail'}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                onError={() => {
                  if (thumbIndex + 1 < thumbnailCandidates.length) {
                    setThumbIndex((prev) => prev + 1);
                  } else {
                    setThumbIndex(thumbnailCandidates.length);
                  }
                }}
                onLoad={(e) => {
                  // YouTube returns a 120x90 grey placeholder when maxresdefault doesn't exist for a video
                  const imgEl = e.currentTarget;
                  if (
                    activeThumbnail.includes('maxresdefault.jpg') &&
                    imgEl.naturalWidth <= 120 &&
                    thumbIndex + 1 < thumbnailCandidates.length
                  ) {
                    setThumbIndex((prev) => prev + 1);
                  }
                }}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 px-6 text-center">
                <Video className="h-10 w-10 text-[#00C6A6]/70" />
                <p className="mt-2 text-xs font-medium text-slate-300">{title}</p>
              </div>
            )}

            {/* Subtle editorial gradient scrim for legibility and button contrast */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-slate-950/10 transition-colors duration-300 group-hover:from-slate-950/50 group-hover:via-slate-950/10" />

            {/* Prominent centered Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className={`flex items-center justify-center rounded-full bg-white/95 text-[#008972] shadow-[0_14px_34px_rgba(0,0,0,0.32)] ring-4 ring-white/25 transition-all duration-300 group-hover:scale-105 group-hover:bg-[#00C6A6] group-hover:text-slate-950 group-hover:ring-[#00C6A6]/35 ${
                  compact ? 'h-14 w-14 sm:h-16 sm:w-16' : 'h-16 w-16 sm:h-20 sm:w-20'
                }`}
              >
                <Play
                  className={`${compact ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-7 w-7 sm:h-8 sm:w-8'} translate-x-0.5 fill-current`}
                />
              </span>
            </div>

            {/* Clean bottom caption bar */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
              <span className="truncate text-xs font-medium text-white/95 drop-shadow-sm sm:text-sm">
                Watch Video
              </span>
              <span className="shrink-0 text-[11px] font-medium tracking-wide text-white/80">
                YouTube
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Subtle fallback link visible once playback starts in case YouTube blocks embed */}
      {isPlaying && !iframeError && watchUrl && (
        <div className="mt-2.5 flex justify-end">
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
              darkSurface
                ? 'text-slate-400 hover:text-[#00C6A6]'
                : 'text-slate-500 hover:text-[#008972]'
            }`}
          >
            Having trouble playing? Watch on YouTube
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
};
