import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  Users,
  X,
  ArrowUpRight
} from 'lucide-react';
import {
  DEFAULT_MEET_OUR_TEAM_CONFIG,
  MeetOurTeamGalleryConfig,
  TeamMemberRecord,
  TeamPreviewViewport,
  getAspectRatioClass,
  getCardAlignmentClass,
  getCornerRadiusClass,
  getImageSizeClass,
  getResponsiveGridColsClasses,
  getSpacingClasses,
  getTextAlignmentClass,
  normalizeGalleryConfig,
  paginateActiveTeamMembers
} from '../../types/teamGallery';
import {
  subscribeActiveTeamMembers,
  subscribeTeamGalleryConfig,
  stripHtmlToPlainText
} from '../../services/teamGalleryService';
import { RichTextRenderer } from '../common/RichTextRenderer';

export interface MeetOurTeamSectionProps {
  /** Optional preview configuration injected by Admin CMS Live Preview */
  previewConfig?: MeetOurTeamGalleryConfig;
  /** Optional preview team members injected by Admin CMS Live Preview */
  previewMembers?: TeamMemberRecord[];
  /** Optional forced viewport mode used inside Admin CMS Live Preview */
  previewViewport?: TeamPreviewViewport;
  /** Indicates component is rendered inside Admin CMS Live Preview */
  isPreviewMode?: boolean;
}

function getInitials(fullName: string): string {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const XSocialIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookSocialIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M13.5 21v-8.2h2.76l.41-3.2H13.5V7.56c0-.93.26-1.56 1.59-1.56h1.7V3.14c-.29-.04-1.31-.13-2.49-.13-2.46 0-4.15 1.5-4.15 4.26V9.6H7.37v3.2h2.78V21h3.35z" />
  </svg>
);

interface TeamMemberPhotoProps {
  member: TeamMemberRecord;
  config: MeetOurTeamGalleryConfig;
  preferHighRes?: boolean;
}

const TeamMemberPhoto: React.FC<TeamMemberPhotoProps> = ({
  member,
  config,
  preferHighRes = false
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [member.imageUrl, member.thumbnailUrl]);

  const primarySrc = preferHighRes
    ? member.imageUrl || member.thumbnailUrl
    : member.thumbnailUrl || member.imageUrl;

  const srcSet =
    member.thumbnailUrl && member.imageUrl && member.thumbnailUrl !== member.imageUrl
      ? `${member.thumbnailUrl} 480w, ${member.imageUrl} 1200w`
      : undefined;

  const isAutoRatio = config.imageAspectRatio === 'auto';
  const aspectClass = getAspectRatioClass(config.imageAspectRatio);
  const sizeClass = getImageSizeClass(config.imageSize, config.cardAlignment);
  const radiusClass = getCornerRadiusClass(config.imageCornerRadius);

  return (
    <div
      className={`relative overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 ${sizeClass} ${aspectClass} ${radiusClass}`}
    >
      {!failed && primarySrc ? (
        <img
          src={primarySrc}
          srcSet={srcSet}
          sizes="(max-width: 768px) 92vw, (max-width: 1200px) 45vw, 28vw"
          alt={`${member.fullName} — ${member.designation}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={
            isAutoRatio
              ? 'w-full h-auto block object-cover transition-transform duration-500 group-hover:scale-[1.02]'
              : 'w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]'
          }
        />
      ) : (
        <div
          className={`w-full ${isAutoRatio ? 'aspect-[4/5]' : 'h-full'} flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 select-none`}
        >
          <span className="text-2xl font-bold tracking-tight text-slate-700 font-sans">
            {getInitials(member.fullName)}
          </span>
        </div>
      )}
    </div>
  );
};

const SocialLinksRow: React.FC<{
  member: TeamMemberRecord;
  alignment: MeetOurTeamGalleryConfig['textAlignment'];
}> = ({ member, alignment }) => {
  const links = member.socialLinks || {};
  const items = [
    links.linkedin
      ? { key: 'linkedin', href: links.linkedin, label: `${member.fullName} on LinkedIn`, icon: <Linkedin className="w-3.5 h-3.5" /> }
      : null,
    links.instagram
      ? { key: 'instagram', href: links.instagram, label: `${member.fullName} on Instagram`, icon: <Instagram className="w-3.5 h-3.5" /> }
      : null,
    links.twitter
      ? { key: 'twitter', href: links.twitter, label: `${member.fullName} on X`, icon: <XSocialIcon className="w-3.5 h-3.5" /> }
      : null,
    links.facebook
      ? { key: 'facebook', href: links.facebook, label: `${member.fullName} on Facebook`, icon: <FacebookSocialIcon className="w-3.5 h-3.5" /> }
      : null,
    links.website
      ? { key: 'website', href: links.website, label: `${member.fullName} website`, icon: <Globe className="w-3.5 h-3.5" /> }
      : null,
    links.email
      ? { key: 'email', href: `mailto:${links.email}`, label: `Email ${member.fullName}`, icon: <Mail className="w-3.5 h-3.5" />, isMail: true }
      : null
  ].filter(Boolean) as Array<{
    key: string;
    href: string;
    label: string;
    icon: React.ReactNode;
    isMail?: boolean;
  }>;

  if (items.length === 0) return null;

  const justifyClass =
    alignment === 'center'
      ? 'justify-center'
      : alignment === 'right'
        ? 'justify-end'
        : 'justify-start';

  return (
    <div className={`flex flex-wrap items-center gap-2 pt-2 ${justifyClass}`}>
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target={item.isMail ? undefined : '_blank'}
          rel={item.isMail ? undefined : 'noopener noreferrer'}
          aria-label={item.label}
          title={item.label}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-[#008972] hover:border-[#00C6A6] hover:bg-teal-50/50 transition-colors"
        >
          {item.icon}
        </a>
      ))}
    </div>
  );
};

export const MeetOurTeamSection: React.FC<MeetOurTeamSectionProps> = ({
  previewConfig,
  previewMembers,
  previewViewport,
  isPreviewMode = false
}) => {
  const [liveConfig, setLiveConfig] = useState<MeetOurTeamGalleryConfig>(DEFAULT_MEET_OUR_TEAM_CONFIG);
  const [liveMembers, setLiveMembers] = useState<TeamMemberRecord[]>([]);
  const [isLoading, setIsLoading] = useState(!isPreviewMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<TeamMemberRecord | null>(null);
  const [detectedViewport, setDetectedViewport] = useState<TeamPreviewViewport>('desktop');

  // Subscribe to real-time Firestore updates only when rendered on live website
  useEffect(() => {
    if (isPreviewMode) {
      setIsLoading(false);
      return;
    }

    let configLoaded = false;
    let membersLoaded = false;
    const markReady = () => {
      if (configLoaded && membersLoaded) {
        setIsLoading(false);
      }
    };

    const unsubConfig = subscribeTeamGalleryConfig((cfg) => {
      setLiveConfig(cfg);
      configLoaded = true;
      markReady();
    });

    const unsubMembers = subscribeActiveTeamMembers((members) => {
      setLiveMembers(members);
      membersLoaded = true;
      markReady();
    });

    return () => {
      unsubConfig();
      unsubMembers();
    };
  }, [isPreviewMode]);

  // Track responsive viewport for accurate pagination capacity on live site
  useEffect(() => {
    if (previewViewport) return;
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      const w = window.innerWidth;
      if (w < 768) setDetectedViewport('mobile');
      else if (w < 1024) setDetectedViewport('tablet');
      else setDetectedViewport('desktop');
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [previewViewport]);

  const effectiveConfig = useMemo(
    () => normalizeGalleryConfig(isPreviewMode ? previewConfig : liveConfig),
    [isPreviewMode, previewConfig, liveConfig]
  );

  const effectiveMembers = useMemo(
    () => (isPreviewMode ? previewMembers || [] : liveMembers),
    [isPreviewMode, previewMembers, liveMembers]
  );

  const activeViewport = previewViewport || detectedViewport;

  const pagination = useMemo(
    () => paginateActiveTeamMembers(effectiveMembers, effectiveConfig, currentPage, activeViewport),
    [effectiveMembers, effectiveConfig, currentPage, activeViewport]
  );

  // Reset to page 1 when layout capacity or total members drops below current page
  useEffect(() => {
    if (currentPage > pagination.totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, pagination.totalPages]);

  const gridColsClass = getResponsiveGridColsClasses(effectiveConfig, previewViewport);
  const spacingClass = getSpacingClasses(
    effectiveConfig.horizontalSpacing,
    effectiveConfig.verticalSpacing
  );
  const textAlignClass = getTextAlignmentClass(effectiveConfig.textAlignment);
  const cardAlignClass = getCardAlignmentClass(effectiveConfig.cardAlignment);

  const getCardWrapperClass = () => {
    switch (effectiveConfig.displayStyle) {
      case 'card':
        return 'bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all';
      case 'bordered':
        return 'bg-slate-50/60 rounded-2xl border border-slate-200 p-5 hover:bg-white hover:border-[#00C6A6]/60 transition-all';
      case 'minimal':
        return 'bg-transparent p-1 transition-colors';
      case 'editorial':
      default:
        return 'bg-white rounded-2xl border border-slate-100 p-4 hover:border-slate-200 transition-all';
    }
  };

  const preferHighRes =
    effectiveConfig.desktopColumns <= 2 || effectiveConfig.imageSize === 'full';

  return (
    <section
      id="meet-our-team"
      aria-labelledby="meet-our-team-heading"
      className={`bg-white rounded-3xl border border-slate-200 shadow-xs ${
        isPreviewMode ? 'p-6 sm:p-8' : 'p-8 sm:p-12'
      } space-y-10`}
    >
      {/* Editorial Section Header */}
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#008972]">
          The People Behind TheUnbound
        </p>
        <h2
          id="meet-our-team-heading"
          className="text-2xl sm:text-4xl font-extrabold text-slate-900 font-sans tracking-tight"
        >
          {effectiveConfig.heading}
        </h2>
        {effectiveConfig.introText && (
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            {effectiveConfig.introText}
          </p>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className={`grid ${gridColsClass} ${spacingClass}`} aria-busy="true">
          {Array.from({ length: Math.min(4, effectiveConfig.desktopColumns) }).map((_, idx) => (
            <div key={idx} className="space-y-4 animate-pulse">
              <div className="w-full aspect-[4/5] rounded-2xl bg-slate-100" />
              <div className="space-y-2">
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
                <div className="h-3 w-full rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : pagination.totalActiveMembers === 0 ? (
        /* Clean Empty State — Strictly Zero Fictional Members or Placeholder Portraits */
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center max-w-xl mx-auto space-y-3">
          <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 text-[#008972] flex items-center justify-center mx-auto">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 font-sans">
            Our Team Profiles Are Coming Soon
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {isPreviewMode
              ? 'No active team members are currently published. Add and activate team members in the Team Members tab to preview them here.'
              : 'Our destination specialists and travel planners are being published here shortly. Check back soon to meet the team crafting journeys across Japan and beyond.'}
          </p>
        </div>
      ) : (
        /* Dynamic Admin-Configured Team Gallery Grid */
        <div className="space-y-10">
          <div className={`grid ${gridColsClass} ${spacingClass}`}>
            {pagination.visibleMembers.map((member) => {
              const plainIntro = stripHtmlToPlainText(member.introduction);
              const isLongBio = plainIntro.length > 210;

              return (
                <article
                  key={member.teamMemberId}
                  className={`group flex flex-col h-full ${cardAlignClass} ${getCardWrapperClass()}`}
                >
                  <TeamMemberPhoto
                    member={member}
                    config={effectiveConfig}
                    preferHighRes={preferHighRes}
                  />

                  <div className={`flex flex-col flex-1 w-full mt-4 space-y-2 ${textAlignClass}`}>
                    <div className="space-y-0.5">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 font-sans leading-snug tracking-tight">
                        {member.fullName}
                      </h3>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#008972]">
                        {member.designation}
                      </p>
                    </div>

                    <div className="pt-1 w-full">
                      <RichTextRenderer
                        content={member.introduction}
                        lineClamp={isLongBio ? 4 : undefined}
                        className={`text-xs sm:text-[13.5px] text-slate-600 leading-relaxed ${
                          effectiveConfig.textAlignment === 'center'
                            ? '[&_p]:text-center'
                            : effectiveConfig.textAlignment === 'right'
                              ? '[&_p]:text-right'
                              : ''
                        }`}
                      />
                    </div>

                    {isLongBio && (
                      <button
                        type="button"
                        onClick={() => setSelectedMember(member)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#008972] hover:text-slate-900 transition-colors pt-1 cursor-pointer"
                      >
                        <span>Read full bio</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {effectiveConfig.showSocialLinks && (
                      <div className="mt-auto pt-1 w-full">
                        <SocialLinksRow
                          member={member}
                          alignment={effectiveConfig.textAlignment}
                        />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Clean Pagination Controls (Shown Only When Active Members Exceed Page Capacity) */}
          {pagination.hasPagination && (
            <nav
              aria-label="Meet Our Team pagination"
              className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200"
            >
              <p className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-800">{pagination.startIndex + 1}</span>
                {' – '}
                <span className="font-semibold text-slate-800">{pagination.endIndex}</span> of{' '}
                <span className="font-semibold text-slate-800">{pagination.totalActiveMembers}</span> team members
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pagination.currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => {
                  const isCurrent = pageNum === pagination.currentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-900 text-white border border-slate-900'
                          : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={pagination.currentPage >= pagination.totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </nav>
          )}
        </div>
      )}

      {/* Full Profile Bio Modal */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-member-modal-name"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3
                  id="team-member-modal-name"
                  className="text-lg font-bold text-slate-900 font-sans"
                >
                  {selectedMember.fullName}
                </h3>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#008972]">
                  {selectedMember.designation}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                aria-label="Close team member profile"
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
              <div className="sm:col-span-5">
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/5]">
                  <img
                    src={selectedMember.imageUrl || selectedMember.thumbnailUrl}
                    alt={`${selectedMember.fullName} — ${selectedMember.designation}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
              <div className="sm:col-span-7 space-y-4">
                <RichTextRenderer
                  content={selectedMember.introduction}
                  className="text-sm text-slate-700 leading-relaxed"
                />
                {effectiveConfig.showSocialLinks && (
                  <div className="pt-2 border-t border-slate-100">
                    <SocialLinksRow member={selectedMember} alignment="left" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
