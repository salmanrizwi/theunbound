import { Quotation } from '../types';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel,
  validateQuotePresentationCompleteness
} from '../services/quotePresentationModel';
import {
  generateWhatsAppQuoteMessage,
  generateWhatsAppShareUrl
} from '../services/quoteWhatsAppService';
import { EmailNotificationService } from '../services/emailNotificationService';

export function runQuoteCommunicationChannelParityAudit(): {
  passed: boolean;
  totalChecks: number;
  passedChecks: number;
  failures: string[];
} {
  const failures: string[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  const check = (condition: boolean, message: string) => {
    totalChecks++;
    if (condition) {
      passedChecks++;
    } else {
      failures.push(message);
    }
  };

  const sampleQuote: Quotation = {
    id: 'QTE-PARITY-9001',
    quoteNumber: 'QTE-2026-9001',
    version: 2,
    status: 'SENT',
    title: 'Japan Imperial Golden Route Bespoke Proposal',
    destination: 'Japan',
    currency: 'JPY',
    totalNetCost: 420000,
    totalSellingPrice: 540000,
    totalMargin: 120000,
    totalTaxes: 0,
    overallMarkupPercent: 15,
    overallDiscountPercent: 0,
    clientName: 'Arjun & Meera Kapoor',
    clientEmail: 'arjun.kapoor@example.com',
    clientPhone: '+91 98116 54959',
    clientCompany: 'Kapoor Family Office',
    agentId: 'usr-agent-01',
    agentName: 'Rohan Sharma',
    agentAgency: 'Wanderlust Luxury Bespoke',
    agentEmail: 'rohan@wanderlustluxury.in',
    agentPhone: '+91-9811654959',
    agentNotes: 'VIP honeymoon arrangements with private English-speaking chauffeur.',
    termsAndConditions: 'Valid for 14 days. 30% deposit confirms all luxury stays and Shinkansen Green Car seats.',
    travelStartDate: '2026-11-10',
    travelEndDate: '2026-11-12',
    totalPax: 2,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    nationality: 'Indian',
    travelStyle: 'Private Luxury FIT',
    createdAt: '2026-10-07T10:00:00Z',
    updatedAt: '2026-10-07T10:00:00Z',
    validUntil: '2026-10-21T10:00:00Z',
    routeHubs: [
      {
        id: 'hub-tokyo',
        hubId: 'tokyo',
        hubName: 'Tokyo',
        destinationId: 'dest-japan',
        nights: 1,
        order: 1,
        manualHotel: {
          hotelName: 'The Capitol Hotel Tokyu',
          starRating: '5 Star',
          roomType: 'Premier King Suite',
          mealPlan: 'Daily Gourmet Breakfast (CP)',
          roomsCount: 1,
          nights: 1,
          sellingPricePerNight: 85000,
          totalSellingPrice: 85000,
          currency: 'JPY',
          notes: 'Club Lounge access & late check-out confirmed.'
        } as any
      },
      {
        id: 'hub-kyoto',
        hubId: 'kyoto',
        hubName: 'Kyoto',
        destinationId: 'dest-japan',
        nights: 1,
        order: 2,
        manualHotel: {
          hotelName: 'The Thousand Kyoto',
          starRating: '5 Star',
          roomType: 'Japanese Garden Suite',
          mealPlan: 'Breakfast & Welcome Matcha Ceremony',
          roomsCount: 1,
          nights: 1,
          sellingPricePerNight: 92000,
          totalSellingPrice: 92000,
          currency: 'JPY',
          notes: 'Walking distance from Kyoto Station.'
        } as any
      }
    ],
    dayThemes: {
      1: 'Arrival in Tokyo & Shibuya Sky Immersion',
      2: 'Nozomi Bullet Train to Kyoto & Fushimi Inari',
      3: 'Arashiyama Bamboo Grove & Kansai Departure'
    },
    items: [
      {
        id: 'item-trf-1',
        travelDate: '2026-11-10',
        serviceTime: '14:30',
        pax: { adults: 2, children: 0, infants: 0 },
        selectedAddonIds: [],
        pickupPoint: 'Narita International Airport Terminal 1 Arrival Hall',
        dropoffPoint: 'The Capitol Hotel Tokyu, Chiyoda-ku',
        notes: 'Chauffeur waiting at Gate B with name-board.',
        totalNetCost: 35000,
        totalSellingPrice: 45000,
        currency: 'JPY',
        product: {
          id: 'prod-trf-nrt',
          sku: 'TRF-TYO-ALPHARD',
          name: 'Private Toyota Alphard Executive Airport Transfer',
          category: 'Transfers',
          productType: 'TRANSFER',
          destinationId: 'dest-japan',
          destinationName: 'Japan',
          city: 'Tokyo',
          duration: '75 Mins',
          shortDescription: 'Meet & greet luxury executive MPV transfer from Narita Airport to Tokyo city hotel.',
          inclusions: ['Flight tracking & 90-min free wait time', 'Highway tolls & parking fees', 'Bottled mineral water & Wi-Fi'],
          exclusions: ['Extra stopovers outside Tokyo 23 wards'],
          basePrice: 45000,
          currency: 'JPY'
        } as any,
        calculation: {
          finalTotalSellingPrice: 45000,
          totalSellingPrice: 45000,
          totalNetCost: 35000,
          currency: 'JPY'
        } as any
      },
      {
        id: 'item-rail-2',
        travelDate: '2026-11-11',
        serviceTime: '09:30',
        pax: { adults: 2, children: 0, infants: 0 },
        selectedAddonIds: [],
        meetingPoint: 'Tokyo Station Shinkansen Central Gate',
        notes: 'Reserved Mt. Fuji side E-seats.',
        totalNetCost: 28000,
        totalSellingPrice: 34000,
        currency: 'JPY',
        railJourneyDetails: {
          originStationId: 'JP-ST-TOKYO',
          originStationName: 'Tokyo Station',
          destinationStationId: 'JP-ST-KYOTO',
          destinationStationName: 'Kyoto Station',
          serviceGroup: 'NOZOMI_MIZUHO',
          carType: 'GREEN',
          seatType: 'RESERVED',
          seatPreference: 'E-Seat (Mt. Fuji Window)',
          pnrReference: 'EX-8842JP'
        } as any,
        product: {
          id: 'RAIL-JP-GREEN-RESERVED',
          sku: 'RAIL-TYO-KYO-GRN',
          name: 'Tokaido Shinkansen Nozomi First Class Green Car (Tokyo → Kyoto)',
          category: 'Rail',
          productType: 'RAIL',
          destinationId: 'dest-japan',
          destinationName: 'Japan',
          city: 'Kyoto',
          duration: '2h 13m',
          shortDescription: 'High-speed Tokaido Shinkansen bullet train in First Class Green Car with oversized reclining seats.',
          inclusions: ['Reserved First Class Green Car seats', 'Oversized baggage space registration'],
          exclusions: ['Onboard trolley refreshments'],
          basePrice: 34000,
          currency: 'JPY'
        } as any,
        calculation: {
          finalTotalSellingPrice: 34000,
          totalSellingPrice: 34000,
          totalNetCost: 28000,
          currency: 'JPY'
        } as any
      },
      {
        id: 'item-tour-2',
        travelDate: '2026-11-11',
        serviceTime: '14:00',
        pax: { adults: 2, children: 0, infants: 0 },
        selectedAddonIds: [],
        meetingPoint: 'The Thousand Kyoto Main Lobby Concierge Desk',
        notes: 'Wear comfortable walking shoes for Fushimi Inari torii trails.',
        totalNetCost: 48000,
        totalSellingPrice: 62000,
        currency: 'JPY',
        product: {
          id: 'prod-kyo-heritage',
          sku: 'ACT-KYO-HERITAGE',
          name: 'Private Kyoto Imperial Shrine & Gion Geisha District Cultural Walk',
          category: 'Tours & Sightseeing',
          productType: 'ACTIVITY',
          destinationId: 'dest-japan',
          destinationName: 'Japan',
          city: 'Kyoto',
          duration: '4.5 Hours',
          shortDescription: 'Private licensed national guide exploring Fushimi Inari Taisha and historic Gion Hanamikoji.',
          inclusions: ['Government-licensed English guide', 'Private luxury sedan between districts', 'Temple admission tickets'],
          exclusions: ['Personal shopping & dinner beverages'],
          basePrice: 62000,
          currency: 'JPY'
        } as any,
        calculation: {
          finalTotalSellingPrice: 62000,
          totalSellingPrice: 62000,
          totalNetCost: 48000,
          currency: 'JPY'
        } as any
      },
      {
        id: 'item-visa-1',
        travelDate: '2026-11-10',
        pax: { adults: 2, children: 0, infants: 0 },
        selectedAddonIds: [],
        notes: 'Original passports & bank statements verified.',
        totalNetCost: 12000,
        totalSellingPrice: 18000,
        currency: 'JPY',
        product: {
          id: 'VSA-JP-TOURIST',
          sku: 'VSA-JP-EVISA',
          name: 'Japan Tourist Single-Entry Consular Visa & ERFS Sponsorship',
          category: 'Visa & Ancillary Services',
          productType: 'VISA',
          destinationId: 'dest-japan',
          destinationName: 'Japan',
          city: 'Tokyo',
          duration: '5 Working Days Processing',
          shortDescription: 'Complete visa documentation, invitación letter, and consular submission support.',
          inclusions: ['Official Japan DMC guarantee letter', 'Embassy fee & VFS handling'],
          exclusions: ['Courier charges outside metro cities'],
          basePrice: 18000,
          currency: 'JPY'
        } as any,
        calculation: {
          finalTotalSellingPrice: 18000,
          totalSellingPrice: 18000,
          totalNetCost: 12000,
          currency: 'JPY'
        } as any
      }
    ] as any[]
  };

  // 1. Build Canonical Presentation Model
  const model = buildQuotePresentationModel(sampleQuote);
  check(model.quoteNumber === 'QTE-2026-9001', 'Canonical model preserves quoteNumber');
  check(model.days.length === 3, 'Canonical model generates all 3 chronological days');
  check(model.hotels.length === 2, 'Canonical model extracts both Tokyo & Kyoto hotels');
  check(model.visaServices.length === 1, 'Canonical model extracts Visa service');

  // 2. Render Email & WhatsApp from Canonical Model
  const emailOut = renderQuoteEmailFromPresentationModel(model, 'Special honeymoon rate locked for 48 hours.');
  const whatsappOut = renderQuoteWhatsAppFromPresentationModel(model, {
    customNote: 'Special honeymoon rate locked for 48 hours.',
    useEmojis: true,
    formatStyle: 'DETAILED'
  });

  // 3. Validate 100% Channel Completeness Parity
  const completeness = validateQuotePresentationCompleteness(model, emailOut, whatsappOut);
  check(completeness.isComplete, `All channels (Preview, PDF, Email, WhatsApp) have 100% content parity (checked ${completeness.checkedElementsCount} elements)`);
  check(completeness.missingInEmailHtml.length === 0, `Email HTML missing 0 elements (missing: ${completeness.missingInEmailHtml.join(', ')})`);
  check(completeness.missingInEmailText.length === 0, `Email Text missing 0 elements (missing: ${completeness.missingInEmailText.join(', ')})`);
  check(completeness.missingInWhatsApp.length === 0, `WhatsApp missing 0 elements (missing: ${completeness.missingInWhatsApp.join(', ')})`);

  // 4. Verify Specific Deep Details in Email HTML & WhatsApp
  check(emailOut.htmlBody.includes('Flight tracking & 90-min free wait time'), 'Email HTML includes service inclusions');
  check(emailOut.htmlBody.includes('Extra stopovers outside Tokyo 23 wards'), 'Email HTML includes service exclusions');
  check(emailOut.htmlBody.includes('EX-8842JP'), 'Email HTML includes Shinkansen PNR reference');
  check(emailOut.htmlBody.includes('The Capitol Hotel Tokyu'), 'Email HTML includes Tokyo hotel');
  check(emailOut.htmlBody.includes('The Thousand Kyoto'), 'Email HTML includes Kyoto hotel');

  check(whatsappOut.includes('Flight tracking & 90-min free wait time'), 'WhatsApp message includes service inclusions');
  check(whatsappOut.includes('Extra stopovers outside Tokyo 23 wards'), 'WhatsApp message includes service exclusions');
  check(whatsappOut.includes('EX-8842JP'), 'WhatsApp message includes Shinkansen PNR reference');
  check(whatsappOut.includes('The Capitol Hotel Tokyu'), 'WhatsApp message includes Tokyo hotel');
  check(whatsappOut.includes('The Thousand Kyoto'), 'WhatsApp message includes Kyoto hotel');

  // 5. Verify EmailNotificationService & quoteWhatsAppService integration
  const serviceEmail = EmailNotificationService.getInstance().generateQuotationProposalEmail(sampleQuote);
  check(serviceEmail.fullHtml.includes('Private Kyoto Imperial Shrine & Gion Geisha District Cultural Walk'), 'EmailNotificationService renders full day-by-day activities');
  check((serviceEmail.fullText || '').includes('Private Toyota Alphard Executive Airport Transfer'), 'EmailNotificationService plain text includes full transfer details');

  const serviceWhatsApp = generateWhatsAppQuoteMessage({ quote: sampleQuote });
  check(serviceWhatsApp.includes('Private Kyoto Imperial Shrine & Gion Geisha District Cultural Walk'), 'quoteWhatsAppService renders full day-by-day activities');

  const waUrlWithPhone = generateWhatsAppShareUrl('+91 98116 54959', serviceWhatsApp);
  check(waUrlWithPhone.startsWith('https://wa.me/919811654959?text='), 'generateWhatsAppShareUrl creates valid wa.me link with normalized phone');

  const waUrlWithoutPhone = generateWhatsAppShareUrl('', serviceWhatsApp);
  check(waUrlWithoutPhone.startsWith('https://api.whatsapp.com/send?text='), 'generateWhatsAppShareUrl supports contact-picker link when phone is empty');

  return {
    passed: failures.length === 0,
    totalChecks,
    passedChecks,
    failures
  };
}
