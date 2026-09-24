import { 
  StructuredVisaRequirement, 
  VisaProduct, 
  BookingVisaChecklistItem,
  RequirementCategory,
  VisaAssistanceService,
  QuoteVisaSnapshot
} from '../types';

/**
 * Filter applicable structured requirements based on applicant nationality,
 * traveller profile/type, and visa classification.
 * (Constitution Sections 8, 9, 10, 11)
 */
export function filterApplicableRequirements(
  requirements: StructuredVisaRequirement[] = [],
  options: {
    nationality?: string;
    travellerType?: string; // 'ADULT' | 'CHILD' | 'INFANT' | 'MINOR' | 'STUDENT' | 'EMPLOYED' | 'SELF_EMPLOYED' | 'RETIRED' | 'SPONSORED' | string;
    visaType?: string;
    isEmployed?: boolean;
    isSelfEmployed?: boolean;
    isSponsored?: boolean;
    hasPreviousPassport?: boolean;
  }
): StructuredVisaRequirement[] {
  if (!requirements || requirements.length === 0) return [];

  const targetNationality = (options.nationality || 'ALL').trim().toLowerCase();
  const targetTravellerType = (options.travellerType || 'ADULT').trim().toUpperCase();
  const targetVisaType = (options.visaType || 'ALL').trim().toLowerCase();

  return requirements
    .filter(req => req.status !== 'ARCHIVED' && req.status !== 'INACTIVE')
    .filter(req => {
      // 1. Nationality filter
      if (req.applicableNationality && req.applicableNationality.length > 0) {
        const natList = req.applicableNationality.map(n => n.toLowerCase().trim());
        if (!natList.includes('all') && targetNationality !== 'all') {
          const match = natList.some(n => 
            targetNationality.includes(n) || n.includes(targetNationality)
          );
          if (!match) return false;
        }
      }

      // 2. Visa Type filter
      if (req.applicableVisaType && req.applicableVisaType !== 'ALL' && targetVisaType !== 'all') {
        const vtLower = req.applicableVisaType.toLowerCase().trim();
        if (!targetVisaType.includes(vtLower) && !vtLower.includes(targetVisaType)) {
          return false;
        }
      }

      // 3. Traveller Type filter
      if (req.applicableTravellerType && req.applicableTravellerType.length > 0) {
        const types = req.applicableTravellerType.map(t => String(t).toUpperCase());
        if (!types.includes('ALL')) {
          if (!types.includes(targetTravellerType)) {
            // Check specific conditional tags
            if (options.isEmployed && types.includes('EMPLOYED')) {
              // keep
            } else if (options.isSelfEmployed && types.includes('SELF_EMPLOYED')) {
              // keep
            } else if (options.isSponsored && types.includes('SPONSORED')) {
              // keep
            } else {
              return false;
            }
          }
        }
      }

      // 4. Conditional rule filter
      if (req.requiredStatus === 'CONDITIONAL' && req.conditionRule) {
        const { conditionType, conditionValue } = req.conditionRule;
        if (conditionType === 'EMPLOYMENT_STATUS') {
          if (conditionValue === 'EMPLOYED' && options.isEmployed === false) return false;
          if (conditionValue === 'SELF_EMPLOYED' && options.isSelfEmployed === false) return false;
        } else if (conditionType === 'SPONSORSHIP') {
          if (conditionValue === 'SPONSORED' && options.isSponsored === false) return false;
        } else if (conditionType === 'PREVIOUS_PASSPORT') {
          if (conditionValue === 'HAS_PREVIOUS' && options.hasPreviousPassport === false) return false;
        }
      }

      return true;
    })
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

/**
 * Calculates dynamic checklist progress for operational users.
 * (Constitution Section 33)
 */
export function calculateChecklistProgress(
  requirements: StructuredVisaRequirement[],
  collectedItems: BookingVisaChecklistItem[] = []
): { completed: number; total: number; percentage: number; isComplete: boolean } {
  const activeRequirements = requirements.filter(r => r.status === 'ACTIVE');
  const total = activeRequirements.length;
  if (total === 0) return { completed: 0, total: 0, percentage: 100, isComplete: true };

  const collectedMap = new Map<string, BookingVisaChecklistItem>();
  collectedItems.forEach(item => {
    collectedMap.set(item.requirementId, item);
  });

  let completed = 0;
  activeRequirements.forEach(req => {
    const item = collectedMap.get(req.id);
    if (item && (item.status === 'ACCEPTED' || item.status === 'RECEIVED')) {
      completed++;
    } else if (item && item.status === 'NOT_APPLICABLE') {
      completed++;
    }
  });

  const percentage = Math.round((completed / total) * 100);
  const isComplete = completed >= total;

  return { completed, total, percentage, isComplete };
}

/**
 * Generates a clean, customer-facing structured checklist grouped by category
 * for Proposals, PDFs, WhatsApp messages, and Client documents.
 * (Constitution Section 35)
 */
export function generateCustomerVisaChecklist(
  visa: VisaProduct,
  nationality?: string,
  travellerType?: string
): { categoryTitle: string; items: { name: string; required: boolean; instructions?: string }[] }[] {
  const reqs = visa.structuredRequirements && visa.structuredRequirements.length > 0
    ? filterApplicableRequirements(visa.structuredRequirements, { nationality, travellerType })
    : (visa.documentsChecklist || []).map((text, i) => ({
        id: `gen-req-${i}`,
        visaId: visa.id,
        name: text,
        category: 'IDENTITY' as RequirementCategory,
        description: text,
        requiredStatus: 'REQUIRED' as const,
        applicableNationality: ['ALL'],
        displayOrder: i + 1,
        status: 'ACTIVE' as const,
        version: 1
      }));

  const categoryOrder: RequirementCategory[] = [
    'IDENTITY',
    'FINANCIAL',
    'TRAVEL',
    'SUPPORTING',
    'APPLICATION',
    'OTHER'
  ];

  const categoryTitles: Record<RequirementCategory, string> = {
    IDENTITY: 'Identity & Passport Credentials',
    FINANCIAL: 'Financial & Income Proof',
    TRAVEL: 'Travel & Accommodation Vouchers',
    SUPPORTING: 'Employment & Supporting Letters',
    APPLICATION: 'Government Forms & Biometric Filings',
    OTHER: 'Consular & Special Documentation'
  };

  const grouped = new Map<RequirementCategory, { name: string; required: boolean; instructions?: string }[]>();

  reqs.forEach(req => {
    const cat = req.category || 'OTHER';
    if (!grouped.has(cat)) grouped.set(cat, []);
    
    let instructions = req.description;
    if (req.documentConditions) {
      const parts: string[] = [];
      if (req.documentConditions.minValidityMonths) parts.push(`Min ${req.documentConditions.minValidityMonths}m validity`);
      if (req.documentConditions.blankPages) parts.push(`${req.documentConditions.blankPages} blank pages`);
      if (req.documentConditions.photoSize) parts.push(`Size ${req.documentConditions.photoSize}`);
      if (req.documentConditions.photoBackground) parts.push(`${req.documentConditions.photoBackground} background`);
      if (req.documentConditions.bankStatementPeriodMonths) parts.push(`Last ${req.documentConditions.bankStatementPeriodMonths} months`);
      if (parts.length > 0) {
        instructions = `${instructions} (${parts.join(', ')})`;
      }
    }

    grouped.get(cat)!.push({
      name: req.name,
      required: req.requiredStatus === 'REQUIRED',
      instructions
    });
  });

  const result: { categoryTitle: string; items: { name: string; required: boolean; instructions?: string }[] }[] = [];
  categoryOrder.forEach(cat => {
    if (grouped.has(cat) && grouped.get(cat)!.length > 0) {
      result.push({
        categoryTitle: categoryTitles[cat] || cat,
        items: grouped.get(cat)!
      });
    }
  });

  return result;
}

/**
 * Creates an immutable Quote Requirement Snapshot when a Visa is quoted.
 * (Constitution Section 29)
 */
export function createQuoteVisaSnapshot(
  visa: VisaProduct,
  options: {
    applicantNationality: string;
    applicantProfile?: string;
    selectedAssistanceIds?: string[];
  }
): QuoteVisaSnapshot {
  const applicableReqs = filterApplicableRequirements(
    visa.structuredRequirements || [],
    { nationality: options.applicantNationality, travellerType: options.applicantProfile }
  );

  const selectedAssistance = (visa.assistanceServices || []).filter(
    asst => options.selectedAssistanceIds?.includes(asst.id)
  );

  const assistanceFee = selectedAssistance.reduce((sum, a) => sum + (a.sellingPrice || 0), 0);
  const embassyFee = visa.embassyFee || 0;
  const serviceFee = visa.serviceFee || 0;
  const totalSellingPrice = embassyFee + serviceFee + assistanceFee;

  return {
    visaId: visa.id,
    visaName: `${visa.country} ${visa.visaType}`,
    destination: visa.country,
    visaType: visa.visaType,
    applicantNationality: options.applicantNationality,
    applicantProfile: options.applicantProfile || 'Standard Adult',
    selectedAssistanceServices: selectedAssistance,
    applicableChecklist: applicableReqs,
    pricing: {
      embassyFee,
      serviceFee,
      assistanceFee,
      totalSellingPrice
    },
    currency: visa.currency || 'USD',
    requirementVersion: visa.requirementVersion || 1,
    capturedAt: new Date().toISOString()
  };
}

/**
 * Generates default structured requirements for standard tourist/business visas.
 */
export function createDefaultRequirementsForVisa(
  visaId: string,
  country: string,
  visaType: string
): StructuredVisaRequirement[] {
  const isJapan = country.toLowerCase().includes('japan');
  const isUK = country.toLowerCase().includes('united kingdom') || country.toLowerCase().includes('uk');
  const isSchengen = country.toLowerCase().includes('schengen') || country.toLowerCase().includes('europe');
  const isUAE = country.toLowerCase().includes('uae') || country.toLowerCase().includes('dubai');
  const isThailand = country.toLowerCase().includes('thailand');

  const base: StructuredVisaRequirement[] = [
    {
      id: `REQ-${visaId}-PPT`,
      visaId,
      name: 'Original Passport',
      category: 'IDENTITY',
      description: 'Must have at least 6 months validity beyond intended travel date with minimum 2 blank pages.',
      requiredStatus: 'REQUIRED',
      applicableNationality: ['ALL'],
      applicableTravellerType: ['ALL'],
      documentConditions: {
        originalRequired: true,
        copyRequired: true,
        minValidityMonths: 6,
        blankPages: 2
      },
      displayOrder: 1,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: `REQ-${visaId}-PHT`,
      visaId,
      name: 'Passport Size Photograph',
      category: 'IDENTITY',
      description: isJapan ? '45mm x 35mm matte finish, white background, 80% face coverage taken within 6 months.' : '35mm x 45mm color photo on crisp white background without headgear.',
      requiredStatus: 'REQUIRED',
      applicableNationality: ['ALL'],
      applicableTravellerType: ['ALL'],
      documentConditions: {
        photoQuantity: 2,
        photoSize: isJapan ? '45mm x 35mm' : '35mm x 45mm',
        photoBackground: 'Pure White'
      },
      displayOrder: 2,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: `REQ-${visaId}-FLT`,
      visaId,
      name: 'Confirmed Roundtrip Flight Itinerary',
      category: 'TRAVEL',
      description: 'Direct PNR verifiable airline ticket showing arrival and departure ports.',
      requiredStatus: 'REQUIRED',
      applicableNationality: ['ALL'],
      applicableTravellerType: ['ALL'],
      displayOrder: 3,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: `REQ-${visaId}-HTL`,
      visaId,
      name: 'DMC Hotel Accommodation Vouchers',
      category: 'TRAVEL',
      description: 'Official day-wise lodging confirmation vouchers issued by TheUnbound.',
      requiredStatus: 'REQUIRED',
      applicableNationality: ['ALL'],
      applicableTravellerType: ['ALL'],
      displayOrder: 4,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: `REQ-${visaId}-BNK`,
      visaId,
      name: 'Bank Account Statements',
      category: 'FINANCIAL',
      description: isUK || isSchengen ? 'Last 6 months active bank statement stamped by bank showing regular cash flows.' : 'Last 3 to 6 months bank statement with sufficient liquid funds.',
      requiredStatus: 'REQUIRED',
      applicableNationality: ['ALL'],
      applicableTravellerType: ['ADULT', 'EMPLOYED', 'SELF_EMPLOYED'],
      documentConditions: {
        bankStatementPeriodMonths: isUK || isSchengen ? 6 : 3,
        attestationRequired: true
      },
      displayOrder: 5,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: `REQ-${visaId}-EMP`,
      visaId,
      name: 'Employment Verification & Leave Sanction Letter',
      category: 'SUPPORTING',
      description: 'Official letter on employer letterhead indicating designation, date of joining, and approved leave period.',
      requiredStatus: 'CONDITIONAL',
      applicableNationality: ['ALL'],
      applicableTravellerType: ['EMPLOYED'],
      conditionRule: {
        conditionType: 'EMPLOYMENT_STATUS',
        conditionValue: 'EMPLOYED',
        description: 'Compulsory for salaried applicants'
      },
      displayOrder: 6,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: `REQ-${visaId}-BIZ`,
      visaId,
      name: 'Business Incorporation & GST Certificate',
      category: 'SUPPORTING',
      description: 'Company registration deed, Memorandum, and official tax filing documents.',
      requiredStatus: 'CONDITIONAL',
      applicableNationality: ['ALL'],
      applicableTravellerType: ['SELF_EMPLOYED'],
      conditionRule: {
        conditionType: 'EMPLOYMENT_STATUS',
        conditionValue: 'SELF_EMPLOYED',
        description: 'Required if applicant is business owner or partner'
      },
      displayOrder: 7,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString()
    }
  ];

  if (isSchengen) {
    base.push({
      id: `REQ-${visaId}-INS`,
      visaId,
      name: 'Schengen Approved Travel Medical Insurance',
      category: 'TRAVEL',
      description: 'Policy covering emergency medical hospitalization and repatriation with minimum coverage of EUR 30,000.',
      requiredStatus: 'REQUIRED',
      applicableNationality: ['ALL'],
      applicableTravellerType: ['ALL'],
      displayOrder: 8,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString()
    });
  }

  if (isUAE) {
    base.push({
      id: `REQ-${visaId}-PAN`,
      visaId,
      name: 'PAN Card / National Identity Scan',
      category: 'IDENTITY',
      description: 'Clear color copy of applicant national identity card.',
      requiredStatus: 'CONDITIONAL',
      applicableNationality: ['Indian', 'IN'],
      applicableTravellerType: ['ALL'],
      displayOrder: 9,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date().toISOString()
    });
  }

  return base;
}

/**
 * Creates default application assistance options for a visa product.
 * (Constitution Section 19)
 */
export function createDefaultAssistanceServices(visaId: string): VisaAssistanceService[] {
  return [
    {
      id: `ASST-${visaId}-VET`,
      visaId,
      name: 'Dossier Verification & Pre-submission Audit',
      serviceType: 'DOCUMENT_VETTING',
      description: 'Comprehensive line-by-line scrutiny of financial proofs, photos, and passport credentials to ensure 0% rejection rate.',
      netCost: 10,
      serviceFee: 15,
      sellingPrice: 25,
      currency: 'USD',
      includedInBaseFee: true,
      status: 'ACTIVE',
      displayOrder: 1
    },
    {
      id: `ASST-${visaId}-FORM`,
      visaId,
      name: 'Official Consular Form Filing Assistance',
      serviceType: 'FORM_FILLING',
      description: 'Complete digital filing on official government portals with multi-lingual assistance.',
      netCost: 8,
      serviceFee: 12,
      sellingPrice: 20,
      currency: 'USD',
      includedInBaseFee: false,
      status: 'ACTIVE',
      displayOrder: 2
    },
    {
      id: `ASST-${visaId}-APPT`,
      visaId,
      name: 'Priority Embassy / VFS Appointment Slot Booking',
      serviceType: 'APPOINTMENT_BOOKING',
      description: 'Automated monitoring and fast-track appointment scheduling at nearest biometric center.',
      netCost: 15,
      serviceFee: 20,
      sellingPrice: 35,
      currency: 'USD',
      includedInBaseFee: false,
      status: 'ACTIVE',
      displayOrder: 3
    },
    {
      id: `ASST-${visaId}-BIO`,
      visaId,
      name: 'VIP Biometric Center Concierge Escort',
      serviceType: 'BIOMETRIC_CONCIERGE',
      description: 'Dedicated airport/consular representative at the center to assist with document queueing.',
      netCost: 20,
      serviceFee: 25,
      sellingPrice: 45,
      currency: 'USD',
      includedInBaseFee: false,
      status: 'ACTIVE',
      displayOrder: 4
    }
  ];
}
