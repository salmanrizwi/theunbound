import { 
  User, 
  UserRole, 
  UserPermissionAccess, 
  CMSOperationsPermissions, 
  CMSContentPermissions, 
  CMSFinancePermissions, 
  CMSSystemPermissions 
} from '../types';

export const MASTER_ADMIN_EMAIL = 'business@theunbound.in';
export const MASTER_ADMIN_ID = 'usr-admin-business';

/**
 * Generates default permission profiles by role archetype
 */
export function getDefaultPermissionsForRole(role: UserRole): UserPermissionAccess {
  switch (role) {
    case 'ADMIN':
      return {
        b2bQuoteBuilderAccess: true,
        buyerQuoteBuilderAccess: true,
        chatbotAccess: true,
        b2bChatbotAccess: true,
        canAccessPricingCalculator: true,
        canCreateBookings: true,
        canExportPDF: true,
        canViewWholesaleNetRates: true,
        canAddManualHotelRates: true,
        canManagePackages: true,
        canAccessCMS: true,
        canAccessRoster: true,
        canAccessFinancials: true,
        canManageUsers: true,
        canManagePermissions: true,
        canDeleteRecords: true,
        canDeleteProducts: true,
        canDeleteHotels: true,
        canDeletePackages: true,
        canDeleteDestinations: true,
        canDeleteCityHubs: true,
        canDeleteRegions: true,
        canDeleteEditorial: true,
        canDeleteQuotes: true,
        cmsOperations: {
          enabled: true,
          productManagement: true,
          hotelManagement: true,
          packageManagement: true,
          bookingManagement: true,
          leadManagement: true,
          activityManagement: true,
          tourManagement: true,
          transferManagement: true,
          railManagement: true,
          guideManagement: true,
          rosterAndRoles: true
        },
        cmsContent: {
          enabled: true,
          destinationManagement: true,
          pageManagement: true,
          marketingManagement: true,
          destinationPages: true,
          hubsCities: true,
          faqs: true,
          homepageContent: true,
          menuManagement: true,
          footerManagement: true,
          legalPages: true,
          aboutUs: true,
          contactUs: true,
          blogEditorial: true,
          seoContent: true,
          customerGallery: true,
          googleReviews: true
        },
        cmsFinance: {
          enabled: true,
          accountManagement: true,
          userPermissionManagement: true,
          financials: true,
          invoicing: true,
          payments: true,
          paymentProof: true,
          ledger: true,
          generateInvoice: true,
          generateProforma: true,
          generateVoucher: true,
          pricingManagement: true,
          marginManagement: true,
          commercialConfiguration: true,
          userAccounts: true,
          agencyAccounts: true,
          customerAccounts: true
        },
        cmsSystem: {
          enabled: true,
          calendarSlas: true,
          integrationsHub: true,
          auditLogs: true,
          googleSheetsSync: true,
          firebaseSync: true,
          gmailIntegration: true,
          googleCalendar: true,
          dataSyncAudit: true,
          systemHealth: true,
          apiConfiguration: true,
          databaseDiagnostics: true,
          importLogs: true,
          syncLogs: true,
          securityLogs: true
        },
        cmsSystemAnalysis: {
          enabled: true,
          view: true,
          userAnalysis: true,
          activityAnalysis: true,
          transactionAnalysis: true,
          export: true
        }
      };

    case 'TEAM_MEMBER':
    case 'DMC_STAFF':
      return {
        b2bQuoteBuilderAccess: true,
        buyerQuoteBuilderAccess: true,
        chatbotAccess: true,
        b2bChatbotAccess: true,
        canAccessPricingCalculator: true,
        canCreateBookings: true,
        canExportPDF: true,
        canViewWholesaleNetRates: true,
        canAddManualHotelRates: true,
        canManagePackages: true,
        canAccessCMS: true,
        canAccessRoster: true,
        canAccessFinancials: false,
        canManageUsers: false,
        canManagePermissions: false,
        canDeleteRecords: false,
        canDeleteProducts: false,
        canDeleteHotels: false,
        canDeletePackages: false,
        canDeleteDestinations: false,
        canDeleteCityHubs: false,
        canDeleteRegions: false,
        canDeleteEditorial: false,
        canDeleteQuotes: false,
        cmsOperations: {
          enabled: true,
          productManagement: true,
          hotelManagement: true,
          packageManagement: true,
          bookingManagement: true,
          leadManagement: true,
          activityManagement: true,
          tourManagement: true,
          transferManagement: true,
          railManagement: true,
          guideManagement: true,
          rosterAndRoles: true
        },
        cmsContent: {
          enabled: true,
          destinationManagement: true,
          pageManagement: true,
          marketingManagement: true,
          destinationPages: true,
          hubsCities: true,
          faqs: true,
          homepageContent: true,
          menuManagement: true,
          footerManagement: true,
          legalPages: true,
          aboutUs: true,
          contactUs: true,
          blogEditorial: true,
          seoContent: true,
          customerGallery: true,
          googleReviews: true
        },
        cmsFinance: {
          enabled: false,
          accountManagement: false,
          userPermissionManagement: false,
          financials: false,
          invoicing: false,
          payments: false,
          paymentProof: false,
          ledger: false,
          generateInvoice: false,
          generateProforma: false,
          generateVoucher: true,
          pricingManagement: false,
          marginManagement: false,
          commercialConfiguration: false,
          userAccounts: false,
          agencyAccounts: false,
          customerAccounts: false
        },
        cmsSystem: {
          enabled: true,
          calendarSlas: true,
          integrationsHub: false,
          auditLogs: true,
          googleSheetsSync: false,
          firebaseSync: false,
          gmailIntegration: false,
          googleCalendar: true,
          dataSyncAudit: false,
          systemHealth: false,
          apiConfiguration: false,
          databaseDiagnostics: false,
          importLogs: true,
          syncLogs: false,
          securityLogs: false
        },
        cmsSystemAnalysis: {
          enabled: true,
          view: true,
          userAnalysis: true,
          activityAnalysis: true,
          transactionAnalysis: false,
          export: false
        }
      };

    case 'B2B_AGENT':
    case 'AGENT':
      return {
        b2bQuoteBuilderAccess: true,
        buyerQuoteBuilderAccess: false,
        chatbotAccess: true, // Visible to B2B Agent once approved
        b2bChatbotAccess: true,
        canAccessPricingCalculator: true,
        canCreateBookings: true,
        canExportPDF: true,
        canViewWholesaleNetRates: false,
        canAddManualHotelRates: true,
        canManagePackages: false,
        canAccessCMS: false,
        canAccessRoster: false,
        canAccessFinancials: false,
        canManageUsers: false,
        canManagePermissions: false,
        canDeleteRecords: false,
        cmsOperations: { enabled: false },
        cmsContent: { enabled: false },
        cmsFinance: { enabled: false },
        cmsSystem: { enabled: false },
        cmsSystemAnalysis: { enabled: false, view: false, userAnalysis: false, activityAnalysis: false, transactionAnalysis: false, export: false }
      };

    case 'BUYER':
      return {
        b2bQuoteBuilderAccess: false,
        buyerQuoteBuilderAccess: true,
        canAccessPricingCalculator: true,
        canCreateBookings: true,
        canExportPDF: true,
        canViewWholesaleNetRates: false,
        canAddManualHotelRates: false,
        canManagePackages: false,
        canAccessCMS: false,
        canAccessRoster: false,
        canAccessFinancials: false,
        canManageUsers: false,
        canManagePermissions: false,
        canDeleteRecords: false,
        cmsOperations: { enabled: false },
        cmsContent: { enabled: false },
        cmsFinance: { enabled: false },
        cmsSystem: { enabled: false },
        cmsSystemAnalysis: { enabled: false, view: false, userAnalysis: false, activityAnalysis: false, transactionAnalysis: false, export: false }
      };

    case 'VIEWER':
    case 'PUBLIC':
    default:
      return {
        b2bQuoteBuilderAccess: false,
        buyerQuoteBuilderAccess: false,
        canAccessPricingCalculator: false,
        canCreateBookings: false,
        canExportPDF: false,
        canViewWholesaleNetRates: false,
        canAddManualHotelRates: false,
        canManagePackages: false,
        canAccessCMS: false,
        canAccessRoster: false,
        canAccessFinancials: false,
        canManageUsers: false,
        canManagePermissions: false,
        canDeleteRecords: false,
        cmsOperations: { enabled: false },
        cmsContent: { enabled: false },
        cmsFinance: { enabled: false },
        cmsSystem: { enabled: false }
      };
  }
}

/**
 * Checks if a user is the Master Administrator (safeguard)
 */
export function isMasterAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  return email === MASTER_ADMIN_EMAIL.toLowerCase() || user.id === MASTER_ADMIN_ID;
}

/**
 * Safeguard check: At least one authorized Administrator must retain Account Management & Permission access
 */
export function canRevokeAdminPermissions(
  targetUser: User, 
  allUsers: User[]
): { canRevoke: boolean; error?: string } {
  if (isMasterAdmin(targetUser)) {
    return {
      canRevoke: false,
      error: 'Security Policy Safeguard: Permissions cannot be revoked from the Primary Master Administrator.'
    };
  }

  // Count active, approved admins who retain user management
  const remainingAdmins = allUsers.filter(u => 
    u.id !== targetUser.id &&
    u.role === 'ADMIN' &&
    (u.approvalStatus === 'APPROVED' || !u.approvalStatus) &&
    (u.permissions?.cmsFinance?.accountManagement !== false || isMasterAdmin(u))
  );

  if (remainingAdmins.length === 0) {
    return {
      canRevoke: false,
      error: 'Security Safeguard: Cannot revoke access. At least one Administrator must retain Account Management & Permissions privileges.'
    };
  }

  return { canRevoke: true };
}

/**
 * Evaluates whether a user is allowed to access Quote Builder (B2B or Buyer tier)
 */
export function canUserAccessQuoteBuilder(
  user: User | null | undefined, 
  mode: 'B2B' | 'BUYER' = 'B2B'
): { allowed: boolean; reason?: 'LOGGED_OUT' | 'APPROVAL_PENDING' | 'REJECTED' | 'PERMISSION_DENIED' } {
  if (!user) {
    return { allowed: false, reason: 'LOGGED_OUT' };
  }

  const approvalStatus = user.approvalStatus || 'APPROVED';
  if (approvalStatus === 'PENDING') {
    return { allowed: false, reason: 'APPROVAL_PENDING' };
  }
  if (approvalStatus === 'REJECTED') {
    return { allowed: false, reason: 'REJECTED' };
  }

  // Master Admin always has full access
  if (isMasterAdmin(user)) {
    return { allowed: true };
  }

  const perms = user.permissions;

  if (mode === 'B2B') {
    // Check specific user-level flag if set
    if (perms && typeof perms.b2bQuoteBuilderAccess === 'boolean') {
      return perms.b2bQuoteBuilderAccess 
        ? { allowed: true } 
        : { allowed: false, reason: 'PERMISSION_DENIED' };
    }
    // Backward-compatible fallback to Pricing Calculator flag or role defaults
    if (perms && typeof perms.canAccessPricingCalculator === 'boolean') {
      const rolePermits = user.role === 'B2B_AGENT' || user.role === 'AGENT' || user.role === 'ADMIN' || user.role === 'TEAM_MEMBER';
      if (!rolePermits || !perms.canAccessPricingCalculator) {
        return { allowed: false, reason: 'PERMISSION_DENIED' };
      }
      return { allowed: true };
    }
    const defaultAllowed = user.role === 'B2B_AGENT' || user.role === 'AGENT' || user.role === 'ADMIN' || user.role === 'TEAM_MEMBER';
    return defaultAllowed ? { allowed: true } : { allowed: false, reason: 'PERMISSION_DENIED' };
  }

  if (mode === 'BUYER') {
    if (perms && typeof perms.buyerQuoteBuilderAccess === 'boolean') {
      return perms.buyerQuoteBuilderAccess 
        ? { allowed: true } 
        : { allowed: false, reason: 'PERMISSION_DENIED' };
    }
    if (perms && typeof perms.canAccessPricingCalculator === 'boolean') {
      return perms.canAccessPricingCalculator ? { allowed: true } : { allowed: false, reason: 'PERMISSION_DENIED' };
    }
    const defaultAllowed = user.role === 'BUYER' || user.role === 'ADMIN' || user.role === 'TEAM_MEMBER';
    return defaultAllowed ? { allowed: true } : { allowed: false, reason: 'PERMISSION_DENIED' };
  }

  return { allowed: true };
}

/**
 * Evaluates whether a user is authorized to access the AI Planner.
 * Strictly adheres to TheUnbound access guidelines:
 * - AI Planner access is controlled EXCLUSIVELY by Admin.
 * - A user does NOT automatically receive access merely by role.
 * - Must have explicit permission: user.permissions.aiPlannerAccess === true.
 * - Master Admin is always granted access to prevent administrative lockouts.
 */
export function canUserAccessAIPlanner(
  user: User | null | undefined
): { allowed: boolean; reason?: 'LOGGED_OUT' | 'APPROVAL_PENDING' | 'REJECTED' | 'PERMISSION_DENIED'; message?: string } {
  if (!user) {
    return { 
      allowed: false, 
      reason: 'LOGGED_OUT',
      message: 'You must be signed in to access the AI Planner.' 
    };
  }

  const approvalStatus = user.approvalStatus || 'APPROVED';
  if (approvalStatus === 'PENDING') {
    return { 
      allowed: false, 
      reason: 'APPROVAL_PENDING',
      message: 'Your account registration is pending Admin verification.' 
    };
  }
  if (approvalStatus === 'REJECTED') {
    return { 
      allowed: false, 
      reason: 'REJECTED',
      message: 'Your account access has been revoked.' 
    };
  }

  // Master Admin always has access to prevent system lockout
  if (isMasterAdmin(user)) {
    return { allowed: true };
  }

  // Check explicit permission
  if (user.permissions?.aiPlannerAccess === true) {
    return { allowed: true };
  }

  // Explicitly denied or unallocated
  return { 
    allowed: false, 
    reason: 'PERMISSION_DENIED',
    message: 'AI Planner access has not been allocated to your account by an Administrator.' 
  };
}

/**
 * Evaluates whether a user is authorized to access the AI Travel Chatbot.
 * Adheres strictly to TheUnbound access guidelines:
 * - Under Quote Builder Engine Access, Admin manages permission to allow chatbot access for B2B agents only.
 * - Admin decides which agent should have the access of ChatBot.
 * - Master Admin and Admin/Team Member accounts always have access.
 * - For B2B agents (role 'B2B_AGENT' or 'AGENT'), access requires explicit permission:
 *   user.permissions.chatbotAccess === true || user.permissions.b2bChatbotAccess === true.
 * - Retail/Buyer portal users retain general assistant access for retail quotations unless revoked.
 */
/**
 * Evaluates whether a user is authorized to access the AI Travel Chatbot ("Plan with AI").
 * Adheres strictly to TheUnbound access guidelines:
 * - NO ONE should see or access the Plan with AI chat button if they are logged out.
 * - Buyer: Visible and accessible once logged in.
 * - B2B Agent: Visible and accessible once approved (pending/rejected agents are blocked).
 * - Admin / Master Admin / Staff: Always authorized.
 */
export function canUserAccessChatbot(
  user: User | null | undefined,
  _portal: 'BUYER' | 'B2B_AGENT' | 'ADMIN' | string = 'B2B_AGENT'
): { allowed: boolean; reason?: 'LOGGED_OUT' | 'APPROVAL_PENDING' | 'REJECTED' | 'PERMISSION_DENIED'; message?: string } {
  // 1. Strictly forbidden if logged out
  if (!user) {
    return { 
      allowed: false, 
      reason: 'LOGGED_OUT',
      message: 'Please sign in to access the Plan with AI travel specialist.' 
    };
  }

  // 2. Master Admin and internal staff always have access
  if (isMasterAdmin(user) || user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
    return { allowed: true };
  }

  // 3. Approval status check for all external accounts
  const approvalStatus = user.approvalStatus || 'APPROVED';
  if (approvalStatus === 'PENDING') {
    return { 
      allowed: false, 
      reason: 'APPROVAL_PENDING', 
      message: 'Your B2B account registration is pending Admin verification.' 
    };
  }
  if (approvalStatus === 'REJECTED') {
    return { 
      allowed: false, 
      reason: 'REJECTED', 
      message: 'Your account access has been revoked.' 
    };
  }

  // 4. Logged-in Buyer or Direct Client accounts
  if (user.role === 'BUYER' || user.role === 'PUBLIC') {
    return { allowed: true };
  }

  // 5. B2B Agent accounts: once approved (checked above)
  const isAgent = user.role === 'B2B_AGENT' || user.role === 'AGENT';
  if (isAgent) {
    // If admin explicitly revoked chatbot access in permissions, respect the revocation
    if (user.permissions && user.permissions.chatbotAccess === false && user.permissions.b2bChatbotAccess === false) {
      return { 
        allowed: false, 
        reason: 'PERMISSION_DENIED', 
        message: 'AI Chatbot access has been deactivated for your account by an Administrator.' 
      };
    }
    return { allowed: true };
  }

  return { 
    allowed: false,
    reason: 'PERMISSION_DENIED',
    message: 'Chatbot access is restricted to Buyers and approved B2B Agents.'
  };
}

/**
 * Evaluates whether a user is authorized to share a quotation via WhatsApp.
 * Adheres to TheUnbound access guidelines:
 * - Admin / Master Admin: Always allowed
 * - B2B Agent: Allowed if Quote Builder access is granted (unless explicitly revoked via shareWhatsApp: false)
 * - Team Member / DMC Staff: Allowed if authorized
 * - Buyer: Follows Buyer Quote Builder access rules
 */
export function canUserShareQuoteWhatsApp(
  user: User | null | undefined,
  _quote?: any
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'You must be signed in to share quotations.' };
  }

  const approvalStatus = user.approvalStatus || 'APPROVED';
  if (approvalStatus === 'PENDING') {
    return { allowed: false, reason: 'Your account is pending verification.' };
  }
  if (approvalStatus === 'REJECTED') {
    return { allowed: false, reason: 'Your account access has been revoked.' };
  }

  // Master Admin & Admin always have full authority
  if (isMasterAdmin(user) || user.role === 'ADMIN') {
    return { allowed: true };
  }

  const perms = user.permissions;

  // If explicitly revoked for this user profile
  if (perms && (perms.shareWhatsApp === false || perms.canShareWhatsAppQuotes === false)) {
    return { allowed: false, reason: 'WhatsApp quotation sharing is disabled for your user account.' };
  }

  // B2B Agent: Allowed if B2B Quote Builder is allowed
  if (user.role === 'B2B_AGENT' || user.role === 'AGENT') {
    const qb = canUserAccessQuoteBuilder(user, 'B2B');
    if (!qb.allowed) {
      return { allowed: false, reason: 'Quotation builder access is required to share quotes.' };
    }
    return { allowed: true };
  }

  // Team Member / DMC Staff: Allowed if authorized
  if (user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
    if (perms?.shareWhatsApp === true) return { allowed: true };
    const qb = canUserAccessQuoteBuilder(user, 'B2B');
    if (qb.allowed && perms?.shareWhatsApp !== false) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'WhatsApp sharing authorization is required for staff accounts.' };
  }

  // Buyer: Allowed if Buyer Quote Builder is allowed
  if (user.role === 'BUYER') {
    const buyerQb = canUserAccessQuoteBuilder(user, 'BUYER');
    if (!buyerQb.allowed) {
      return { allowed: false, reason: 'Quote access required.' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Unauthorized role for quote sharing.' };
}

/**
 * Evaluates whether a user is authorized to access System Analysis.
 * Strict RBAC rules:
 * - Master Admin & Admin: Always full access (view, user analysis, transactions, activity, export)
 * - Authorized Team Member / DMC Staff: View, user journey, and activity analysis allowed (financial transactions & export require explicit permission)
 * - B2B Agents, Direct Buyers, Public: STRICTLY BLOCKED.
 */
export function canUserAccessSystemAnalysis(
  user: User | null | undefined,
  action: 'view' | 'userAnalysis' | 'activityAnalysis' | 'transactionAnalysis' | 'export' = 'view'
): boolean {
  if (!user) return false;
  if (isMasterAdmin(user)) return true;
  if (user.role === 'ADMIN') return true;

  // Strict: external roles can never access system analysis
  if (user.role === 'BUYER' || user.role === 'B2B_AGENT' || user.role === 'AGENT' || user.role === 'VIEWER' || user.role === 'PUBLIC') {
    return false;
  }

  // Must have CMS access
  if (!canUserAccessCMS(user)) return false;

  const perms = user.permissions;
  if (perms?.cmsSystemAnalysis) {
    if (perms.cmsSystemAnalysis.enabled === false) return false;
    if (action === 'view') return perms.cmsSystemAnalysis.view !== false;
    if (action === 'userAnalysis') return perms.cmsSystemAnalysis.userAnalysis !== false;
    if (action === 'activityAnalysis') return perms.cmsSystemAnalysis.activityAnalysis !== false;
    if (action === 'transactionAnalysis') return perms.cmsSystemAnalysis.transactionAnalysis === true;
    if (action === 'export') return perms.cmsSystemAnalysis.export === true;
  }

  // Defaults for internal staff
  if (user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
    if (action === 'view' || action === 'userAnalysis' || action === 'activityAnalysis') {
      return true;
    }
    return false; // transactions and export need explicit grant
  }

  return false;
}

/**
 * Evaluates whether a user has top-level access to Admin CMS
 */
export function canUserAccessCMS(user: User | null | undefined): boolean {
  if (!user) return false;
  if ((user.approvalStatus || 'APPROVED') !== 'APPROVED') return false;
  if (isMasterAdmin(user)) return true;

  if (user.permissions && typeof user.permissions.canAccessCMS === 'boolean') {
    return user.permissions.canAccessCMS;
  }

  return user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF';
}

/**
 * Evaluates access to one of the 5 top-level CMS sections (OVERVIEW, OPERATIONS, CONTENT, FINANCE, SYSTEM)
 */
export function canUserAccessTopSection(
  user: User | null | undefined, 
  sectionId: 'OVERVIEW' | 'OPERATIONS' | 'CONTENT' | 'FINANCE' | 'SYSTEM' | 'SYSTEM_ANALYSIS'
): boolean {
  if (!canUserAccessCMS(user)) return false;
  if (isMasterAdmin(user)) return true;

  const perms = user?.permissions;

  switch (sectionId) {
    case 'OVERVIEW':
      return true; // Any authorized CMS user can view Command Dashboard

    case 'SYSTEM_ANALYSIS':
      return canUserAccessSystemAnalysis(user, 'view');

    case 'OPERATIONS':
      if (perms?.cmsOperations) {
        return perms.cmsOperations.enabled !== false;
      }
      return user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER' || user?.role === 'DMC_STAFF';

    case 'CONTENT':
      if (perms?.cmsContent) {
        return perms.cmsContent.enabled !== false;
      }
      return user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER' || user?.role === 'DMC_STAFF';

    case 'FINANCE':
      if (perms?.cmsFinance) {
        return perms.cmsFinance.enabled !== false;
      }
      return user?.role === 'ADMIN'; // Finance defaults to Admin only

    case 'SYSTEM':
      if (perms?.cmsSystem) {
        return perms.cmsSystem.enabled !== false;
      }
      return user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER' || user?.role === 'DMC_STAFF';

    default:
      return false;
  }
}

/**
 * Hierarchical evaluation for a specific CMS module
 */
export function canUserAccessCMSModule(
  user: User | null | undefined, 
  moduleId: string
): boolean {
  if (!canUserAccessCMS(user)) return false;
  if (isMasterAdmin(user)) return true;

  const perms = user?.permissions;

  switch (moduleId) {
    case 'DASHBOARD':
      return true;

    // Operations modules (blocked if cmsOperations.enabled === false)
    case 'PRODUCT_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'OPERATIONS')) return false;
      return perms?.cmsOperations?.productManagement !== false;

    case 'HOTEL_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'OPERATIONS')) return false;
      return perms?.cmsOperations?.hotelManagement !== false;

    case 'PACKAGE_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'OPERATIONS')) return false;
      return perms?.cmsOperations?.packageManagement !== false;

    case 'BOOKING_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'OPERATIONS')) return false;
      return perms?.cmsOperations?.bookingManagement !== false;

    case 'LEAD_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'OPERATIONS')) return false;
      return perms?.cmsOperations?.leadManagement !== false;

    // Content modules (blocked if cmsContent.enabled === false)
    case 'DESTINATION_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'CONTENT')) return false;
      return perms?.cmsContent?.destinationManagement !== false;

    case 'PAGE_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'CONTENT')) return false;
      return perms?.cmsContent?.pageManagement !== false;

    case 'MARKETING_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'CONTENT')) return false;
      return perms?.cmsContent?.marketingManagement !== false;

    case 'SEO_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'CONTENT')) return false;
      return perms?.cmsContent?.seoContent !== false;

    // Finance modules (blocked if cmsFinance.enabled === false)
    case 'ACCOUNT_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'FINANCE')) return false;
      if (perms?.cmsFinance?.accountManagement !== undefined) {
        return perms.cmsFinance.accountManagement;
      }
      return user?.role === 'ADMIN' || perms?.canManageUsers === true;

    case 'ANALYTICS_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'FINANCE')) return false;
      if (perms?.cmsFinance?.financials !== undefined) {
        return perms.cmsFinance.financials;
      }
      return user?.role === 'ADMIN' || perms?.canAccessFinancials === true;

    case 'CURRENCY_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'FINANCE')) return false;
      if (perms?.cmsFinance?.financials !== undefined) {
        return perms.cmsFinance.financials;
      }
      return user?.role === 'ADMIN' || perms?.canAccessFinancials === true;

    // System modules (blocked if cmsSystem.enabled === false)
    case 'CALENDAR_SLAS':
    case 'NOTIFICATIONS_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'SYSTEM')) return false;
      return perms?.cmsSystem?.calendarSlas !== false;

    case 'INTEGRATIONS_DB':
    case 'DATABASE_MANAGEMENT':
      if (!canUserAccessTopSection(user, 'SYSTEM')) return false;
      if (perms?.cmsSystem?.integrationsHub !== undefined) {
        return perms.cmsSystem.integrationsHub;
      }
      return user?.role === 'ADMIN';

    // System Analysis module
    case 'SYSTEM_ANALYSIS':
      return canUserAccessSystemAnalysis(user, 'view');

    default:
      return true;
  }
}

/**
 * Hierarchical evaluation for a specific CMS sub-tab
 */
export function canUserAccessCMSSubTab(
  user: User | null | undefined, 
  moduleId: string, 
  subTabId: string
): boolean {
  // First evaluate module access
  if (!canUserAccessCMSModule(user, moduleId)) return false;
  if (isMasterAdmin(user)) return true;

  const perms = user?.permissions;

  // Specific granular checks
  if (subTabId === 'SYSTEM_ANALYSIS' || subTabId === 'USER_JOURNEYS' || subTabId === 'EVENT_STREAM' || subTabId === 'FUNNEL_ANALYSIS') {
    return canUserAccessSystemAnalysis(user, 'view');
  }

  if (subTabId === 'PERMISSIONS') {
    if (user?.role !== 'ADMIN' && !perms?.canManagePermissions && !perms?.cmsFinance?.userPermissionManagement) {
      return false;
    }
    return true;
  }

  if (subTabId === 'ROSTER') {
    if (perms?.cmsOperations?.rosterAndRoles === false || perms?.canAccessRoster === false) {
      return false;
    }
  }

  if (subTabId === 'FINANCIALS') {
    if (perms?.cmsFinance?.financials === false || perms?.canAccessFinancials === false) {
      return false;
    }
  }

  if (subTabId === 'AUDIT_TRAIL') {
    if (perms?.cmsSystem?.auditLogs === false) {
      return false;
    }
  }

  if (subTabId === 'FIRESTORE_DIAGNOSTICS') {
    if (perms?.cmsSystem?.databaseDiagnostics === false && user?.role !== 'ADMIN') {
      return false;
    }
  }

  if (subTabId === 'SHEETS_SYNC') {
    if (perms?.cmsSystem?.googleSheetsSync === false && user?.role !== 'ADMIN') {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates whether a user is authorized to view wholesale contracted net rates and internal DMC margins.
 * STRICT GLOBAL RULE: No Buyer or B2B Agent may EVER view wholesale nett rates or internal calculations.
 * Internal pricing details are reserved strictly for Admin and internal DMC Staff.
 */
export function canUserViewWholesaleRates(user: User | null | undefined): boolean {
  if (!user) return false;
  if ((user.approvalStatus || 'APPROVED') !== 'APPROVED') return false;
  if (isMasterAdmin(user)) return true;
  if (user.role === 'ADMIN' || user.role === 'DMC_STAFF') return true;

  // STRICT GLOBAL RULE: Neither B2B Agent nor Buyer may ever see wholesale net rates or margins
  return false;
}

/**
 * Propagates permission updates into the current session cache immediately
 */
export function syncSessionUserPermissions(updatedUser: User): void {
  try {
    const saved = localStorage.getItem('theunbound_auth_user');
    if (saved) {
      const current = JSON.parse(saved);
      if (current && current.id === updatedUser.id) {
        const merged = { ...current, ...updatedUser };
        localStorage.setItem('theunbound_auth_user', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('theunbound_auth_changed', { detail: merged }));
      }
    }
  } catch (e) {
    console.error('Error syncing session permissions:', e);
  }
}
