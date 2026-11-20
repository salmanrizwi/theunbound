/**
 * ============================================================================
 * THEUNBOUND — ABOUT US: MEET OUR TEAM GALLERY TYPES & LAYOUT ENGINE
 * ============================================================================
 * Shared types, defaults, presets, and deterministic layout/pagination helpers
 * used across the live About Us page, Admin CMS controls, and Live Preview.
 */

export type TeamMemberStatus = 'ACTIVE' | 'INACTIVE';

export type MeetOurTeamLayoutPreset =
  | 'LAYOUT_A_2COL'
  | 'LAYOUT_B_3COL'
  | 'LAYOUT_C_4COL'
  | 'LAYOUT_D_5COL'
  | 'LAYOUT_E_CUSTOM';

export type TeamImageAspectRatio = '1:1' | '4:5' | '3:4' | '4:3' | '16:9' | 'auto';
export type TeamImageSize = 'sm' | 'md' | 'lg' | 'full';
export type TeamSpacingScale = 'tight' | 'normal' | 'relaxed' | 'wide';
export type TeamAlignment = 'left' | 'center' | 'right';
export type TeamCornerRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type TeamGalleryDisplayStyle = 'editorial' | 'card' | 'bordered' | 'minimal';
export type TeamPreviewViewport = 'desktop' | 'tablet' | 'mobile';

export interface TeamSocialLinks {
  linkedin?: string;
  instagram?: string;
  twitter?: string;
  facebook?: string;
  website?: string;
  email?: string;
}

export interface TeamMemberRecord {
  teamMemberId: string;
  fullName: string;
  designation: string;
  introduction: string;
  imageStoragePath: string;
  imageUrl: string;
  thumbnailStoragePath?: string;
  thumbnailUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  socialLinks?: TeamSocialLinks;
  displayOrder: number;
  status: TeamMemberStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updatedByRole?: string;
  updatedByEmail?: string;
}

export interface TeamMemberInput {
  teamMemberId?: string;
  fullName: string;
  designation: string;
  introduction: string;
  imageStoragePath: string;
  imageUrl: string;
  thumbnailStoragePath?: string;
  thumbnailUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  socialLinks?: TeamSocialLinks;
  displayOrder: number;
  status: TeamMemberStatus;
}

export interface MeetOurTeamGalleryConfig {
  heading: string;
  introText: string;
  layoutPreset: MeetOurTeamLayoutPreset;
  desktopColumns: number; // 1..6
  tabletColumns: number;  // 1..4
  mobileColumns: number;  // 1..2
  rows: number;           // 1..12
  itemsPerPage: number | null; // null => auto (rows * activeColumns)
  imageAspectRatio: TeamImageAspectRatio;
  imageSize: TeamImageSize;
  horizontalSpacing: TeamSpacingScale;
  verticalSpacing: TeamSpacingScale;
  cardAlignment: TeamAlignment;
  imageCornerRadius: TeamCornerRadius;
  textAlignment: TeamAlignment;
  displayStyle: TeamGalleryDisplayStyle;
  showSocialLinks: boolean;
  updatedAt?: string;
  updatedBy?: string;
  updatedByRole?: string;
  updatedByEmail?: string;
}

export interface AboutUsWebsiteContentDoc {
  pageId: 'aboutUs';
  meetOurTeamConfig: MeetOurTeamGalleryConfig;
  updatedAt: string;
  updatedBy?: string;
  updatedByRole?: string;
  updatedByEmail?: string;
}

export const DEFAULT_MEET_OUR_TEAM_HEADING = 'Meet Our Team';
export const DEFAULT_MEET_OUR_TEAM_INTRO =
  'Behind every memorable journey is a team of passionate people. Meet the minds, planners and travel enthusiasts working together to create exceptional experiences across Japan.';

export const DEFAULT_MEET_OUR_TEAM_CONFIG: MeetOurTeamGalleryConfig = {
  heading: DEFAULT_MEET_OUR_TEAM_HEADING,
  introText: DEFAULT_MEET_OUR_TEAM_INTRO,
  layoutPreset: 'LAYOUT_C_4COL',
  desktopColumns: 4,
  tabletColumns: 2,
  mobileColumns: 1,
  rows: 2,
  itemsPerPage: null,
  imageAspectRatio: '4:5',
  imageSize: 'full',
  horizontalSpacing: 'normal',
  verticalSpacing: 'relaxed',
  cardAlignment: 'left',
  imageCornerRadius: 'lg',
  textAlignment: 'left',
  displayStyle: 'editorial',
  showSocialLinks: true
};

export interface LayoutPresetDefinition {
  id: MeetOurTeamLayoutPreset;
  label: string;
  shortLabel: string;
  description: string;
  desktopColumns: number;
  tabletColumns: number;
  mobileColumns: number;
  rows: number;
}

export const MEET_OUR_TEAM_LAYOUT_PRESETS: LayoutPresetDefinition[] = [
  {
    id: 'LAYOUT_A_2COL',
    label: 'Layout A — 2 Columns',
    shortLabel: '2 Columns',
    description: 'Editorial two-column showcase ideal for senior leadership and detailed profiles.',
    desktopColumns: 2,
    tabletColumns: 2,
    mobileColumns: 1,
    rows: 2
  },
  {
    id: 'LAYOUT_B_3COL',
    label: 'Layout B — 3 Columns',
    shortLabel: '3 Columns',
    description: 'Balanced three-column portrait grid for boutique destination specialists.',
    desktopColumns: 3,
    tabletColumns: 2,
    mobileColumns: 1,
    rows: 2
  },
  {
    id: 'LAYOUT_C_4COL',
    label: 'Layout C — 4 Columns',
    shortLabel: '4 Columns',
    description: 'Standard four-column team showcase for growing cross-functional teams.',
    desktopColumns: 4,
    tabletColumns: 2,
    mobileColumns: 1,
    rows: 2
  },
  {
    id: 'LAYOUT_D_5COL',
    label: 'Layout D — 5 Columns',
    shortLabel: '5 Columns',
    description: 'High-density five-column layout for larger multi-hub operations teams.',
    desktopColumns: 5,
    tabletColumns: 3,
    mobileColumns: 1,
    rows: 2
  },
  {
    id: 'LAYOUT_E_CUSTOM',
    label: 'Layout E — Custom Rows × Columns',
    shortLabel: 'Custom Grid',
    description: 'Define exact rows, responsive columns, and page capacity (e.g. 2×3, 3×3, 2×4, 3×4).',
    desktopColumns: 3,
    tabletColumns: 2,
    mobileColumns: 1,
    rows: 3
  }
];

export const CUSTOM_GRID_QUICK_PRESETS: Array<{ label: string; rows: number; desktopColumns: number; tabletColumns: number }> = [
  { label: '2 × 3 (6 / page)', rows: 2, desktopColumns: 3, tabletColumns: 2 },
  { label: '3 × 3 (9 / page)', rows: 3, desktopColumns: 3, tabletColumns: 2 },
  { label: '2 × 4 (8 / page)', rows: 2, desktopColumns: 4, tabletColumns: 2 },
  { label: '3 × 4 (12 / page)', rows: 3, desktopColumns: 4, tabletColumns: 2 },
  { label: '2 × 5 (10 / page)', rows: 2, desktopColumns: 5, tabletColumns: 3 }
];

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

/**
 * Normalizes any persisted or partial gallery config into strict, safe values.
 */
export function normalizeGalleryConfig(
  partial?: Partial<MeetOurTeamGalleryConfig> | null
): MeetOurTeamGalleryConfig {
  const src = partial || {};
  const validPresets: MeetOurTeamLayoutPreset[] = [
    'LAYOUT_A_2COL',
    'LAYOUT_B_3COL',
    'LAYOUT_C_4COL',
    'LAYOUT_D_5COL',
    'LAYOUT_E_CUSTOM'
  ];
  const validAspects: TeamImageAspectRatio[] = ['1:1', '4:5', '3:4', '4:3', '16:9', 'auto'];
  const validSizes: TeamImageSize[] = ['sm', 'md', 'lg', 'full'];
  const validSpacings: TeamSpacingScale[] = ['tight', 'normal', 'relaxed', 'wide'];
  const validAligns: TeamAlignment[] = ['left', 'center', 'right'];
  const validRadii: TeamCornerRadius[] = ['none', 'sm', 'md', 'lg', 'xl', 'full'];
  const validStyles: TeamGalleryDisplayStyle[] = ['editorial', 'card', 'bordered', 'minimal'];

  const layoutPreset = validPresets.includes(src.layoutPreset as MeetOurTeamLayoutPreset)
    ? (src.layoutPreset as MeetOurTeamLayoutPreset)
    : DEFAULT_MEET_OUR_TEAM_CONFIG.layoutPreset;

  const desktopColumns = clampInt(src.desktopColumns, 1, 6, DEFAULT_MEET_OUR_TEAM_CONFIG.desktopColumns);
  const tabletColumns = clampInt(src.tabletColumns, 1, 4, Math.min(desktopColumns, DEFAULT_MEET_OUR_TEAM_CONFIG.tabletColumns));
  const mobileColumns = clampInt(src.mobileColumns, 1, 2, DEFAULT_MEET_OUR_TEAM_CONFIG.mobileColumns);
  const rows = clampInt(src.rows, 1, 12, DEFAULT_MEET_OUR_TEAM_CONFIG.rows);

  const itemsPerPage =
    src.itemsPerPage === null || src.itemsPerPage === undefined || src.itemsPerPage === ('' as any)
      ? null
      : clampInt(src.itemsPerPage, 1, 60, rows * desktopColumns);

  return {
    heading:
      typeof src.heading === 'string' && src.heading.trim().length > 0
        ? src.heading.trim()
        : DEFAULT_MEET_OUR_TEAM_HEADING,
    introText:
      typeof src.introText === 'string'
        ? src.introText.trim()
        : DEFAULT_MEET_OUR_TEAM_INTRO,
    layoutPreset,
    desktopColumns,
    tabletColumns,
    mobileColumns,
    rows,
    itemsPerPage,
    imageAspectRatio: validAspects.includes(src.imageAspectRatio as TeamImageAspectRatio)
      ? (src.imageAspectRatio as TeamImageAspectRatio)
      : DEFAULT_MEET_OUR_TEAM_CONFIG.imageAspectRatio,
    imageSize: validSizes.includes(src.imageSize as TeamImageSize)
      ? (src.imageSize as TeamImageSize)
      : DEFAULT_MEET_OUR_TEAM_CONFIG.imageSize,
    horizontalSpacing: validSpacings.includes(src.horizontalSpacing as TeamSpacingScale)
      ? (src.horizontalSpacing as TeamSpacingScale)
      : DEFAULT_MEET_OUR_TEAM_CONFIG.horizontalSpacing,
    verticalSpacing: validSpacings.includes(src.verticalSpacing as TeamSpacingScale)
      ? (src.verticalSpacing as TeamSpacingScale)
      : DEFAULT_MEET_OUR_TEAM_CONFIG.verticalSpacing,
    cardAlignment: validAligns.includes(src.cardAlignment as TeamAlignment)
      ? (src.cardAlignment as TeamAlignment)
      : DEFAULT_MEET_OUR_TEAM_CONFIG.cardAlignment,
    imageCornerRadius: validRadii.includes(src.imageCornerRadius as TeamCornerRadius)
      ? (src.imageCornerRadius as TeamCornerRadius)
      : DEFAULT_MEET_OUR_TEAM_CONFIG.imageCornerRadius,
    textAlignment: validAligns.includes(src.textAlignment as TeamAlignment)
      ? (src.textAlignment as TeamAlignment)
      : DEFAULT_MEET_OUR_TEAM_CONFIG.textAlignment,
    displayStyle: validStyles.includes(src.displayStyle as TeamGalleryDisplayStyle)
      ? (src.displayStyle as TeamGalleryDisplayStyle)
      : DEFAULT_MEET_OUR_TEAM_CONFIG.displayStyle,
    showSocialLinks:
      typeof src.showSocialLinks === 'boolean'
        ? src.showSocialLinks
        : DEFAULT_MEET_OUR_TEAM_CONFIG.showSocialLinks,
    updatedAt: src.updatedAt,
    updatedBy: src.updatedBy,
    updatedByRole: src.updatedByRole,
    updatedByEmail: src.updatedByEmail
  };
}

/**
 * Applies a layout preset to an existing config while preserving custom styling & copy.
 */
export function applyLayoutPreset(
  current: MeetOurTeamGalleryConfig,
  presetId: MeetOurTeamLayoutPreset
): MeetOurTeamGalleryConfig {
  const preset = MEET_OUR_TEAM_LAYOUT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return current;
  if (presetId === 'LAYOUT_E_CUSTOM') {
    return {
      ...current,
      layoutPreset: 'LAYOUT_E_CUSTOM'
    };
  }
  return {
    ...current,
    layoutPreset: preset.id,
    desktopColumns: preset.desktopColumns,
    tabletColumns: preset.tabletColumns,
    mobileColumns: preset.mobileColumns,
    rows: preset.rows,
    itemsPerPage: null
  };
}

/**
 * Computes effective columns for a specific viewport width or forced preview mode.
 */
export function resolveViewportColumns(
  config: MeetOurTeamGalleryConfig,
  viewport: TeamPreviewViewport
): number {
  if (viewport === 'mobile') return clampInt(config.mobileColumns, 1, 2, 1);
  if (viewport === 'tablet') return clampInt(config.tabletColumns, 1, 4, 2);
  return clampInt(config.desktopColumns, 1, 6, 4);
}

/**
 * Effective page capacity: explicit itemsPerPage if configured, otherwise rows * desktopColumns.
 * Note: Never creates empty placeholder cards — if fewer members exist, only actual members render.
 */
export function getEffectiveItemsPerPage(
  config: MeetOurTeamGalleryConfig,
  viewport: TeamPreviewViewport = 'desktop'
): number {
  if (typeof config.itemsPerPage === 'number' && config.itemsPerPage > 0) {
    return clampInt(config.itemsPerPage, 1, 60, 8);
  }
  const cols = resolveViewportColumns(config, viewport);
  const rows = clampInt(config.rows, 1, 12, 2);
  return Math.max(1, cols * rows);
}

export interface PaginatedTeamResult {
  visibleMembers: TeamMemberRecord[];
  currentPage: number;
  totalPages: number;
  totalActiveMembers: number;
  pageCapacity: number;
  startIndex: number;
  endIndex: number;
  hasPagination: boolean;
}

/**
 * Deterministically filters active members, sorts by displayOrder, and slices for the current page.
 * Strictly returns ONLY actual members (zero empty placeholder slots).
 */
export function paginateActiveTeamMembers(
  members: TeamMemberRecord[],
  config: MeetOurTeamGalleryConfig,
  requestedPage: number,
  viewport: TeamPreviewViewport = 'desktop'
): PaginatedTeamResult {
  const activeSorted = [...members]
    .filter((m) => m.status === 'ACTIVE')
    .sort((a, b) => {
      const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

  const totalActiveMembers = activeSorted.length;
  const pageCapacity = getEffectiveItemsPerPage(config, viewport);
  const totalPages = Math.max(1, Math.ceil(totalActiveMembers / pageCapacity));
  const currentPage = clampInt(requestedPage, 1, totalPages, 1);
  const startIndex = (currentPage - 1) * pageCapacity;
  const visibleMembers = activeSorted.slice(startIndex, startIndex + pageCapacity);
  const endIndex = startIndex + visibleMembers.length;

  return {
    visibleMembers,
    currentPage,
    totalPages,
    totalActiveMembers,
    pageCapacity,
    startIndex,
    endIndex,
    hasPagination: totalPages > 1
  };
}

/**
 * Tailwind CSS mapping helpers — all static classes so Tailwind JIT compiles every variant cleanly.
 */
export function getResponsiveGridColsClasses(
  config: MeetOurTeamGalleryConfig,
  forcedViewport?: TeamPreviewViewport
): string {
  const mobileMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2'
  };
  const tabletMap: Record<number, string> = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4'
  };
  const desktopMap: Record<number, string> = {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6'
  };
  const forcedMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
  };

  if (forcedViewport) {
    const cols = resolveViewportColumns(config, forcedViewport);
    return forcedMap[cols] || 'grid-cols-1';
  }

  return [
    mobileMap[clampInt(config.mobileColumns, 1, 2, 1)] || 'grid-cols-1',
    tabletMap[clampInt(config.tabletColumns, 1, 4, 2)] || 'md:grid-cols-2',
    desktopMap[clampInt(config.desktopColumns, 1, 6, 4)] || 'lg:grid-cols-4'
  ].join(' ');
}

export function getSpacingClasses(
  horizontal: TeamSpacingScale,
  vertical: TeamSpacingScale
): string {
  const xMap: Record<TeamSpacingScale, string> = {
    tight: 'gap-x-4',
    normal: 'gap-x-6',
    relaxed: 'gap-x-8',
    wide: 'gap-x-10'
  };
  const yMap: Record<TeamSpacingScale, string> = {
    tight: 'gap-y-5',
    normal: 'gap-y-7',
    relaxed: 'gap-y-10',
    wide: 'gap-y-12'
  };
  return `${xMap[horizontal] || 'gap-x-6'} ${yMap[vertical] || 'gap-y-10'}`;
}

export function getAspectRatioClass(ratio: TeamImageAspectRatio): string {
  switch (ratio) {
    case '1:1':
      return 'aspect-square';
    case '4:5':
      return 'aspect-[4/5]';
    case '3:4':
      return 'aspect-[3/4]';
    case '4:3':
      return 'aspect-[4/3]';
    case '16:9':
      return 'aspect-video';
    case 'auto':
    default:
      return 'aspect-auto';
  }
}

export function getImageSizeClass(size: TeamImageSize, cardAlignment: TeamAlignment): string {
  const alignMargin =
    cardAlignment === 'center'
      ? 'mx-auto'
      : cardAlignment === 'right'
        ? 'ml-auto'
        : 'mr-auto';

  switch (size) {
    case 'sm':
      return `w-36 sm:w-40 max-w-full ${alignMargin}`;
    case 'md':
      return `w-52 sm:w-56 max-w-full ${alignMargin}`;
    case 'lg':
      return `w-72 max-w-full ${alignMargin}`;
    case 'full':
    default:
      return 'w-full';
  }
}

export function getCornerRadiusClass(radius: TeamCornerRadius): string {
  switch (radius) {
    case 'none':
      return 'rounded-none';
    case 'sm':
      return 'rounded-md';
    case 'md':
      return 'rounded-xl';
    case 'lg':
      return 'rounded-2xl';
    case 'xl':
      return 'rounded-3xl';
    case 'full':
      return 'rounded-full';
    default:
      return 'rounded-2xl';
  }
}

export function getTextAlignmentClass(alignment: TeamAlignment): string {
  switch (alignment) {
    case 'center':
      return 'text-center items-center';
    case 'right':
      return 'text-right items-end';
    case 'left':
    default:
      return 'text-left items-start';
  }
}

export function getCardAlignmentClass(alignment: TeamAlignment): string {
  switch (alignment) {
    case 'center':
      return 'items-center';
    case 'right':
      return 'items-end';
    case 'left':
    default:
      return 'items-start';
  }
}
