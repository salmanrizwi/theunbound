import { 
  User, 
  UserRole, 
  UserPermissionAccess, 
  CMSOperationsPermissions, 
  CMSContentPermissions, 
  CMSFinancePermissions, 
  CMSSystemPermissions,
  SupplierPermissions,
  BookingOperationsPermissions
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
        },
        suppliers: {
          view: true,
          create: true,
          edit: true,
          archive: true,
          restore: true,
          manage_contacts: true,
          manage_services: true,
          view_financial_details: true,
          manage_financial_details: true,
          view_activity_history: true
        },
        bookingOperations: {
          view: true,
          create_manual: true,
          edit: true,
          manage_service_items: true,
          allocate_supplier: true,
          view_supplier_prices: true,
          manage_supplier_prices: true,
          confirm_service_items: true,
          generate_vouchers: true,
          upload_invoices: true,
          view_internal_financials: true,
          override_confirmation: true,
          manage_supplier_records: true
        }
      };

    case 'TEAM_MEMBER':
    case 'DMC_STAFF':
      return {
        b2bQuoteBuilderAccess: true,
        buyerQuoteBuilderAccess: true,
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
        },
        suppliers: {
          view: true,
          create: true,
          edit: true,
          archive: false,
          restore: false,
          manage_contacts: true,
          manage_services: true,
          view_financial_details: false,
          manage_financial_details: false,
          view_activity_history: true
        },
        bookingOperations: {
          view: true,
          create_manual: true,
          edit: true,
          manage_service_items: true,
          allocate_supplier: true,
          view_supplier_prices: true,
          manage_supplier_prices: true,
          confirm_service_items: true,
          generate_vouchers: true,
          upload_invoices: true,
          view_internal_financials: false,
          override_confirmation: false,
          manage_supplier_records: true
        }
      };

    case 'B2B_AGENT':
    case 'AGENT':
      return {
        b2bQuoteBuilderAccess: true,
        buyerQuoteBuilderAccess: false,
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
        cmsSystemAnalysis: { enabled: false, view: false, userAnalysis: false, activityAnalysis: false, transactionAnalysis: false, export: false },
        suppliers: {
          view: false,
          create: false,
          edit: false,
          archive: false,
          restore: false,
          manage_contacts: false,
          manage_services: false,
          view_financial_details: false,
          manage_financial_details: false,
          view_activity_history: false
        }
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
        cmsSystemAnalysis: { enabled: false, view: false, userAnalysis: false, activityAnalysis: false, transactionAnalysis: false, export: false },
        suppliers: {
          view: false,
          create: false,
          edit: false,
          archive: false,
          restore: false,
          manage_contacts: false,
          manage_services: false,
          view_financial_details: false,
          manage_financial_details: false,
          view_activity_history: false
        }
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
 * Evaluates whether a user is an authenticated, active, approved, and authorised B2B Agent (or Admin/DMC Staff)
 * eligible to access wholesale travel inventory (products, hotels, packages, visas, pricing, rates).
 * 
 * STRICT ACCESS CONTROL POLICY:
 * Public visitors, unauthenticated users, Buyers, pending registrations, and rejected/suspended
 * accounts MUST NEVER be granted access to B2B inventory data.
 */
export function canUserAccessB2BInventory(
  user: User | null | undefined
): { allowed: boolean; reason?: 'LOGGED_OUT' | 'NOT_B2B_AGENT' | 'APPROVAL_PENDING' | 'REJECTED' | 'PERMISSION_DENIED'; message?: string } {
  if (!user) {
    return {
      allowed: false,
      reason: 'LOGGED_OUT',
      message: 'Authentication required. Only verified B2B travel partners can access inventory.'
    };
  }

  // Master Admin & Administrators always have full operational inventory access
  if (isMasterAdmin(user) || user.role === 'ADMIN') {
    return { allowed: true };
  }

  // Internal Operations & Reservations staff
  if (user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
    const approval = user.approvalStatus || 'APPROVED';
    if (approval !== 'APPROVED') {
      return {
        allowed: false,
        reason: 'APPROVAL_PENDING',
        message: 'Internal staff account verification is pending.'
      };
    }
    return { allowed: true };
  }

  // Verified B2B Travel Agent
  const isAgent = user.role === 'B2B_AGENT' || user.role === 'AGENT';
  if (!isAgent) {
    return {
      allowed: false,
      reason: 'NOT_B2B_AGENT',
      message: 'Access restricted. Wholesale inventory is accessible exclusively to registered B2B travel partners.'
    };
  }

  // Check account verification status
  const approvalStatus = user.approvalStatus || 'APPROVED';
  if (approvalStatus === 'PENDING') {
    return {
      allowed: false,
      reason: 'APPROVAL_PENDING',
      message: 'Your agency account registration is pending Admin verification.'
    };
  }

  if (approvalStatus === 'REJECTED') {
    return {
      allowed: false,
      reason: 'REJECTED',
      message: 'Your agency account access has been suspended or revoked.'
    };
  }

  // Check explicit permission denial if present
  if (user.permissions && user.permissions.b2bQuoteBuilderAccess === false && user.permissions.canAccessPricingCalculator === false) {
    return {
      allowed: false,
      reason: 'PERMISSION_DENIED',
      message: 'Inventory and pricing access has been disabled for your account.'
    };
  }

  return { allowed: true };
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
      return true; // Any authorized CMS user can view Quick Action Launchpad

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

  if (subTabId === 'SUPPLIERS') {
    return hasSupplierPermission(user, 'view');
  }

  return true;
}

/**
 * Evaluates whether a user has a specific granular Supplier Management permission.
 * Strictly internal-only: Admin and internal Team Members/DMC Staff.
 * External buyers and B2B agents are ALWAYS denied.
 */
export function hasSupplierPermission(
  user: User | null | undefined, 
  permission: keyof SupplierPermissions
): boolean {
  if (!user) return false;
  if ((user.approvalStatus || 'APPROVED') !== 'APPROVED') return false;
  if (isMasterAdmin(user)) return true;
  if (user.role === 'ADMIN') return true;

  // External users strictly have NO access
  if (
    user.role === 'BUYER' || 
    user.role === 'B2B_AGENT' || 
    (user as any).role === 'AGENT' ||
    user.userType === 'BUYER' || 
    user.userType === 'B2B_AGENT'
  ) {
    return false;
  }

  // Internal users (TEAM_MEMBER, DMC_STAFF)
  if (user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF' || user.userType === 'TEAM_MEMBER') {
    const perm = user.permissions?.suppliers?.[permission];
    if (perm !== undefined) return Boolean(perm);

    // Fallbacks for standard internal staff if not explicitly configured
    if (
      permission === 'view' || 
      permission === 'create' || 
      permission === 'edit' || 
      permission === 'manage_contacts' || 
      permission === 'manage_services' || 
      permission === 'view_activity_history'
    ) {
      return true;
    }
    // Financial details, archive, restore require explicit permission
    return false;
  }

  return false;
}

/**
 * Evaluates whether a user has a specific granular Booking Operations permission.
 * Handles both plain key format (e.g. 'allocate_supplier') and prefixed format (e.g. 'booking_operations.allocate_supplier').
 * Strictly internal-only: Master Admin, Admin, and authorized internal Team Members / DMC Staff.
 * External buyers and B2B agents are ALWAYS denied.
 */
export function hasBookingOperationsPermission(
  user: User | null | undefined,
  permission: keyof BookingOperationsPermissions | string
): boolean {
  if (!user) return false;
  if ((user.approvalStatus || 'APPROVED') !== 'APPROVED') return false;
  if (isMasterAdmin(user)) return true;
  if (user.role === 'ADMIN') return true;

  // External users strictly have NO access to operational supplier allocation or costs
  if (
    user.role === 'BUYER' ||
    user.role === 'B2B_AGENT' ||
    (user as any).role === 'AGENT' ||
    user.userType === 'BUYER' ||
    user.userType === 'B2B_AGENT' ||
    user.role === 'VIEWER' ||
    user.role === 'PUBLIC'
  ) {
    return false;
  }

  // Normalize prefix if present: "booking_operations.allocate_supplier" -> "allocate_supplier"
  const cleanKey = permission.replace(/^booking_operations\./, '') as keyof BookingOperationsPermissions;

  // Internal users (TEAM_MEMBER, DMC_STAFF)
  if (user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF' || user.userType === 'TEAM_MEMBER') {
    const opsPerms = user.permissions?.bookingOperations;
    if (opsPerms && (cleanKey in opsPerms)) {
      return Boolean(opsPerms[cleanKey]);
    }

    // Default internal permissions if not explicitly configured or restricted
    if (
      cleanKey === 'view' ||
      cleanKey === 'create_manual' ||
      cleanKey === 'edit' ||
      cleanKey === 'manage_service_items' ||
      cleanKey === 'allocate_supplier' ||
      cleanKey === 'view_supplier_prices' ||
      cleanKey === 'manage_supplier_prices' ||
      cleanKey === 'confirm_service_items' ||
      cleanKey === 'generate_vouchers' ||
      cleanKey === 'upload_invoices' ||
      cleanKey === 'manage_supplier_records'
    ) {
      return true;
    }
    return false;
  }

  return false;
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

// ---------------------------------------------------------------------------
// AUTHORITATIVE B2B AGENT RESTRICTIONS & PERMISSION CONTRACTS
// ---------------------------------------------------------------------------

export const B2B_AGENT_ALLOWED_MODULES = [
  'booking_overview',
  'passengers_docs'
] as const;

export const B2B_AGENT_RESTRICTED_MODULES = [
  'service_items_and_supplier_allocation',
  'supplier_management',
  'supplier_directory',
  'supplier_search',
  'supplier_filters',
  'supplier_commercial_pricing',
  'buying_cost',
  'nett_cost',
  'markup_and_margin',
  'profit',
  'internal_pricing',
  'internal_notes_and_updates',
  'internal_dispatch_desk',
  'operational_horizon_and_ground_dispatch_desk',
  'supplier_confirmation',
  'supplier_invoice_management',
  'internal_voucher_management',
  'internal_audit',
  'internal_booking_editing',
  'internal_allocation_controls',
  'internal_payment_ledger',
  'internal_commercial_documents'
] as const;

export const SUBMISSION_LOCKED_FIELDS = [
  'customerName',
  'customerContact',
  'travelDates',
  'destination',
  'hub',
  'passengerCount',
  'passengerNames',
  'selectedServices',
  'hotelDetails',
  'transferDetails',
  'activityDetails',
  'tourDetails',
  'dailyTourDetails',
  'bookingNotes',
  'sellingPrice',
  'paymentTerms',
  'bookingStatus',
  'serviceDates',
  'serviceTimes',
  'supplierInformation',
  'internalOperationalFields',
  'commercialFields'
] as const;

/**
 * Evaluates whether a user is an external user (B2B Agent or Buyer)
 */
export function isExternalUser(user: User | null | undefined): boolean {
  if (!user) return true;
  const role = user.role;
  return role === 'B2B_AGENT' || role === 'AGENT' || role === 'BUYER' || role === 'VIEWER' || role === 'PUBLIC';
}

/**
 * Checks if a user is internal staff (Admin, Team Member, DMC Staff)
 */
export function isInternalStaff(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isMasterAdmin(user)) return true;
  return user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF';
}

/**
 * Validates whether a user can access a specific section of Booking Operations Desk
 * External B2B Agents can ONLY access OVERVIEW and PASSENGERS
 */
export function canAccessBookingDeskSection(
  user: User | null | undefined, 
  section: string
): boolean {
  if (!user) return false;
  
  if (isExternalUser(user)) {
    return section === 'OVERVIEW' || section === 'PASSENGERS';
  }

  // Internal staff can access all tabs based on booking operations permission
  return true;
}

/**
 * Evaluates whether a booking can be edited after submission.
 * Enforces: canEdit(bookings, submitted_booking, b2b_agent) = false
 */
export function canEditSubmittedBooking(
  user: User | null | undefined, 
  booking: any
): boolean {
  if (!user) return false;
  if (isMasterAdmin(user) || user.role === 'ADMIN') return true;

  // If internal staff, check booking editing permission
  if (isInternalStaff(user)) {
    return hasBookingOperationsPermission(user, 'edit');
  }

  // B2B Agent & Buyer: Strictly locked once submitted or not in DRAFT
  if (isExternalUser(user)) {
    // If the booking is already created/submitted, it is immutable
    const status = booking?.status;
    if (!status || status === 'DRAFT') {
      return true; // only pre-submission draft
    }
    return false;
  }

  return false;
}

/**
 * Checks if passenger identity details can be changed after submission
 */
export function canEditPassengerDetails(
  user: User | null | undefined, 
  booking: any
): boolean {
  if (!user) return false;
  if (isMasterAdmin(user) || user.role === 'ADMIN') return true;
  if (isInternalStaff(user)) {
    return hasBookingOperationsPermission(user, 'edit');
  }
  // B2B Agent: No, unless separately approved
  return false;
}

/**
 * Checks if passenger compliance documents (Passport, PAN) can be uploaded or replaced
 */
export function canUploadPassengerDocuments(
  user: User | null | undefined, 
  booking: any
): boolean {
  if (!user) return false;
  // B2B Agent and internal staff are permitted to upload and replace passenger compliance docs
  return true;
}

/**
 * Checks field-level visibility for booking data
 */
export function canViewBookingField(
  user: User | null | undefined, 
  fieldName: string
): boolean {
  const sensitiveFields = [
    'supplierId',
    'supplierName',
    'supplierContact',
    'supplierPrice',
    'supplierTotalCost',
    'supplierConfirmationRef',
    'supplierConfirmationStatus',
    'supplierInvoice',
    'supplierAllocation',
    'allocatedItems',
    'confirmedItems',
    'unitNetPrice',
    'costPrice',
    'netCost',
    'totalNetCost',
    'grossProfit',
    'grossMarginPercent',
    'internalNettCost',
    'internalProfit',
    'markup',
    'margin',
    'internalNotes',
    'internalNotesList',
    'internalTasks',
    'internalAudit',
    'auditLog',
    'deskHandler',
    'groundDispatch',
    'dispatchDesk'
  ];

  if (sensitiveFields.includes(fieldName)) {
    return isInternalStaff(user);
  }

  return true;
}

/**
 * B2B Agent Sanitized Booking DTO
 * Strictly eliminates all supplier identities, supplier confirmation refs, buying prices,
 * internal markups, internal audit logs, internal dispatch desks, and internal notes.
 */
export interface B2BAgentBookingDTO {
  id: string;
  bookingReference: string;
  status: string;
  customerFacingStatus: string;
  createdAt: string;
  updatedAt?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  destinationName?: string;
  hub?: string;
  currency: string;
  totalSellingPrice: number;
  paymentStatus: string;
  documentStatus: string;
  isSubmitted: boolean;
  isReadOnly: boolean;
  submissionLockMessage: string;
  customer: {
    leadTravelerName?: string;
    email?: string;
    phone?: string;
    agencyName?: string;
    agentRefNumber?: string;
    totalAdults?: number;
    totalChildren?: number;
    totalInfants?: number;
    specialRequests?: string;
    flightDetails?: string;
    pickupLocation?: string;
  };
  passengers: Array<{
    id: string;
    passengerNumber: number;
    isLeadPax?: boolean;
    leadPassenger?: boolean;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    type?: string;
    paxType?: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    passportNumber?: string;
    passportExpiryDate?: string;
    passportExpiry?: string;
    passportFrontUrl?: string;
    passportFrontName?: string;
    passportBackUrl?: string;
    passportBackName?: string;
    panNumber?: string;
    panCardUrl?: string;
    panCardName?: string;
    verificationStatus?: string;
    documentVerificationStatus?: string;
    mealPreference?: string;
  }>;
  items: Array<{
    id: string;
    productId?: string;
    productName: string;
    category?: string;
    destinationName?: string;
    city?: string;
    travelDate?: string;
    serviceDate?: string;
    serviceTime?: string;
    totalPax: number;
    adults: number;
    children?: number;
    infants?: number;
    unitSellingPrice?: number;
    totalPrice: number;
    currency: string;
    status?: string;
    customerNotes?: string;
  }>;
  customerNotes?: string[];
  customerTimeline?: Array<{
    id: string;
    title: string;
    timestamp: string;
    type: string;
    description?: string;
  }>;
}

/**
 * Transforms an internal Booking object into a safe, hermetic B2BAgentBookingDTO
 */
export function toB2BAgentBookingDTO(booking: any): B2BAgentBookingDTO {
  const isSubmitted = booking.status !== 'DRAFT';
  
  // Format customer-facing service items with ZERO supplier/cost data
  const sanitizedItems = (booking.items || []).map((it: any) => ({
    id: it.id,
    productId: it.productId,
    productName: it.productName || 'Ground Service Item',
    category: it.category || 'SERVICE',
    destinationName: it.destinationName || booking.destinationName || '',
    city: it.city || '',
    travelDate: it.travelDate || it.serviceDate || booking.travelStartDate || '',
    serviceDate: it.serviceDate || it.travelDate || booking.travelStartDate || '',
    serviceTime: it.serviceTime || '',
    totalPax: it.totalPax || it.adults || 1,
    adults: it.adults || 1,
    children: it.children || 0,
    infants: it.infants || 0,
    unitSellingPrice: it.unitSellingPrice || (it.totalPrice && it.totalPax ? Math.round(it.totalPrice / it.totalPax) : it.totalPrice),
    totalPrice: it.totalPrice || 0,
    currency: it.currency || booking.currency || 'USD',
    status: it.status || 'CONFIRMED',
    customerNotes: it.customerNotes || ''
  }));

  // Format passengers with document verification status
  const sanitizedPassengers = (booking.passengers || []).map((p: any, idx: number) => ({
    id: p.id || `pax-${idx + 1}`,
    passengerNumber: p.passengerNumber || (idx + 1),
    isLeadPax: Boolean(p.isLeadPax || p.leadPassenger || idx === 0),
    leadPassenger: Boolean(p.isLeadPax || p.leadPassenger || idx === 0),
    firstName: p.firstName || '',
    lastName: p.lastName || '',
    fullName: p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Passenger',
    type: p.type || p.paxType || 'ADULT',
    paxType: p.paxType || p.type || 'ADULT',
    dateOfBirth: p.dateOfBirth || '',
    gender: p.gender || '',
    nationality: p.nationality || '',
    passportNumber: p.passportNumber || '',
    passportExpiryDate: p.passportExpiryDate || p.passportExpiry || '',
    passportExpiry: p.passportExpiry || p.passportExpiryDate || '',
    passportFrontUrl: p.passportFrontUrl || '',
    passportFrontName: p.passportFrontName || '',
    passportBackUrl: p.passportBackUrl || '',
    passportBackName: p.passportBackName || '',
    panNumber: p.panNumber || '',
    panCardUrl: p.panCardUrl || '',
    panCardName: p.panCardName || '',
    verificationStatus: p.verificationStatus || (p.passportFrontUrl ? 'VERIFIED' : 'PENDING'),
    documentVerificationStatus: p.documentVerificationStatus || (p.passportFrontUrl ? 'VERIFIED' : 'PENDING'),
    mealPreference: p.mealPreference || ''
  }));

  // Customer facing notes only
  const customerNotes = Array.isArray(booking.customerNotes) 
    ? booking.customerNotes 
    : booking.customerNotes ? [booking.customerNotes] : [];

  // Filter timeline entries to only customer-facing ones
  const customerTimeline = (booking.auditLog || booking.timeline || [])
    .filter((e: any) => !e.internalOnly && !e.isInternal && e.type !== 'SUPPLIER_ACTION' && e.type !== 'INTERNAL_NOTE')
    .map((e: any) => ({
      id: e.id || `tl-${Math.random()}`,
      title: e.title || e.action || 'Booking Update',
      timestamp: e.timestamp || e.createdAt || new Date().toISOString(),
      type: e.type || 'STATUS_CHANGE',
      description: e.description || e.message || ''
    }));

  return {
    id: booking.id,
    bookingReference: booking.bookingReference,
    status: booking.status,
    customerFacingStatus: booking.status,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    travelStartDate: booking.travelStartDate,
    travelEndDate: booking.travelEndDate,
    destinationName: booking.destinationName || (booking.items?.[0]?.destinationName) || '',
    hub: booking.hub || (booking.items?.[0]?.city) || '',
    currency: booking.currency || 'USD',
    totalSellingPrice: booking.totalAmount || booking.finalSellingPrice || booking.sellingPrice || 0,
    paymentStatus: booking.paymentStatus || 'UNPAID',
    documentStatus: booking.documentStatus || 'DOCUMENTS_PENDING',
    isSubmitted,
    isReadOnly: isSubmitted,
    submissionLockMessage: 'This booking has been submitted and is now read-only. Please contact the internal team if a correction is required.',
    customer: {
      leadTravelerName: booking.customer?.leadTravelerName || booking.leadPassengerName || 'Guest',
      email: booking.customer?.email || booking.leadPassengerEmail || '',
      phone: booking.customer?.phone || booking.leadPassengerPhone || '',
      agencyName: booking.customer?.agencyName || booking.agencyName || '',
      agentRefNumber: booking.customer?.agentRefNumber || booking.agentRefNumber || '',
      totalAdults: booking.customer?.totalAdults || (booking.passengers?.filter((p: any) => p.type !== 'CHILD' && p.type !== 'INFANT').length) || 1,
      totalChildren: booking.customer?.totalChildren || (booking.passengers?.filter((p: any) => p.type === 'CHILD').length) || 0,
      totalInfants: booking.customer?.totalInfants || (booking.passengers?.filter((p: any) => p.type === 'INFANT').length) || 0,
      specialRequests: booking.customer?.specialRequests || '',
      flightDetails: booking.customer?.flightDetails || '',
      pickupLocation: booking.customer?.pickupLocation || ''
    },
    passengers: sanitizedPassengers,
    items: sanitizedItems,
    customerNotes,
    customerTimeline
  };
}

/**
 * Sanitizes a booking based on the requesting user's role
 */
export function sanitizeBookingForUser(
  booking: any, 
  user: User | null | undefined
): any {
  if (!booking) return null;
  if (isExternalUser(user)) {
    return toB2BAgentBookingDTO(booking);
  }
  return booking;
}
