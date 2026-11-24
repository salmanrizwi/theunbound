import React from 'react';
import { HomepagePortalTutorialVideoConfig } from '../../types';
import { INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG } from '../../data/initialHomepage';
import {
  clampTutorialVideoWidthPercent,
  isValidYouTubeVideoId,
  parseAndValidateYouTubeUrl,
} from '../../utils/youtubeValidation';
import { YouTubeClickToPlayPlayer } from './YouTubeClickToPlayPlayer';

interface PortalTutorialVideoSectionProps {
  config?: HomepagePortalTutorialVideoConfig;
  sectionActive?: boolean;
  previewMode?: boolean;
}

const DESKTOP_WIDTH_CLASS_MAP: Record<number, string> = {
  60: 'lg:w-[60%]',
  61: 'lg:w-[61%]',
  62: 'lg:w-[62%]',
  63: 'lg:w-[63%]',
  64: 'lg:w-[64%]',
  65: 'lg:w-[65%]',
  66: 'lg:w-[66%]',
  67: 'lg:w-[67%]',
  68: 'lg:w-[68%]',
  69: 'lg:w-[69%]',
  70: 'lg:w-[70%]',
};

const SECTION_BACKGROUND_CLASSES = {
  'pure-white': 'bg-white text-slate-900',
  'soft-slate': 'bg-slate-50/90 text-slate-900 border-y border-slate-200/70',
  'subtle-teal-wash': 'bg-gradient-to-b from-[#F2FBF9] via-white to-[#F4FBF9] text-slate-900 border-y border-teal-100/80',
  'dark-charcoal': 'bg-slate-950 text-white border-y border-slate-800/80',
} as const;

export const PortalTutorialVideoSection: React.FC<PortalTutorialVideoSectionProps> = ({
  config,
  sectionActive = true,
  previewMode = false,
}) => {
  const merged: HomepagePortalTutorialVideoConfig = {
    ...INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG,
    ...(config || {}),
  };

  // Resolve video ID from stored field or URL fallback
  let resolvedVideoId = String(merged.youtubeVideoId || '').trim();
  if (!isValidYouTubeVideoId(resolvedVideoId) && merged.youtubeUrl) {
    const parsed = parseAndValidateYouTubeUrl(merged.youtubeUrl);
    if (parsed.valid && parsed.videoId) {
      resolvedVideoId = parsed.videoId;
    }
  }

  const hasValidVideo = isValidYouTubeVideoId(resolvedVideoId);

  // On the live homepage, hide cleanly when inactive or when no valid YouTube URL has been configured
  if (!previewMode) {
    if (!sectionActive || merged.isActive === false || !hasValidVideo) {
      return null;
    }
  }

  const isDark = merged.backgroundStyle === 'dark-charcoal';
  const bgClass = SECTION_BACKGROUND_CLASSES[merged.backgroundStyle] || SECTION_BACKGROUND_CLASSES['pure-white'];
  const clampedWidth = clampTutorialVideoWidthPercent(merged.videoMaxWidthPercent);
  const desktopWidthClass = DESKTOP_WIDTH_CLASS_MAP[clampedWidth] || 'lg:w-[65%]';
  const isCentered = merged.alignment !== 'left';

  return (
    <section
      id="portal-tutorial-video"
      aria-labelledby="portal-tutorial-video-heading"
      className={`${bgClass} ${previewMode ? 'py-10 sm:py-12 rounded-2xl' : 'py-14 sm:py-20 lg:py-24'}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading & Supporting Description */}
        <div
          className={`max-w-3xl space-y-3 ${
            isCentered ? 'mx-auto text-center' : 'text-left'
          }`}
        >
          {merged.eyebrowText && merged.eyebrowText.trim() && (
            <p
              className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                isDark ? 'text-[#00C6A6]' : 'text-[#008972]'
              }`}
            >
              {merged.eyebrowText}
            </p>
          )}

          <h2
            id="portal-tutorial-video-heading"
            className={`text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {merged.heading || INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG.heading}
          </h2>

          {merged.description && merged.description.trim() && (
            <p
              className={`text-sm leading-relaxed sm:text-base lg:text-lg ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {merged.description}
            </p>
          )}
        </div>

        {/* Prominent 16:9 Video Container (Desktop 60%-70%, Tablet ~88%, Mobile 100%) */}
        <div
          className={`mt-8 sm:mt-10 lg:mt-12 w-full md:w-[88%] ${desktopWidthClass} ${
            isCentered ? 'mx-auto' : ''
          }`}
        >
          <YouTubeClickToPlayPlayer
            videoId={resolvedVideoId}
            title={merged.heading || 'TheUnbound Portal Tutorial'}
            customThumbnailUrl={merged.customThumbnailUrl}
            darkSurface={isDark}
            previewMode={previewMode}
            emptyPreviewLabel="Add a valid YouTube tutorial URL to preview the Portal Walkthrough video player."
            playAriaLabel={`Play portal tutorial video: ${merged.heading || 'Explore TheUnbound Portal'}`}
          />
        </div>
      </div>
    </section>
  );
};
