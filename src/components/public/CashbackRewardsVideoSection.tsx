import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { HomepageCashbackRewardsVideoConfig, User } from '../../types';
import { INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG } from '../../data/initialHomepage';
import {
  isValidYouTubeVideoId,
  parseAndValidateYouTubeUrl,
  validateCashbackCtaDestination,
} from '../../utils/youtubeValidation';
import { navigateTo, setIntendedPath } from '../../services/portalRouter';
import { YouTubeClickToPlayPlayer } from './YouTubeClickToPlayPlayer';

interface CashbackRewardsVideoSectionProps {
  config?: HomepageCashbackRewardsVideoConfig;
  sectionActive?: boolean;
  previewMode?: boolean;
  user?: User | null;
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
}

const SECTION_BACKGROUND_CLASSES = {
  'pure-white': 'bg-white text-slate-900',
  'soft-slate': 'bg-slate-50/90 text-slate-900 border-y border-slate-200/70',
  'subtle-teal-wash': 'bg-gradient-to-br from-[#F2FBF9] via-white to-slate-50 text-slate-900 border-y border-teal-100/80',
  'dark-charcoal': 'bg-slate-950 text-white border-y border-slate-800/80',
} as const;

/**
 * Public Homepage Cashback & Rewards two-column section.
 * - Left column: Editorial cashback overview, configurable benefit points, optional supporting note, optional CTA.
 * - Right column: Smaller 16:9 click-to-load YouTube explainer video player.
 * - Responsive: Desktop & Tablet two columns (text left, video right); Mobile stacked (text first, video below).
 * - Privacy invariant: NEVER queries or displays private wallet balances, individual agent cashback data,
 *   or modifies any cashback calculation logic.
 */
export const CashbackRewardsVideoSection: React.FC<CashbackRewardsVideoSectionProps> = ({
  config,
  sectionActive = true,
  previewMode = false,
  user = null,
  isAuthenticated = false,
  onRequireAuth,
}) => {
  const merged: HomepageCashbackRewardsVideoConfig = {
    ...INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG,
    ...(config || {}),
    benefitPoints: Array.isArray(config?.benefitPoints)
      ? config.benefitPoints
      : INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG.benefitPoints,
  };

  let resolvedVideoId = String(merged.youtubeVideoId || '').trim();
  if (!isValidYouTubeVideoId(resolvedVideoId) && merged.youtubeUrl) {
    const parsed = parseAndValidateYouTubeUrl(merged.youtubeUrl);
    if (parsed.valid && parsed.videoId) {
      resolvedVideoId = parsed.videoId;
    }
  }

  const hasValidVideo = isValidYouTubeVideoId(resolvedVideoId);

  if (!previewMode) {
    if (!sectionActive || merged.isActive === false || !hasValidVideo) {
      return null;
    }
  }

  const isDark = merged.backgroundStyle === 'dark-charcoal';
  const bgClass = SECTION_BACKGROUND_CLASSES[merged.backgroundStyle] || SECTION_BACKGROUND_CLASSES['soft-slate'];
  const isTextCentered = merged.textAlignment === 'center';
  const visibleBenefits = merged.benefitPoints.filter((pt) => pt && pt.text && pt.text.trim().length > 0);
  const ctaCheck = merged.ctaEnabled && merged.ctaLabel?.trim()
    ? validateCashbackCtaDestination(merged.ctaDestination)
    : { valid: false as const };

  const handleInternalCtaClick = (destination: string) => {
    if (previewMode) return;
    if (destination.startsWith('/b2b')) {
      const isEligibleB2B =
        isAuthenticated &&
        user &&
        (user.role === 'B2B_AGENT' || user.role === 'AGENT' || user.role === 'ADMIN' || user.role === 'TEAM_MEMBER');
      if (isEligibleB2B) {
        navigateTo(destination);
      } else {
        setIntendedPath(destination);
        if (onRequireAuth) {
          onRequireAuth();
        } else {
          navigateTo('/login');
        }
      }
      return;
    }
    navigateTo(destination);
  };

  return (
    <section
      id="cashback-rewards-video"
      aria-labelledby="cashback-rewards-video-heading"
      className={`${bgClass} ${previewMode ? 'py-10 sm:py-12 rounded-2xl' : 'py-14 sm:py-20 lg:py-24'}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-12 md:gap-10 lg:gap-14">
          {/* Left Column: Cashback Overview, Benefit Points & Optional CTA */}
          <div
            className={`md:col-span-6 space-y-5 ${
              isTextCentered ? 'text-center' : 'text-left'
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
              id="cashback-rewards-video-heading"
              className={`text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {merged.heading || INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG.heading}
            </h2>

            {merged.description && merged.description.trim() && (
              <p
                className={`text-sm leading-relaxed sm:text-base ${
                  isDark ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                {merged.description}
              </p>
            )}

            {visibleBenefits.length > 0 && (
              <ul
                className={`space-y-2.5 pt-1 ${
                  isTextCentered ? 'mx-auto inline-block text-left' : ''
                }`}
              >
                {visibleBenefits.map((point) => (
                  <li key={point.id} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        isDark
                          ? 'bg-[#00C6A6]/15 text-[#00C6A6]'
                          : 'bg-[#008972]/10 text-[#008972]'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    </span>
                    <span
                      className={`text-sm leading-snug ${
                        isDark ? 'text-slate-200' : 'text-slate-700'
                      }`}
                    >
                      {point.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {merged.supportingText && merged.supportingText.trim() && (
              <p
                className={`text-xs leading-relaxed ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {merged.supportingText}
              </p>
            )}

            {ctaCheck.valid && ctaCheck.normalized && (
              <div className={`pt-2 ${isTextCentered ? 'flex justify-center' : ''}`}>
                {ctaCheck.isExternal ? (
                  <a
                    href={ctaCheck.normalized}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={previewMode ? (e) => e.preventDefault() : undefined}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#008972] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00735F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C6A6] focus-visible:ring-offset-2"
                  >
                    <span>{merged.ctaLabel}</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInternalCtaClick(ctaCheck.normalized!)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#008972] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00735F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C6A6] focus-visible:ring-offset-2"
                  >
                    <span>{merged.ctaLabel}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Smaller 16:9 YouTube Explainer Video Player */}
          <div className="md:col-span-6">
            <YouTubeClickToPlayPlayer
              videoId={resolvedVideoId}
              title={merged.heading || 'TheUnbound Cashback & Rewards'}
              customThumbnailUrl={merged.customThumbnailUrl}
              darkSurface={isDark}
              previewMode={previewMode}
              compact
              emptyPreviewLabel="Add a valid YouTube Cashback explainer URL to preview the video player."
              playAriaLabel={`Play cashback explainer video: ${merged.heading || 'Travel More. Earn More.'}`}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
