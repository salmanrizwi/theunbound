import React, { useMemo } from 'react';
import { ArrowUpRight, Calendar } from 'lucide-react';
import type {
  DemoBookingButtonConfig,
  DemoBookingButtonStyle,
  HomepageDemoBookingConfig
} from '../../types';
import {
  getPublishableDemoBookingButtons,
  trackDemoBookingClick,
  validateCalendlyUrl
} from '../../utils/demoBookingValidation';

export interface DemoBookingSectionProps {
  config?: HomepageDemoBookingConfig | null;
  /** Controlled by Homepage Control & Layout Manager (showDemoBookingSection) */
  sectionActive?: boolean;
  /** Admin CMS preview mode shows draft visual structure even before URLs are populated */
  previewMode?: boolean;
  /** Optional wrapper class override */
  className?: string;
}

const SURFACE_CLASSES: Record<
  NonNullable<HomepageDemoBookingConfig['background']>['style'],
  {
    card: string;
    eyebrow: string;
    eyebrowRule: string;
    headline: string;
    description: string;
    supportingText: string;
    divider: string;
    isDark: boolean;
  }
> = {
  'pure-white': {
    card: 'bg-white border border-slate-200/90 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.18)]',
    eyebrow: 'text-[#008972]',
    eyebrowRule: 'bg-[#00C6A6]',
    headline: 'text-slate-900',
    description: 'text-slate-600',
    supportingText: 'text-slate-500',
    divider: 'border-slate-100',
    isDark: false
  },
  'soft-slate': {
    card: 'bg-[#F8FAFB] border border-slate-200/90 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.14)]',
    eyebrow: 'text-[#008972]',
    eyebrowRule: 'bg-[#00C6A6]',
    headline: 'text-slate-900',
    description: 'text-slate-600',
    supportingText: 'text-slate-500',
    divider: 'border-slate-200/70',
    isDark: false
  },
  'subtle-teal-wash': {
    card: 'bg-gradient-to-b from-white via-[#F5FCFA] to-[#ECF9F6] border border-[#00C6A6]/25 shadow-[0_20px_54px_-28px_rgba(0,137,114,0.22)]',
    eyebrow: 'text-[#007A65]',
    eyebrowRule: 'bg-[#00C6A6]',
    headline: 'text-slate-900',
    description: 'text-slate-600',
    supportingText: 'text-slate-600',
    divider: 'border-[#00C6A6]/15',
    isDark: false
  },
  'dark-charcoal': {
    card: 'bg-[#0F172A] border border-slate-800 shadow-[0_24px_60px_-24px_rgba(2,6,23,0.55)]',
    eyebrow: 'text-[#00E5C0]',
    eyebrowRule: 'bg-[#00C6A6]',
    headline: 'text-white',
    description: 'text-slate-300',
    supportingText: 'text-slate-400',
    divider: 'border-slate-800',
    isDark: true
  }
};

const PADDING_CLASSES: Record<
  NonNullable<HomepageDemoBookingConfig['layout']>['sectionPadding'],
  string
> = {
  compact: 'px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16',
  standard: 'px-6 py-14 sm:px-12 sm:py-18 lg:px-16 lg:py-22',
  generous: 'px-6 py-16 sm:px-14 sm:py-24 lg:px-20 lg:py-28'
};

const CONTENT_WIDTH_CLASSES: Record<
  NonNullable<HomepageDemoBookingConfig['layout']>['contentWidth'],
  string
> = {
  narrow: 'max-w-2xl',
  standard: 'max-w-3xl',
  wide: 'max-w-4xl'
};

const BUTTON_SPACING_CLASSES: Record<
  NonNullable<HomepageDemoBookingConfig['layout']>['buttonSpacing'],
  string
> = {
  compact: 'gap-3',
  comfortable: 'gap-4',
  spacious: 'gap-5 sm:gap-6'
};

function getButtonClasses(style: DemoBookingButtonStyle, isDarkSurface: boolean): string {
  const base =
    'group inline-flex items-center justify-center gap-2.5 min-h-[52px] px-7 py-3.5 rounded-xl text-sm sm:text-[15px] font-semibold tracking-[-0.01em] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C6A6] focus-visible:ring-offset-2 whitespace-nowrap cursor-pointer w-full sm:w-auto';
  const focusOffset = isDarkSurface
    ? 'focus-visible:ring-offset-[#0F172A]'
    : 'focus-visible:ring-offset-white';

  switch (style) {
    case 'primary-teal':
      // Accessible white-on-teal contrast (>4.5:1 AA) anchored to TheUnbound teal identity
      return `${base} ${focusOffset} bg-[#008972] hover:bg-[#00735F] text-white border border-[#008972] hover:border-[#00735F] shadow-[0_10px_24px_-10px_rgba(0,137,114,0.55)] hover:shadow-[0_14px_28px_-10px_rgba(0,137,114,0.65)] hover:-translate-y-0.5 active:translate-y-0`;
    case 'outline-teal':
      return isDarkSurface
        ? `${base} ${focusOffset} bg-transparent hover:bg-[#00C6A6]/12 text-[#00E5C0] border-[1.5px] border-[#00C6A6] hover:border-[#00E5C0] hover:-translate-y-0.5 active:translate-y-0`
        : `${base} ${focusOffset} bg-white hover:bg-[#F0FDF9] text-[#007A65] border-[1.5px] border-[#00A88F] hover:border-[#008972] hover:-translate-y-0.5 active:translate-y-0`;
    case 'charcoal-solid':
      return isDarkSurface
        ? `${base} ${focusOffset} bg-white hover:bg-slate-100 text-slate-900 border border-white hover:-translate-y-0.5 active:translate-y-0`
        : `${base} ${focusOffset} bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.45)] hover:-translate-y-0.5 active:translate-y-0`;
    case 'soft-surface':
      return isDarkSurface
        ? `${base} ${focusOffset} bg-slate-800/90 hover:bg-slate-800 text-white border border-slate-700 hover:border-slate-600 hover:-translate-y-0.5 active:translate-y-0`
        : `${base} ${focusOffset} bg-slate-100 hover:bg-slate-200/80 text-slate-900 border border-slate-200 hover:border-slate-300 hover:-translate-y-0.5 active:translate-y-0`;
    default:
      return `${base} ${focusOffset} bg-[#008972] hover:bg-[#00735F] text-white border border-[#008972]`;
  }
}

export const DemoBookingSection: React.FC<DemoBookingSectionProps> = ({
  config,
  sectionActive = true,
  previewMode = false,
  className = ''
}) => {
  const effectiveActive = sectionActive && config?.isActive !== false;

  const liveButtons = useMemo(
    () => getPublishableDemoBookingButtons(config),
    [config]
  );

  const previewButtons = useMemo(() => {
    if (!config || !Array.isArray(config.buttons)) return [];
    return [...config.buttons]
      .sort((a, b) => (a.displayOrder ?? a.slot) - (b.displayOrder ?? b.slot))
      .filter(btn => btn.enabled);
  }, [config]);

  if (!config) return null;

  // On live homepage: strictly hide when section is inactive or when no valid enabled CTA exists
  if (!previewMode && (!effectiveActive || liveButtons.length === 0)) {
    return null;
  }

  const bgStyle = config.background?.style || 'pure-white';
  const decorative = config.background?.decorativeTreatment || 'architectural-lines';
  const alignment = config.layout?.alignment || 'center';
  const contentWidth = config.layout?.contentWidth || 'standard';
  const buttonSpacing = config.layout?.buttonSpacing || 'comfortable';
  const sectionPadding = config.layout?.sectionPadding || 'standard';

  const surface = SURFACE_CLASSES[bgStyle] || SURFACE_CLASSES['pure-white'];
  const isCentered = alignment === 'center';
  const buttonsToRender: Array<DemoBookingButtonConfig & { validatedUrl?: string }> = previewMode
    ? previewButtons
    : liveButtons;

  const hasSupportingCopy = buttonsToRender.some(
    btn => btn.supportingText && btn.supportingText.trim().length > 0
  );

  return (
    <section
      id="homepage-demo-booking"
      data-section-id={config.sectionId || 'demoBooking'}
      aria-labelledby="demo-booking-headline"
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}
    >
      <div
        className={`relative overflow-hidden rounded-3xl ${surface.card} ${PADDING_CLASSES[sectionPadding]}`}
      >
        {/* Subtle Decorative Treatment (Pure CSS, Zero External Assets) */}
        {decorative === 'architectural-lines' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent ${
                surface.isDark ? 'via-[#00C6A6]/45' : 'via-[#00C6A6]/50'
              } to-transparent`}
            />
            <div
              className={`absolute -top-24 -right-24 w-72 h-72 rounded-full border ${
                surface.isDark ? 'border-white/[0.05]' : 'border-slate-200/60'
              }`}
            />
            <div
              className={`absolute -bottom-28 -left-28 w-80 h-80 rounded-full border ${
                surface.isDark ? 'border-[#00C6A6]/10' : 'border-[#00C6A6]/15'
              }`}
            />
          </div>
        )}

        {decorative === 'minimal-grid' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: surface.isDark
                ? 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)'
                : 'radial-gradient(rgba(15,23,42,0.055) 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }}
          />
        )}

        {decorative === 'soft-radial-glow' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: surface.isDark
                ? 'radial-gradient(62% 70% at 50% 0%, rgba(0, 198, 166, 0.14) 0%, rgba(15, 23, 42, 0) 72%)'
                : 'radial-gradient(64% 68% at 50% 0%, rgba(0, 198, 166, 0.10) 0%, rgba(255, 255, 255, 0) 70%)'
            }}
          />
        )}

        {/* Inner Content Container */}
        <div
          className={`relative z-10 ${CONTENT_WIDTH_CLASSES[contentWidth]} ${
            isCentered ? 'mx-auto text-center' : 'text-left'
          }`}
        >
          {/* Eyebrow Kicker (Unboxed editorial typography + restrained hairline rule) */}
          {config.eyebrowText && config.eyebrowText.trim() && (
            <div
              className={`inline-flex items-center gap-3 mb-5 ${
                isCentered ? 'justify-center' : 'justify-start'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-[2px] w-7 rounded-full ${surface.eyebrowRule}`}
              />
              <span
                className={`text-xs font-semibold uppercase tracking-[0.2em] ${surface.eyebrow}`}
              >
                {config.eyebrowText.trim()}
              </span>
              {isCentered && (
                <span
                  aria-hidden="true"
                  className={`h-[2px] w-7 rounded-full ${surface.eyebrowRule}`}
                />
              )}
            </div>
          )}

          {/* Main Display Headline */}
          <h2
            id="demo-booking-headline"
            className={`text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-[-0.025em] leading-[1.12] [text-wrap:balance] ${surface.headline}`}
          >
            {config.headline}
          </h2>

          {/* Supporting Description */}
          {config.description && config.description.trim() && (
            <p
              className={`mt-5 text-base sm:text-lg leading-relaxed ${
                isCentered ? 'mx-auto max-w-2xl' : 'max-w-2xl'
              } ${surface.description}`}
            >
              {config.description.trim()}
            </p>
          )}

          {/* Two Independent CTA Buttons */}
          {buttonsToRender.length > 0 ? (
            <div
              className={`mt-9 sm:mt-10 flex flex-col sm:flex-row flex-wrap ${
                isCentered ? 'items-stretch sm:items-start justify-center' : 'items-stretch sm:items-start justify-start'
              } ${BUTTON_SPACING_CLASSES[buttonSpacing]}`}
            >
              {buttonsToRender.map((btn) => {
                const urlCheck = btn.validatedUrl
                  ? { valid: true, normalizedUrl: btn.validatedUrl }
                  : validateCalendlyUrl(btn.calendlyUrl);
                const btnClasses = getButtonClasses(btn.style, surface.isDark);

                if (!previewMode && !urlCheck.valid) {
                  return null;
                }

                return (
                  <div
                    key={btn.id}
                    className={`flex flex-col ${
                      isCentered ? 'items-stretch sm:items-center' : 'items-stretch sm:items-start'
                    } w-full sm:w-auto ${hasSupportingCopy ? 'sm:max-w-[300px]' : ''}`}
                  >
                    {urlCheck.valid ? (
                      <a
                        id={`demo-booking-cta-${btn.id}`}
                        href={urlCheck.normalizedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (!previewMode) {
                            trackDemoBookingClick({
                              sectionId: config.sectionId || 'demoBooking',
                              buttonId: btn.id,
                              buttonSlot: btn.slot,
                              displayOrder: btn.displayOrder
                            });
                          }
                        }}
                        className={btnClasses}
                      >
                        <Calendar
                          aria-hidden="true"
                          className="w-4 h-4 shrink-0 opacity-90"
                        />
                        <span>{btn.label}</span>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className={`${btnClasses} opacity-65 cursor-not-allowed hover:translate-y-0`}
                        title="Configure a valid Calendly URL in Admin CMS to activate this button"
                      >
                        <Calendar aria-hidden="true" className="w-4 h-4 shrink-0 opacity-90" />
                        <span>{btn.label || `Button ${btn.slot}`}</span>
                        <ArrowUpRight aria-hidden="true" className="w-4 h-4 shrink-0" />
                      </button>
                    )}

                    {btn.supportingText && btn.supportingText.trim() && (
                      <p
                        className={`mt-2.5 text-xs leading-relaxed ${
                          isCentered ? 'text-center' : 'text-left'
                        } ${surface.supportingText}`}
                      >
                        {btn.supportingText.trim()}
                      </p>
                    )}

                    {previewMode && !urlCheck.valid && (
                      <span className="mt-1.5 text-[11px] font-medium text-amber-600">
                        Calendly URL required before publishing
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            previewMode && (
              <div
                className={`mt-8 rounded-2xl border border-dashed px-5 py-4 text-xs ${
                  surface.isDark
                    ? 'border-slate-700 text-slate-400'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                No booking buttons are currently enabled. Enable Button 1 or Button 2 and add a valid Calendly URL to publish this section on the homepage.
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
};
