/**
 * ============================================================================
 * AUTOMATED AUDIT — ABOUT US: MEET OUR TEAM GALLERY & CMS MANAGEMENT
 * ============================================================================
 * Validates layout engine math, pagination without empty slots, responsive
 * column resolution, payload validation, URL sanitization, image validation,
 * shared-asset delete safety, and Admin CMS permission gating.
 */

import assert from 'node:assert/strict';
import {
  DEFAULT_MEET_OUR_TEAM_CONFIG,
  MEET_OUR_TEAM_LAYOUT_PRESETS,
  TeamMemberRecord,
  applyLayoutPreset,
  getEffectiveItemsPerPage,
  getResponsiveGridColsClasses,
  normalizeGalleryConfig,
  paginateActiveTeamMembers,
  resolveViewportColumns
} from '../types/teamGallery';
import {
  sanitizeSocialLinks,
  validateAndSanitizeTeamMemberInput,
  validateGalleryConfigForSave
} from '../services/teamGalleryService';
import {
  isTeamPhotoReferencedByOthers,
  validateTeamPhotoFile
} from '../services/teamPhotoStorageService';
import { canUserAccessCMSSubTab, getDefaultPermissionsForRole } from '../services/permissionEngine';
import type { User } from '../types';

function makeMember(
  id: string,
  order: number,
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
  storagePath?: string
): TeamMemberRecord {
  return {
    teamMemberId: id,
    fullName: `Member ${id}`,
    designation: 'Japan Travel Specialist',
    introduction: '<p>Specializes in bespoke cultural routes across Honshu and Hokkaido.</p>',
    imageStoragePath: storagePath || `websiteContent/aboutUs/meetOurTeam/${id}/photo.webp`,
    imageUrl: `https://example.com/${id}.webp`,
    thumbnailStoragePath: `websiteContent/aboutUs/meetOurTeam/${id}/thumb.webp`,
    thumbnailUrl: `https://example.com/${id}_thumb.webp`,
    displayOrder: order,
    status,
    createdAt: `2026-01-01T00:00:0${order}Z`,
    updatedAt: `2026-01-01T00:00:0${order}Z`
  };
}

function runTests() {
  console.log('Running Meet Our Team Gallery Audit...');

  // 1. Default config & presets (A-E)
  assert.equal(DEFAULT_MEET_OUR_TEAM_CONFIG.heading, 'Meet Our Team');
  assert.equal(DEFAULT_MEET_OUR_TEAM_CONFIG.desktopColumns, 4);
  assert.equal(DEFAULT_MEET_OUR_TEAM_CONFIG.tabletColumns, 2);
  assert.equal(DEFAULT_MEET_OUR_TEAM_CONFIG.mobileColumns, 1);

  for (const preset of MEET_OUR_TEAM_LAYOUT_PRESETS) {
    const applied = applyLayoutPreset(DEFAULT_MEET_OUR_TEAM_CONFIG, preset.id);
    assert.equal(applied.layoutPreset, preset.id);
    assert.ok(applied.desktopColumns >= 1 && applied.desktopColumns <= 6);
  }

  // 2. Custom rows x columns & viewport resolution
  const custom3x3 = normalizeGalleryConfig({
    layoutPreset: 'LAYOUT_E_CUSTOM',
    rows: 3,
    desktopColumns: 3,
    tabletColumns: 2,
    mobileColumns: 1,
    itemsPerPage: null
  });
  assert.equal(resolveViewportColumns(custom3x3, 'desktop'), 3);
  assert.equal(resolveViewportColumns(custom3x3, 'tablet'), 2);
  assert.equal(resolveViewportColumns(custom3x3, 'mobile'), 1);
  assert.equal(getEffectiveItemsPerPage(custom3x3, 'desktop'), 9);
  assert.equal(getResponsiveGridColsClasses(custom3x3), 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3');
  assert.equal(getResponsiveGridColsClasses(custom3x3, 'tablet'), 'grid-cols-2');

  // 3. Pagination filters INACTIVE members, sorts by displayOrder, never creates empty cards
  const members: TeamMemberRecord[] = [
    makeMember('m3', 2, 'ACTIVE'),
    makeMember('m1', 0, 'ACTIVE'),
    makeMember('m_inactive', 1, 'INACTIVE'),
    makeMember('m2', 1, 'ACTIVE'),
    makeMember('m4', 3, 'ACTIVE'),
    makeMember('m5', 4, 'ACTIVE')
  ];

  // Configure 2x2 => capacity 4 on desktop
  const grid2x2 = normalizeGalleryConfig({ rows: 2, desktopColumns: 2, itemsPerPage: null });
  const page1 = paginateActiveTeamMembers(members, grid2x2, 1, 'desktop');
  assert.equal(page1.totalActiveMembers, 5, 'Inactive members must be excluded');
  assert.equal(page1.totalPages, 2);
  assert.equal(page1.visibleMembers.length, 4);
  assert.deepEqual(
    page1.visibleMembers.map((m) => m.teamMemberId),
    ['m1', 'm2', 'm3', 'm4'],
    'Active members must be sorted strictly by displayOrder'
  );

  const page2 = paginateActiveTeamMembers(members, grid2x2, 2, 'desktop');
  assert.equal(page2.visibleMembers.length, 1, 'Page 2 must contain only the 1 real remaining member (zero empty cards)');
  assert.equal(page2.visibleMembers[0].teamMemberId, 'm5');

  // Empty gallery produces 0 visible members (zero fictional fallback members)
  const emptyPage = paginateActiveTeamMembers([], grid2x2, 1, 'desktop');
  assert.equal(emptyPage.totalActiveMembers, 0);
  assert.equal(emptyPage.visibleMembers.length, 0);

  // 4. Input & social link validation / sanitization
  const validPayload = validateAndSanitizeTeamMemberInput({
    fullName: 'Aiko Watanabe',
    designation: 'Kyoto Experience Curator',
    introduction: 'Curates private ryokan stays and culinary walks across Kansai.',
    imageStoragePath: 'websiteContent/aboutUs/meetOurTeam/tm_1/photo.webp',
    imageUrl: 'https://storage.googleapis.com/bucket/photo.webp',
    socialLinks: {
      linkedin: 'linkedin.com/in/aiko-watanabe',
      email: 'aiko@theunbound.in'
    },
    displayOrder: 0,
    status: 'ACTIVE'
  });
  assert.equal(validPayload.socialLinks.linkedin, 'https://linkedin.com/in/aiko-watanabe');
  assert.equal(validPayload.socialLinks.email, 'aiko@theunbound.in');

  assert.throws(
    () => sanitizeSocialLinks({ linkedin: 'javascript:alert(1)' }),
    /Unsupported protocol|Invalid/
  );
  assert.throws(
    () =>
      validateAndSanitizeTeamMemberInput({
        fullName: 'A',
        designation: 'Lead',
        introduction: 'Short valid bio here.',
        imageStoragePath: 'p',
        imageUrl: 'https://example.com/a.webp',
        displayOrder: 0,
        status: 'ACTIVE'
      }),
    /Full Name/
  );

  assert.equal(validateGalleryConfigForSave({ heading: '' }).heading, 'Meet Our Team');
  assert.throws(
    () => validateGalleryConfigForSave({ heading: 'x'.repeat(150) }),
    /Section heading/
  );
  assert.throws(
    () => validateGalleryConfigForSave({ introText: 'x'.repeat(1005) }),
    /Introductory text/
  );

  // 5. Image upload file validation
  const okFile = new File([new Uint8Array(1024)], 'portrait.webp', { type: 'image/webp' });
  assert.equal(validateTeamPhotoFile(okFile).valid, true);

  const badType = new File([new Uint8Array(1024)], 'doc.pdf', { type: 'application/pdf' });
  assert.equal(validateTeamPhotoFile(badType).valid, false);

  const tooBig = new File([new Uint8Array(11 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
  assert.equal(validateTeamPhotoFile(tooBig).valid, false);

  // 6. Shared-asset deletion safety check
  const sharedPath = 'websiteContent/aboutUs/meetOurTeam/shared/photo.webp';
  const mShared1 = makeMember('s1', 0, 'ACTIVE', sharedPath);
  const mShared2 = makeMember('s2', 1, 'ACTIVE', sharedPath);
  const mUnique = makeMember('u1', 2, 'ACTIVE');
  assert.equal(
    isTeamPhotoReferencedByOthers(sharedPath, mShared1.imageUrl, [mShared1, mShared2, mUnique], 's1'),
    true,
    'Shared photo referenced by another team member must be protected from deletion'
  );
  assert.equal(
    isTeamPhotoReferencedByOthers(mUnique.imageStoragePath, mUnique.imageUrl, [mShared1, mShared2, mUnique], 'u1'),
    false,
    'Unreferenced photo can be cleaned up safely'
  );

  // 7. Permission Engine check for ABOUT_US_TEAM CMS subtab
  const adminUser: User = {
    id: 'usr-1',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'ADMIN',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01T00:00:00Z',
    permissions: getDefaultPermissionsForRole('ADMIN')
  };
  assert.equal(canUserAccessCMSSubTab(adminUser, 'PAGE_MANAGEMENT', 'ABOUT_US_TEAM'), true);

  const restrictedStaff: User = {
    id: 'usr-2',
    name: 'Staff',
    email: 'staff@theunbound.in',
    role: 'TEAM_MEMBER',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01T00:00:00Z',
    permissions: {
      ...getDefaultPermissionsForRole('TEAM_MEMBER'),
      cmsContent: {
        ...getDefaultPermissionsForRole('TEAM_MEMBER').cmsContent!,
        aboutUs: false
      }
    }
  };
  assert.equal(canUserAccessCMSSubTab(restrictedStaff, 'PAGE_MANAGEMENT', 'ABOUT_US_TEAM'), false);

  console.log('ALL MEET OUR TEAM GALLERY AUDIT CHECKS PASSED.');
}

runTests();
