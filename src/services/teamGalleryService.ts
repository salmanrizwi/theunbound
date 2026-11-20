/**
 * ============================================================================
 * THEUNBOUND — ABOUT US: MEET OUR TEAM FIRESTORE SERVICE
 * ============================================================================
 * Authoritative persistence layer for:
 *   - Gallery configuration doc: `websiteContent/aboutUs`
 *   - Team member subcollection: `websiteContent/aboutUs/meetOurTeam/{teamMemberId}`
 *
 * Security & performance guarantees:
 *   - Public About Us page subscribes ONLY to `status == 'ACTIVE'` members.
 *   - Strict validation & sanitization of all user-supplied fields, rich-text
 *     bios, and social URLs before writing.
 *   - Structured Firestore error diagnostics (`handleFirestoreError`).
 *   - Atomic batch updates for Drag & Drop ordering.
 *   - Safe deletion preserving any image assets referenced elsewhere.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  DEFAULT_MEET_OUR_TEAM_CONFIG,
  MeetOurTeamGalleryConfig,
  TeamMemberInput,
  TeamMemberRecord,
  TeamMemberStatus,
  TeamSocialLinks,
  normalizeGalleryConfig
} from '../types/teamGallery';
import { sanitizeRichText, isHtmlContent, convertPlainTextToSemanticHtml } from '../utils/richTextFormatter';
import { deleteTeamPhotoAssetsIfUnreferenced, SafePhotoDeleteResult } from './teamPhotoStorageService';

export const ABOUT_US_CONTENT_COLLECTION = 'websiteContent';
export const ABOUT_US_CONTENT_DOC_ID = 'aboutUs';
export const MEET_OUR_TEAM_SUBCOLLECTION = 'meetOurTeam';

export enum TeamGalleryOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface TeamGalleryFirestoreErrorInfo {
  error: string;
  operationType: TeamGalleryOperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  };
}

export interface TeamGalleryActor {
  uid?: string;
  id?: string;
  email?: string;
  role?: string;
  name?: string;
}

function handleFirestoreError(
  error: unknown,
  operationType: TeamGalleryOperationType,
  path: string | null
): never {
  const errInfo: TeamGalleryFirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('[MeetOurTeam Firestore Error]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function getAboutUsDocRef() {
  return doc(db, ABOUT_US_CONTENT_COLLECTION, ABOUT_US_CONTENT_DOC_ID);
}

function getTeamMembersCollectionRef() {
  return collection(
    db,
    ABOUT_US_CONTENT_COLLECTION,
    ABOUT_US_CONTENT_DOC_ID,
    MEET_OUR_TEAM_SUBCOLLECTION
  );
}

function getTeamMemberDocRef(teamMemberId: string) {
  return doc(
    db,
    ABOUT_US_CONTENT_COLLECTION,
    ABOUT_US_CONTENT_DOC_ID,
    MEET_OUR_TEAM_SUBCOLLECTION,
    teamMemberId
  );
}

/**
 * Validates and normalizes social media URLs or contact email.
 * Strictly blocks unsafe protocols (`javascript:`, `data:`, `vbscript:`, etc.).
 */
export function sanitizeSocialUrl(rawValue: string | undefined, kind: keyof TeamSocialLinks): string | undefined {
  if (!rawValue || typeof rawValue !== 'string') return undefined;
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;

  if (kind === 'email') {
    const cleaned = trimmed.replace(/^mailto:/i, '').trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailPattern.test(cleaned)) {
      throw new Error('Please enter a valid email address for the team member social link.');
    }
    return cleaned.slice(0, 160);
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Invalid ${kind} URL. Please enter a valid https:// web address.`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported protocol for ${kind} link. Only http:// and https:// URLs are permitted.`);
  }

  return parsed.toString().slice(0, 500);
}

export function sanitizeSocialLinks(links?: TeamSocialLinks | null): TeamSocialLinks {
  if (!links) return {};
  const result: TeamSocialLinks = {};
  const keys: Array<keyof TeamSocialLinks> = [
    'linkedin',
    'instagram',
    'twitter',
    'facebook',
    'website',
    'email'
  ];

  for (const key of keys) {
    const clean = sanitizeSocialUrl(links[key], key);
    if (clean) {
      result[key] = clean;
    }
  }
  return result;
}

export function stripHtmlToPlainText(htmlOrText: string): string {
  return (htmlOrText || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ValidatedTeamMemberPayload {
  fullName: string;
  designation: string;
  introduction: string;
  imageStoragePath: string;
  imageUrl: string;
  thumbnailStoragePath?: string;
  thumbnailUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  socialLinks: TeamSocialLinks;
  displayOrder: number;
  status: TeamMemberStatus;
}

export function validateAndSanitizeTeamMemberInput(
  input: TeamMemberInput
): ValidatedTeamMemberPayload {
  const fullName = (input.fullName || '').trim();
  if (fullName.length < 2 || fullName.length > 120) {
    throw new Error('Full Name is required and must be between 2 and 120 characters.');
  }

  const designation = (input.designation || '').trim();
  if (designation.length < 2 || designation.length > 140) {
    throw new Error('Role / Designation is required and must be between 2 and 140 characters.');
  }

  const rawIntro = (input.introduction || '').trim();
  const introPlain = stripHtmlToPlainText(rawIntro);
  if (introPlain.length < 5) {
    throw new Error('Short Introduction is required (at least 5 characters).');
  }
  if (introPlain.length > 2500) {
    throw new Error('Short Introduction is too long (maximum 2,500 characters).');
  }

  const htmlIntro = isHtmlContent(rawIntro)
    ? rawIntro
    : convertPlainTextToSemanticHtml(rawIntro);
  const introduction = sanitizeRichText(htmlIntro).slice(0, 6000);

  const imageUrl = (input.imageUrl || '').trim();
  const imageStoragePath = (input.imageStoragePath || '').trim();
  if (!imageUrl) {
    throw new Error('Profile Photograph is required.');
  }
  const isSafeImageUrl =
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('data:image/');
  if (!isSafeImageUrl) {
    throw new Error('Invalid photograph URL.');
  }
  if (imageUrl.length > 400000) {
    throw new Error('Photograph payload exceeds safe storage size. Please upload a compressed image.');
  }

  const status: TeamMemberStatus = input.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const displayOrder = Number.isFinite(Number(input.displayOrder))
    ? Math.max(0, Math.min(9999, Math.round(Number(input.displayOrder))))
    : 0;

  const socialLinks = sanitizeSocialLinks(input.socialLinks);

  const payload: ValidatedTeamMemberPayload = {
    fullName,
    designation,
    introduction,
    imageStoragePath: imageStoragePath || `external/${Date.now()}`,
    imageUrl,
    socialLinks,
    displayOrder,
    status
  };

  if (input.thumbnailStoragePath) {
    payload.thumbnailStoragePath = input.thumbnailStoragePath.trim().slice(0, 400);
  }
  if (input.thumbnailUrl && input.thumbnailUrl.length <= 400000) {
    payload.thumbnailUrl = input.thumbnailUrl.trim();
  }
  if (typeof input.imageWidth === 'number' && Number.isFinite(input.imageWidth) && input.imageWidth > 0) {
    payload.imageWidth = Math.round(input.imageWidth);
  }
  if (typeof input.imageHeight === 'number' && Number.isFinite(input.imageHeight) && input.imageHeight > 0) {
    payload.imageHeight = Math.round(input.imageHeight);
  }

  return payload;
}

export function validateGalleryConfigForSave(
  config: Partial<MeetOurTeamGalleryConfig>
): MeetOurTeamGalleryConfig {
  const normalized = normalizeGalleryConfig(config);
  if (normalized.heading.length < 2 || normalized.heading.length > 140) {
    throw new Error('Section heading must be between 2 and 140 characters.');
  }
  if (normalized.introText.length > 1000) {
    throw new Error('Introductory text cannot exceed 1,000 characters.');
  }
  return normalized;
}

function mapDocToTeamMember(id: string, data: Record<string, any>): TeamMemberRecord {
  return {
    teamMemberId: typeof data.teamMemberId === 'string' && data.teamMemberId ? data.teamMemberId : id,
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    designation: typeof data.designation === 'string' ? data.designation : '',
    introduction: typeof data.introduction === 'string' ? data.introduction : '',
    imageStoragePath: typeof data.imageStoragePath === 'string' ? data.imageStoragePath : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
    thumbnailStoragePath: typeof data.thumbnailStoragePath === 'string' ? data.thumbnailStoragePath : undefined,
    thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
    imageWidth: typeof data.imageWidth === 'number' ? data.imageWidth : undefined,
    imageHeight: typeof data.imageHeight === 'number' ? data.imageHeight : undefined,
    socialLinks: data.socialLinks && typeof data.socialLinks === 'object' ? data.socialLinks : {},
    displayOrder: typeof data.displayOrder === 'number' && Number.isFinite(data.displayOrder) ? data.displayOrder : 0,
    status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    updatedByRole: typeof data.updatedByRole === 'string' ? data.updatedByRole : undefined,
    updatedByEmail: typeof data.updatedByEmail === 'string' ? data.updatedByEmail : undefined
  };
}

function sortTeamMembers(members: TeamMemberRecord[]): TeamMemberRecord[] {
  return [...members].sort((a, b) => {
    const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

function resolveActorAudit(actor?: TeamGalleryActor | null) {
  return {
    updatedBy: actor?.uid || actor?.id || auth.currentUser?.uid || 'admin',
    updatedByRole: actor?.role || 'ADMIN',
    updatedByEmail: actor?.email || auth.currentUser?.email || ''
  };
}

export function generateTeamMemberId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `tm_${Date.now()}_${rand}`;
}

/**
 * Real-time subscription to `websiteContent/aboutUs` gallery layout configuration.
 */
export function subscribeTeamGalleryConfig(
  onData: (config: MeetOurTeamGalleryConfig) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `${ABOUT_US_CONTENT_COLLECTION}/${ABOUT_US_CONTENT_DOC_ID}`;
  return onSnapshot(
    getAboutUsDocRef(),
    (snap) => {
      if (!snap.exists()) {
        onData({ ...DEFAULT_MEET_OUR_TEAM_CONFIG });
        return;
      }
      const data = snap.data() as Record<string, any>;
      const rawCfg = data?.meetOurTeamConfig || data;
      onData(normalizeGalleryConfig(rawCfg));
    },
    (error) => {
      console.error('[MeetOurTeam] Config subscription error:', error);
      onData({ ...DEFAULT_MEET_OUR_TEAM_CONFIG });
      if (onError) onError(error);
    }
  );
}

/**
 * Public About Us subscription: strictly queries ONLY `status == 'ACTIVE'` team members.
 * Sorting by `displayOrder` happens client-side to guarantee zero composite-index failures.
 */
export function subscribeActiveTeamMembers(
  onData: (members: TeamMemberRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(getTeamMembersCollectionRef(), where('status', '==', 'ACTIVE'));
  return onSnapshot(
    q,
    (snapshot) => {
      const activeMembers = snapshot.docs.map((d) =>
        mapDocToTeamMember(d.id, d.data() as Record<string, any>)
      );
      onData(sortTeamMembers(activeMembers));
    },
    (error) => {
      console.error('[MeetOurTeam] Active team members subscription error:', error);
      onData([]);
      if (onError) onError(error);
    }
  );
}

/**
 * Admin CMS subscription: retrieves both ACTIVE and INACTIVE team members sorted by displayOrder.
 */
export function subscribeAllTeamMembers(
  onData: (members: TeamMemberRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    getTeamMembersCollectionRef(),
    (snapshot) => {
      const members = snapshot.docs.map((d) =>
        mapDocToTeamMember(d.id, d.data() as Record<string, any>)
      );
      onData(sortTeamMembers(members));
    },
    (error) => {
      console.error('[MeetOurTeam] Admin team members subscription error:', error);
      if (onError) onError(error);
    }
  );
}

export async function fetchTeamGalleryConfigOnce(): Promise<MeetOurTeamGalleryConfig> {
  const path = `${ABOUT_US_CONTENT_COLLECTION}/${ABOUT_US_CONTENT_DOC_ID}`;
  try {
    const snap = await getDoc(getAboutUsDocRef());
    if (!snap.exists()) return { ...DEFAULT_MEET_OUR_TEAM_CONFIG };
    const data = snap.data() as Record<string, any>;
    return normalizeGalleryConfig(data?.meetOurTeamConfig || data);
  } catch (err) {
    handleFirestoreError(err, TeamGalleryOperationType.GET, path);
  }
}

export async function fetchAllTeamMembersOnce(): Promise<TeamMemberRecord[]> {
  const path = `${ABOUT_US_CONTENT_COLLECTION}/${ABOUT_US_CONTENT_DOC_ID}/${MEET_OUR_TEAM_SUBCOLLECTION}`;
  try {
    const snap = await getDocs(getTeamMembersCollectionRef());
    return sortTeamMembers(
      snap.docs.map((d) => mapDocToTeamMember(d.id, d.data() as Record<string, any>))
    );
  } catch (err) {
    handleFirestoreError(err, TeamGalleryOperationType.LIST, path);
  }
}

/**
 * Publishes updated gallery layout configuration to `websiteContent/aboutUs`.
 */
export async function saveTeamGalleryConfig(
  config: Partial<MeetOurTeamGalleryConfig>,
  actor?: TeamGalleryActor | null
): Promise<MeetOurTeamGalleryConfig> {
  const path = `${ABOUT_US_CONTENT_COLLECTION}/${ABOUT_US_CONTENT_DOC_ID}`;
  const validated = validateGalleryConfigForSave(config);
  const now = new Date().toISOString();
  const audit = resolveActorAudit(actor);

  const persistedConfig: MeetOurTeamGalleryConfig = {
    ...validated,
    updatedAt: now,
    ...audit
  };

  try {
    await setDoc(
      getAboutUsDocRef(),
      {
        pageId: ABOUT_US_CONTENT_DOC_ID,
        meetOurTeamConfig: persistedConfig,
        updatedAt: now,
        ...audit
      },
      { merge: true }
    );
    return persistedConfig;
  } catch (err) {
    handleFirestoreError(err, TeamGalleryOperationType.WRITE, path);
  }
}

/**
 * Creates a new team member document in `websiteContent/aboutUs/meetOurTeam/{teamMemberId}`.
 */
export async function createTeamMember(
  input: TeamMemberInput,
  actor?: TeamGalleryActor | null
): Promise<TeamMemberRecord> {
  const teamMemberId =
    input.teamMemberId && /^[a-zA-Z0-9_-]{3,80}$/.test(input.teamMemberId)
      ? input.teamMemberId
      : generateTeamMemberId();
  const path = `${ABOUT_US_CONTENT_COLLECTION}/${ABOUT_US_CONTENT_DOC_ID}/${MEET_OUR_TEAM_SUBCOLLECTION}/${teamMemberId}`;
  const clean = validateAndSanitizeTeamMemberInput(input);
  const now = new Date().toISOString();
  const audit = resolveActorAudit(actor);

  const record: TeamMemberRecord = {
    teamMemberId,
    ...clean,
    createdAt: now,
    updatedAt: now,
    ...audit
  };

  try {
    await setDoc(getTeamMemberDocRef(teamMemberId), record);
    return record;
  } catch (err) {
    handleFirestoreError(err, TeamGalleryOperationType.CREATE, path);
  }
}

/**
 * Updates an existing team member document and cleans up replaced storage photo if unreferenced.
 */
export async function updateTeamMember(
  teamMemberId: string,
  input: TeamMemberInput,
  existingMember: TeamMemberRecord | null,
  allMembers: TeamMemberRecord[],
  actor?: TeamGalleryActor | null
): Promise<TeamMemberRecord> {
  const path = `${ABOUT_US_CONTENT_COLLECTION}/${ABOUT_US_CONTENT_DOC_ID}/${MEET_OUR_TEAM_SUBCOLLECTION}/${teamMemberId}`;
  const clean = validateAndSanitizeTeamMemberInput(input);
  const now = new Date().toISOString();
  const audit = resolveActorAudit(actor);

  const updatedRecord: TeamMemberRecord = {
    teamMemberId,
    ...clean,
    createdAt: existingMember?.createdAt || now,
    updatedAt: now,
    ...audit
  };

  try {
    await setDoc(getTeamMemberDocRef(teamMemberId), updatedRecord, { merge: false });
  } catch (err) {
    handleFirestoreError(err, TeamGalleryOperationType.UPDATE, path);
  }

  // If the photograph was replaced, safely remove the old Storage files only if unreferenced elsewhere
  if (
    existingMember &&
    existingMember.imageStoragePath &&
    existingMember.imageStoragePath !== updatedRecord.imageStoragePath
  ) {
    await deleteTeamPhotoAssetsIfUnreferenced(
      [
        { storagePath: existingMember.imageStoragePath, url: existingMember.imageUrl },
        { storagePath: existingMember.thumbnailStoragePath, url: existingMember.thumbnailUrl }
      ],
      allMembers,
      teamMemberId
    );
  }

  return updatedRecord;
}

/**
 * Toggles a team member between ACTIVE and INACTIVE.
 */
export async function setTeamMemberStatus(
  teamMemberId: string,
  status: TeamMemberStatus,
  actor?: TeamGalleryActor | null
): Promise<void> {
  const path = `${ABOUT_US_CONTENT_COLLECTION}/${ABOUT_US_CONTENT_DOC_ID}/${MEET_OUR_TEAM_SUBCOLLECTION}/${teamMemberId}`;
  const now = new Date().toISOString();
  const audit = resolveActorAudit(actor);

  try {
    await updateDoc(getTeamMemberDocRef(teamMemberId), {
      status,
      updatedAt: now,
      ...audit
    });
  } catch (err) {
    handleFirestoreError(err, TeamGalleryOperationType.UPDATE, path);
  }
}

/**
 * Atomically persists Drag & Drop / manual display order changes across all team members.
 */
export async function reorderTeamMembers(
  orderedMemberIds: string[],
  actor?: TeamGalleryActor | null
): Promise<void> {
  const path = `${ABOUT_US_CONTENT_COLLECTION}/${ABOUT_US_CONTENT_DOC_ID}/${MEET_OUR_TEAM_SUBCOLLECTION}`;
  if (!orderedMemberIds.length) return;

  const now = new Date().toISOString();
  const audit = resolveActorAudit(actor);

  try {
    const batch = writeBatch(db);
    orderedMemberIds.forEach((memberId, index) => {
      batch.update(getTeamMemberDocRef(memberId), {
        displayOrder: index,
        updatedAt: now,
        ...audit
      });
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, TeamGalleryOperationType.WRITE, path);
  }
}

/**
 * Deletes a team member document and cleans up associated Storage assets
 * ONLY when no other team member or CMS component references the asset.
 */
export async function deleteTeamMemberSafely(
  member: TeamMemberRecord,
  allMembers: TeamMemberRecord[]
): Promise<SafePhotoDeleteResult> {
  const path = `${ABOUT_US_CONTENT_COLLECTION}/${ABOUT_US_CONTENT_DOC_ID}/${MEET_OUR_TEAM_SUBCOLLECTION}/${member.teamMemberId}`;
  try {
    await deleteDoc(getTeamMemberDocRef(member.teamMemberId));
  } catch (err) {
    handleFirestoreError(err, TeamGalleryOperationType.DELETE, path);
  }

  return deleteTeamPhotoAssetsIfUnreferenced(
    [
      { storagePath: member.imageStoragePath, url: member.imageUrl },
      { storagePath: member.thumbnailStoragePath, url: member.thumbnailUrl }
    ],
    allMembers,
    member.teamMemberId
  );
}
