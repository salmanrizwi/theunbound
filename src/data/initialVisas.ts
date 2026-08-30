import { VisaProduct } from '../types';

export const INITIAL_VISAS: VisaProduct[] = [
  {
    id: 'visa-jp-tourist',
    country: 'Japan',
    countryCode: 'JP',
    destinationId: 'dest-japan',
    visaType: 'Tourist E-Visa (Single Entry)',
    entryType: 'SINGLE_ENTRY',
    validityDays: 90,
    stayDurationDays: 15,
    processingTimeDays: 5,
    expressProcessingAvailable: true,
    expressProcessingTimeDays: 2,
    embassyFee: 30,
    serviceFee: 25,
    expressServiceFee: 50,
    currency: 'USD',
    description: 'Official electronic tourist visa for international leisure travelers visiting Japan. 100% online document submission with dedicated DMC verification.',
    documentsChecklist: [
      'Original Passport valid for at least 6 months with 2 blank pages',
      'Passport size photograph (45mm x 35mm, white background, taken within 6 months)',
      'Confirmed return flight tickets with PNR',
      'Day-wise tour itinerary and hotel confirmation vouchers',
      'Last 6 months updated bank statement with minimum balance equivalent to USD 3,000',
      'Income Tax Returns (ITR-V) of the last 2 consecutive financial years',
      'Employment verification letter or business registration certificate'
    ],
    submissionSteps: [
      'Submit traveler details & upload scanned documents for DMC pre-scrutiny',
      'Our visa specialists verify and format your application within 4 working hours',
      'Application lodged directly with Japanese Consulate / E-Visa portal',
      'Receive official E-Visa PDF directly in your agent portal & registered email'
    ],
    eligibilityNotes: [
      'Applicable for leisure tourism and transit purposes only',
      'Travelers must arrive within the 90-day validity window',
      'No employment or commercial engagements permitted under tourist visa'
    ],
    downloadableForms: [
      {
        id: 'form-jp-01',
        name: 'Japan Official Visa Application Form.pdf',
        url: '#',
        fileSize: '420 KB'
      },
      {
        id: 'form-jp-02',
        name: 'Japan Itinerary & Schedule of Stay Template.pdf',
        url: '#',
        fileSize: '280 KB'
      }
    ],
    faqs: [
      {
        question: 'When should I apply for the Japan tourist visa before travel?',
        answer: 'We recommend applying 30 to 45 days prior to your intended departure date to allow adequate processing and document verification time.'
      },
      {
        question: 'Can TheUnbound provide ground vouchers for visa submission?',
        answer: 'Yes! All confirmed bookings and custom proposals booked through TheUnbound include official DMC itinerary vouchers and hotel confirmations suitable for embassy lodging.'
      }
    ],
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
    status: 'ACTIVE',
    featured: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'visa-uk-standard',
    country: 'United Kingdom',
    countryCode: 'GB',
    destinationId: 'dest-uk',
    visaType: 'Standard Visitor Visa (6 Months Multi-Entry)',
    entryType: 'MULTIPLE_ENTRY',
    validityDays: 180,
    stayDurationDays: 180,
    processingTimeDays: 15,
    expressProcessingAvailable: true,
    expressProcessingTimeDays: 5,
    embassyFee: 145,
    serviceFee: 40,
    expressServiceFee: 120,
    currency: 'USD',
    description: 'UK Standard Visitor Visa for tourism, family visits, business meetings, and short-term study across England, Scotland, Wales, and Northern Ireland.',
    documentsChecklist: [
      'Current passport and all prior travel passports',
      'Biometric enrollment appointment at nearest VFS / TLScontact center',
      '6 months bank statements showing regular income and sufficient liquid funds',
      'Proof of employment, leave sanction letter, and payslips for last 3 months',
      'Accommodation bookings and comprehensive travel schedule across UK hubs',
      'Cover letter detailing purpose of visit and ties to home country'
    ],
    submissionSteps: [
      'Fill comprehensive online questionnaire in TheUnbound Visa module',
      'DMC visa desk audits supporting financial records and draft itinerary',
      'Online UKVI submission and booking of biometric appointment slot',
      'Attend biometric center; track passport dispatch via portal'
    ],
    eligibilityNotes: [
      'Valid for multiple entries up to 180 days within the 6-month validity',
      'Must demonstrate intention to leave the UK at the end of the visit'
    ],
    downloadableForms: [
      {
        id: 'form-uk-01',
        name: 'UK Visa Document Checklist & Cover Letter Format.pdf',
        url: '#',
        fileSize: '350 KB'
      }
    ],
    faqs: [
      {
        question: 'Is biometric appointment mandatory for UK visa?',
        answer: 'Yes, all applicants must attend a VFS/TLScontact center in person for digital fingerprints and photo capture.'
      }
    ],
    heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop',
    status: 'ACTIVE',
    featured: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'visa-schengen-tourist',
    country: 'Europe (Schengen)',
    countryCode: 'EU',
    destinationId: 'dest-europe',
    visaType: 'Schengen Short-Stay C-Type Visa',
    entryType: 'MULTIPLE_ENTRY',
    validityDays: 90,
    stayDurationDays: 90,
    processingTimeDays: 15,
    expressProcessingAvailable: false,
    embassyFee: 90,
    serviceFee: 35,
    currency: 'USD',
    description: 'Travel seamlessly across 29 European countries with a single unified Schengen visa for tourism, cultural tours, and VIP leisure itineraries.',
    documentsChecklist: [
      'Valid passport with at least 3 months validity beyond intended departure from Schengen area',
      'Schengen Travel Medical Insurance with minimum coverage of EUR 30,000',
      'Roundtrip flight reservations and inter-European train / flight tickets',
      'Hotel vouchers for entire stay in all visited Schengen member states',
      'Last 3 years tax returns and last 6 months bank statement attested by bank',
      'Leave letter from employer on company letterhead'
    ],
    submissionSteps: [
      'Determine main destination country based on duration of stay',
      'Upload documents for expert DMC compliance check',
      'Secure consular appointment and submit biometrics',
      'Collect passport with Schengen visa sticker'
    ],
    eligibilityNotes: [
      'Maximum 90 days stay in any 180-day rolling period',
      'Application must be submitted to the country of main stay or first entry'
    ],
    downloadableForms: [
      {
        id: 'form-eu-01',
        name: 'Harmonised Schengen Visa Application Form.pdf',
        url: '#',
        fileSize: '510 KB'
      }
    ],
    faqs: [
      {
        question: 'Which embassy should I apply to if visiting multiple countries?',
        answer: 'You must apply to the embassy of the country where you will spend the longest duration. If equal days, apply to your first point of entry.'
      }
    ],
    heroImage: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=1200&auto=format&fit=crop',
    status: 'ACTIVE',
    featured: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'visa-thailand-evisa',
    country: 'Thailand',
    countryCode: 'TH',
    destinationId: 'dest-thailand',
    visaType: 'Tourist E-Visa (Single Entry)',
    entryType: 'SINGLE_ENTRY',
    validityDays: 90,
    stayDurationDays: 60,
    processingTimeDays: 3,
    expressProcessingAvailable: true,
    expressProcessingTimeDays: 1,
    embassyFee: 40,
    serviceFee: 20,
    expressServiceFee: 45,
    currency: 'USD',
    description: 'Fast-track electronic tourist visa for Thailand vacations, island hopping, and luxury private beach retreats.',
    documentsChecklist: [
      'Passport bio page copy with 6+ months validity',
      'Recent digital passport photograph (white background)',
      'Confirmed flight tickets in and out of Thailand',
      'Hotel or resort booking vouchers',
      'Financial proof showing at least USD 700 per person or USD 1,400 per family'
    ],
    submissionSteps: [
      'Complete online form in 3 minutes',
      'DMC desk verifies file quality and lodges on Thai E-Visa portal',
      'Approval received via email within 1-3 business days'
    ],
    eligibilityNotes: [
      'Single entry tourist visa valid for 60 days stay from arrival date'
    ],
    downloadableForms: [],
    faqs: [
      {
        question: 'Can this tourist visa be extended in Thailand?',
        answer: 'Yes, a 60-day tourist visa can typically be extended for an additional 30 days at local Thai immigration offices.'
      }
    ],
    heroImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=1200&auto=format&fit=crop',
    status: 'ACTIVE',
    featured: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 'visa-uae-tourist',
    country: 'UAE (Dubai & Abu Dhabi)',
    countryCode: 'AE',
    destinationId: 'dest-dubai',
    visaType: 'Dubai 30 Days Tourist E-Visa',
    entryType: 'SINGLE_ENTRY',
    validityDays: 60,
    stayDurationDays: 30,
    processingTimeDays: 2,
    expressProcessingAvailable: true,
    expressProcessingTimeDays: 1,
    embassyFee: 95,
    serviceFee: 25,
    expressServiceFee: 60,
    currency: 'USD',
    description: 'Instant electronic entry permit for Dubai and Abu Dhabi leisure visits, shopping festivals, and luxury desert stays.',
    documentsChecklist: [
      'Clear color copy of Passport bio-page and last page (valid 6+ months)',
      'Passport size color photo with white background',
      'Confirmed return flight tickets',
      'PAN card copy (for Indian nationals)'
    ],
    submissionSteps: [
      'Upload passport copy and photo',
      'Instant automated pre-validation',
      'Direct GDRFA/ICP submission with 24-hour express turnaround'
    ],
    eligibilityNotes: [
      'Valid for 30 days stay from arrival'
    ],
    downloadableForms: [],
    faqs: [],
    heroImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200&auto=format&fit=crop',
    status: 'ACTIVE',
    featured: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  }
];
