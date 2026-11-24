import fs from 'fs';
import path from 'path';
import {
  parseAndValidateYouTubeUrl,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
  getYouTubeThumbnailCandidates,
  clampTutorialVideoWidthPercent,
  validateCashbackCtaDestination,
  validatePortalTutorialVideoConfig,
  validateCashbackRewardsVideoConfig,
} from '../utils/youtubeValidation';
import {
  validateThumbnailFile,
  MAX_THUMBNAIL_FILE_SIZE_BYTES,
} from '../services/homepageVideoStorageService';
import {
  INITIAL_HOMEPAGE_CONFIG,
  INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG,
  INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG,
} from '../data/initialHomepage';
import { CANONICAL_SECTION_DEFINITIONS, initSequenceDraft } from '../components/AdminCMS/HomepageManager';
import { homepageService } from '../services/homepageService';
import { AppDatabase } from '../services/db';
import { canUserAccessCMS } from '../services/permissionEngine';
import { User } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log('\n=== HOMEPAGE YOUTUBE VIDEO SECTIONS AUDIT ===\n');

// 1. Strict YouTube URL Validation & Zero Hardcoded Defaults
console.log('1. YouTube URL Parsing, Validation & Zero Hardcoded Videos');
assert(
  INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG.youtubeUrl === '' &&
    INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG.youtubeVideoId === '',
  'Portal Tutorial Video ships with zero hardcoded YouTube URL or placeholder video ID'
);
assert(
  INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG.youtubeUrl === '' &&
    INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG.youtubeVideoId === '',
  'Cashback & Rewards Video ships with zero hardcoded YouTube URL or placeholder video ID'
);

const validWatch = parseAndValidateYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert(validWatch.valid && validWatch.videoId === 'dQw4w9WgXcQ', 'Accepts standard youtube.com/watch?v= URL');

const validShort = parseAndValidateYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?si=abc123');
assert(validShort.valid && validShort.videoId === 'dQw4w9WgXcQ', 'Accepts youtu.be short URL');

const validEmbed = parseAndValidateYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ');
assert(validEmbed.valid && validEmbed.videoId === 'dQw4w9WgXcQ', 'Accepts youtube.com/embed/ URL');

const validShorts = parseAndValidateYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
assert(validShorts.valid && validShorts.videoId === 'dQw4w9WgXcQ', 'Accepts youtube.com/shorts/ URL');

const validNoCookie = parseAndValidateYouTubeUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
assert(validNoCookie.valid && validNoCookie.videoId === 'dQw4w9WgXcQ', 'Accepts youtube-nocookie.com/embed/ URL');

assert(!parseAndValidateYouTubeUrl('').valid, 'Rejects empty YouTube URL');
assert(!parseAndValidateYouTubeUrl('https://vimeo.com/123456789').valid, 'Rejects non-YouTube domain (Vimeo)');
assert(!parseAndValidateYouTubeUrl('https://evil-youtube.com/watch?v=dQw4w9WgXcQ').valid, 'Rejects lookalike domain');
assert(!parseAndValidateYouTubeUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ').valid, 'Rejects insecure http:// YouTube URL');
assert(!parseAndValidateYouTubeUrl('javascript:alert(1)').valid, 'Rejects javascript: protocol');
assert(!parseAndValidateYouTubeUrl('https://www.youtube.com/watch?v=short').valid, 'Rejects invalid non-11-char video ID');
assert(!parseAndValidateYouTubeUrl('https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ').valid, 'Rejects URL with embedded credentials');

const embedUrl = getYouTubeEmbedUrl('dQw4w9WgXcQ');
assert(
  embedUrl.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?') &&
    embedUrl.includes('playsinline=1') &&
    embedUrl.includes('rel=0'),
  'Generates privacy-enhanced youtube-nocookie.com embed URL with playsinline=1 and rel=0'
);
assert(
  getYouTubeWatchUrl('dQw4w9WgXcQ') === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'Generates canonical watch fallback URL'
);
const thumbs = getYouTubeThumbnailCandidates('dQw4w9WgXcQ', 'https://cdn.example.com/custom.jpg');
assert(
  thumbs[0] === 'https://cdn.example.com/custom.jpg' &&
    thumbs[1].includes('maxresdefault.jpg') &&
    thumbs[3].includes('hqdefault.jpg'),
  'Builds ordered thumbnail fallback chain (custom -> maxresdefault -> sddefault -> hqdefault)'
);

// 2. Thumbnail Upload Security Validation
console.log('\n2. Thumbnail Format & File Size Validation');
assert(
  validateThumbnailFile({ name: 'cover.webp', type: 'image/webp', size: 512_000 }).valid,
  'Accepts valid WebP thumbnail under 5 MB'
);
assert(
  validateThumbnailFile({ name: 'cover.jpg', type: 'image/jpeg', size: 2 * 1024 * 1024 }).valid,
  'Accepts valid JPEG thumbnail under 5 MB'
);
assert(
  !validateThumbnailFile({ name: 'xss.svg', type: 'image/svg+xml', size: 1024 }).valid,
  'Blocks SVG uploads'
);
assert(
  !validateThumbnailFile({ name: 'script.html', type: 'text/html', size: 1024 }).valid,
  'Blocks HTML uploads'
);
assert(
  !validateThumbnailFile({ name: 'huge.png', type: 'image/png', size: MAX_THUMBNAIL_FILE_SIZE_BYTES + 1 }).valid,
  'Blocks oversized images (> 5 MB)'
);

// 3. Portal Tutorial Video Config & Width Clamping (60%–70%)
console.log('\n3. Portal Tutorial Video Configuration & Width Clamping');
assert(clampTutorialVideoWidthPercent(40) === 60, 'Clamps desktop width floor to 60%');
assert(clampTutorialVideoWidthPercent(65) === 65, 'Preserves default desktop width at 65%');
assert(clampTutorialVideoWidthPercent(95) === 70, 'Clamps desktop width ceiling to 70%');

const invalidActivePortal = validatePortalTutorialVideoConfig({
  ...INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG,
  isActive: true,
  youtubeUrl: '',
});
assert(!invalidActivePortal.valid, 'Blocks publishing Active Portal Tutorial Video without valid YouTube URL');

const validActivePortal = validatePortalTutorialVideoConfig({
  ...INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG,
  isActive: true,
  youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
});
assert(
  validActivePortal.valid && validActivePortal.videoId === 'dQw4w9WgXcQ',
  'Validates Portal Tutorial Video when valid YouTube URL is provided'
);

// 4. Cashback & Rewards Video Config & Safe CTA Validation
console.log('\n4. Cashback & Rewards Video Configuration & Safe CTA');
assert(
  validateCashbackCtaDestination('/b2b/my-cashback').valid &&
    validateCashbackCtaDestination('/b2b/my-cashback').isExternal === false,
  'Accepts internal My Cashback CTA route (/b2b/my-cashback)'
);
assert(!validateCashbackCtaDestination('javascript:alert(1)').valid, 'Blocks javascript: CTA destination');
assert(!validateCashbackCtaDestination('//evil.com').valid, 'Blocks protocol-relative CTA destination');

const validCashback = validateCashbackRewardsVideoConfig({
  ...INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG,
  isActive: true,
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
});
assert(validCashback.valid && validCashback.videoId === 'dQw4w9WgXcQ', 'Validates Cashback & Rewards Video config');

// 5. Performance & Privacy Static Invariants
console.log('\n5. Click-to-Load Performance & Cashback Privacy Static Checks');
const playerSrc = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/public/YouTubeClickToPlayPlayer.tsx'),
  'utf-8'
);
assert(
  playerSrc.includes('useState(false)') && playerSrc.includes('isPlaying && !iframeError ?'),
  'YouTube iframe is NOT mounted on initial page render (loads only after visitor clicks Play)'
);
assert(
  playerSrc.includes('aspect-video') && playerSrc.includes('allowFullScreen'),
  'Reserves 16:9 aspect ratio (zero CLS) and supports fullscreen playback'
);

const cashbackSectionSrc = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/public/CashbackRewardsVideoSection.tsx'),
  'utf-8'
);
assert(
  !cashbackSectionSrc.includes('getCashbackWallet') &&
    !cashbackSectionSrc.includes('walletBalance') &&
    !cashbackSectionSrc.includes('/api/cashback'),
  'Cashback homepage section NEVER queries or exposes private wallet balances or alters cashback calculations'
);

const homepageMgrSrc = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/AdminCMS/HomepageManager.tsx'),
  'utf-8'
);
assert(
  homepageMgrSrc.includes('handleDropModule') &&
    homepageMgrSrc.includes('onDragStart') &&
    homepageMgrSrc.includes('onDrop'),
  'Homepage Section Sequence & Ordering supports drag-and-drop reordering'
);

// 6. Homepage Sequence & Ordering, Persistence & Non-Destructive Deactivation
console.log('\n6. Sequence Registration, Ordering, Persistence & Non-Destructive Deactivation');
const defKeys = CANONICAL_SECTION_DEFINITIONS.map((d) => d.key);
assert(defKeys.includes('portalTutorialVideo'), 'portalTutorialVideo registered in CANONICAL_SECTION_DEFINITIONS');
assert(defKeys.includes('cashbackRewardsVideo'), 'cashbackRewardsVideo registered in CANONICAL_SECTION_DEFINITIONS');
assert(
  defKeys.includes('hero') &&
    defKeys.includes('demoBooking') &&
    defKeys.includes('conversionCta') &&
    defKeys.length >= 16,
  'All existing homepage sections remain intact alongside the two new video sections'
);

const db = AppDatabase.getInstance();
const originalCfg = db.getHomepageConfig();
const adminUser: User = {
  id: 'audit-admin-1',
  email: 'business@theunbound.in',
  name: 'Audit Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
} as any;
const b2bAgentUser: User = {
  id: 'audit-agent-1',
  email: 'agent@agency.test',
  name: 'Test Agent',
  role: 'B2B_AGENT',
  status: 'ACTIVE',
} as any;

assert(canUserAccessCMS(adminUser) === true, 'RBAC allows Admin CMS access');
assert(canUserAccessCMS(b2bAgentUser) === false, 'RBAC blocks B2B Agent from CMS access');
assert(canUserAccessCMS(null) === false, 'RBAC blocks unauthenticated visitors from CMS access');

// Simulate saving configured videos, reordering them, and non-destructively deactivating
const updatedOrder = [
  'hero',
  'cashbackRewardsVideo',
  'portalTutorialVideo',
  ...INITIAL_HOMEPAGE_CONFIG.homepageModuleOrder!.filter(
    (k) => k !== 'hero' && k !== 'cashbackRewardsVideo' && k !== 'portalTutorialVideo'
  ),
];

db.updateHomepageConfig(
  {
    ...originalCfg,
    homepageModuleOrder: updatedOrder,
    showPortalTutorialVideo: false, // Deactivate non-destructively
    portalTutorialVideoConfig: {
      ...INITIAL_PORTAL_TUTORIAL_VIDEO_CONFIG,
      heading: 'Custom Portal Walkthrough Title',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtubeVideoId: 'dQw4w9WgXcQ',
      videoMaxWidthPercent: 68,
      isActive: false,
    },
    showCashbackRewardsVideo: true,
    cashbackRewardsVideoConfig: {
      ...INITIAL_CASHBACK_REWARDS_VIDEO_CONFIG,
      heading: 'Updated Cashback Headline',
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      youtubeVideoId: 'dQw4w9WgXcQ',
      isActive: true,
    },
  },
  adminUser
);

const persisted = db.getHomepageConfig();
const draftAfterReload = initSequenceDraft(persisted);
assert(
  draftAfterReload[1].key === 'cashbackRewardsVideo' && draftAfterReload[2].key === 'portalTutorialVideo',
  'Reordered video section sequence persists accurately'
);
assert(
  persisted.showPortalTutorialVideo === false &&
    persisted.portalTutorialVideoConfig?.youtubeVideoId === 'dQw4w9WgXcQ' &&
    persisted.portalTutorialVideoConfig?.heading === 'Custom Portal Walkthrough Title',
  'Deactivating a video section hides it non-destructively while preserving saved URL and content'
);

const registrySections = homepageService.getHomepageSections();
const regPortal = registrySections.find((s) => s.sectionId === 'portalTutorialVideo');
const regCashback = registrySections.find((s) => s.sectionId === 'cashbackRewardsVideo');
assert(
  Boolean(regPortal && regPortal.isActive === false && regCashback && regCashback.isActive === true),
  'HomepageService registry reflects active/inactive state and sequence for both video sections'
);

// Restore clean initial state in memory
db.updateHomepageConfig(originalCfg, adminUser);

console.log(`\n=== AUDIT SUMMARY: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) {
  process.exit(1);
}
