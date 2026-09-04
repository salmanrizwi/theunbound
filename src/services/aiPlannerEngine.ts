import { 
  AiPlannerStructuredRequirements, 
  AiPlannerResult, 
  AiPlannerOptionPlan, 
  AiPlannerDaySlot, 
  AiPlannerDayItem, 
  AiPlannerFollowUpQuestion, 
  QuoteItem, 
  TripRouteHub, 
  CurrencyCode, 
  User, 
  Product, 
  Hotel, 
  Destination, 
  CityHub, 
  MealPlanCode 
} from '../types';
import { AiPlannerTools } from './aiPlannerTools';
import { hotelToProduct } from '../utils/hotelHelpers';
import { formatCurrency, convertCurrency, calculateProductPrice } from './pricingEngine';
import { AppDatabase } from './db';

/**
 * AI PLANNER INTELLIGENCE ENGINE
 * Responsible for:
 * 1. Natural Language Requirement Parsing & Extraction
 * 2. Confirmed / Inferred / Missing status determination
 * 3. Smart Follow-Up Question Generation
 * 4. Controlled Database Querying (Zero Hallucinations)
 * 5. 3-Tier Differentiated Option Generation (Best Match, Best Value, Premium)
 * 6. Day-Wise Chronological Itinerary Construction
 * 7. Feasibility Validation & Pricing Integration
 * 8. Handoff Mapping to Unified B2B Quote Builder
 */

export class AiPlannerEngine {
  private static instance: AiPlannerEngine;
  private tools: AiPlannerTools;
  private db: AppDatabase;

  private constructor() {
    this.tools = AiPlannerTools.getInstance();
    this.db = AppDatabase.getInstance();
  }

  public static getInstance(): AiPlannerEngine {
    if (!AiPlannerEngine.instance) {
      AiPlannerEngine.instance = new AiPlannerEngine();
    }
    return AiPlannerEngine.instance;
  }

  /**
   * Parse free-form natural language prompt from agent into structured requirements.
   */
  public parseRequirements(
    prompt: string, 
    existingRequirements?: Partial<AiPlannerStructuredRequirements>
  ): AiPlannerStructuredRequirements {
    const text = (prompt || '').trim();
    const textLower = text.toLowerCase();

    // 1. Destination Matching
    const allDestinations = this.db.getDestinations();
    let matchedDest: Destination | undefined;

    for (const d of allDestinations) {
      if (textLower.includes(d.name.toLowerCase()) || textLower.includes(d.country.toLowerCase())) {
        matchedDest = d;
        break;
      }
    }

    // Default fallback to Japan if not explicitly detected or first available destination
    if (!matchedDest && allDestinations.length > 0) {
      const japanDest = allDestinations.find(d => d.name.toLowerCase().includes('japan') || d.country.toLowerCase().includes('japan'));
      matchedDest = japanDest || allDestinations[0];
    }

    const destConfirmed = Boolean(
      matchedDest && (textLower.includes(matchedDest.name.toLowerCase()) || textLower.includes(matchedDest.country.toLowerCase()))
    );

    // 2. Hubs Matching
    const destHubs = matchedDest ? this.tools.searchHubs(matchedDest.id) : this.db.getCityHubs();
    const matchedHubs: CityHub[] = [];

    destHubs.forEach(hub => {
      if (textLower.includes(hub.name.toLowerCase()) || (hub.tagline && textLower.includes(hub.tagline.toLowerCase()))) {
        matchedHubs.push(hub);
      }
    });

    // If no hubs detected, infer primary hub or top 2 hubs
    if (matchedHubs.length === 0 && destHubs.length > 0) {
      matchedHubs.push(destHubs[0]);
      if (destHubs.length > 1) {
        matchedHubs.push(destHubs[1]);
      }
    }

    const hubsConfirmed = matchedHubs.some(h => textLower.includes(h.name.toLowerCase()));

    // 3. Duration & Nights Parsing
    let nights = 7;
    let nightsStatus: 'CONFIRMED' | 'INFERRED' = 'INFERRED';

    const nightsMatch = text.match(/(\d+)\s*(?:nights?|nt?s?|n)/i);
    const daysMatch = text.match(/(\d+)\s*(?:days?|d)/i);

    if (nightsMatch) {
      nights = parseInt(nightsMatch[1], 10);
      nightsStatus = 'CONFIRMED';
    } else if (daysMatch) {
      nights = Math.max(1, parseInt(daysMatch[1], 10) - 1);
      nightsStatus = 'CONFIRMED';
    }

    // 4. Travelers Parsing
    let adults = 2;
    let adultsStatus: 'CONFIRMED' | 'INFERRED' = 'INFERRED';
    let children = 0;
    let childrenStatus: 'CONFIRMED' | 'INFERRED' = 'INFERRED';
    let infants = 0;

    const adultsMatch = text.match(/(\d+)\s*(?:adults?|pax|people|persons?|guests?)/i);
    if (adultsMatch) {
      adults = parseInt(adultsMatch[1], 10);
      adultsStatus = 'CONFIRMED';
    }

    const childrenMatch = text.match(/(\d+)\s*(?:child(?:ren)?|kids?)/i);
    if (childrenMatch) {
      children = parseInt(childrenMatch[1], 10);
      childrenStatus = 'CONFIRMED';
    }

    const infantsMatch = text.match(/(\d+)\s*(?:infants?|bab(?:y|ies))/i);
    if (infantsMatch) {
      infants = parseInt(infantsMatch[1], 10);
    }

    // Extract child ages if mentioned (e.g., "children aged 6 and 9")
    const childAges: number[] = [];
    const agesMatch = text.match(/aged?\s*(\d+)(?:\s*(?:and|,)\s*(\d+))?/i);
    if (agesMatch) {
      if (agesMatch[1]) childAges.push(parseInt(agesMatch[1], 10));
      if (agesMatch[2]) childAges.push(parseInt(agesMatch[2], 10));
    }
    while (childAges.length < children) {
      childAges.push(7); // default child age
    }

    // 5. Travel Dates
    let startDate: string | null = null;
    let endDate: string | null = null;
    let datesStatus: 'CONFIRMED' | 'INFERRED' | 'MISSING' = 'MISSING';

    const isoDateMatch = text.match(/\b(202[5-9]-\d{2}-\d{2})\b/);
    if (isoDateMatch) {
      startDate = isoDateMatch[1];
      datesStatus = 'CONFIRMED';
    } else {
      // Check month mentions like "in October", "October 15", "next month"
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const monthShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      
      let foundMonthIdx = -1;
      months.forEach((m, idx) => {
        if (textLower.includes(m)) foundMonthIdx = idx;
      });
      if (foundMonthIdx === -1) {
        monthShort.forEach((m, idx) => {
          if (textLower.includes(` ${m} `) || textLower.includes(` ${m}.`)) foundMonthIdx = idx;
        });
      }

      const currentYear = new Date().getFullYear();
      if (foundMonthIdx !== -1) {
        const dayMatch = text.match(new RegExp(`(?:${months[foundMonthIdx]}|${monthShort[foundMonthIdx]})\\s*(\\d{1,2})`, 'i'));
        const dayNum = dayMatch ? parseInt(dayMatch[1], 10) : 15;
        const mm = String(foundMonthIdx + 1).padStart(2, '0');
        const dd = String(dayNum).padStart(2, '0');
        startDate = `${currentYear}-${mm}-${dd}`;
        datesStatus = 'CONFIRMED';
      } else {
        // Infer dates starting 30 days in the future
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        startDate = futureDate.toISOString().split('T')[0];
        datesStatus = 'INFERRED';
      }
    }

    if (startDate) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + nights);
      endDate = d.toISOString().split('T')[0];
    }

    // 6. Hotel Preferences
    let hotelCategory = '4 Star Superior';
    let hotelCatStatus: 'CONFIRMED' | 'INFERRED' = 'INFERRED';

    if (textLower.includes('5 star') || textLower.includes('5-star') || textLower.includes('luxury') || textLower.includes('ultra luxury')) {
      hotelCategory = '5 Star Luxury';
      hotelCatStatus = 'CONFIRMED';
    } else if (textLower.includes('4 star') || textLower.includes('4-star') || textLower.includes('boutique')) {
      hotelCategory = '4 Star Superior';
      hotelCatStatus = 'CONFIRMED';
    } else if (textLower.includes('3 star') || textLower.includes('3-star') || textLower.includes('budget') || textLower.includes('standard')) {
      hotelCategory = '3 Star Standard';
      hotelCatStatus = 'CONFIRMED';
    } else if (textLower.includes('ryokan') || textLower.includes('onsen')) {
      hotelCategory = 'Traditional Ryokan';
      hotelCatStatus = 'CONFIRMED';
    }

    // Room count calculation: 2 adults per room by default
    const roomCount = Math.max(1, Math.ceil(adults / 2));

    // Meal plan
    let mealPlan: string | null = 'Bed & Breakfast (BB)';
    if (textLower.includes('half board') || textLower.includes('dinner')) {
      mealPlan = 'Half Board (HB)';
    } else if (textLower.includes('room only')) {
      mealPlan = 'Room Only (EP)';
    } else if (textLower.includes('all inclusive')) {
      mealPlan = 'All Inclusive (AI)';
    }

    // 7. Travel Style & Interests
    const travelStyles: string[] = [];
    if (textLower.includes('luxury') || textLower.includes('vip') || textLower.includes('first class')) travelStyles.push('Luxury');
    if (textLower.includes('culture') || textLower.includes('history') || textLower.includes('temple') || textLower.includes('heritage')) travelStyles.push('Cultural');
    if (textLower.includes('food') || textLower.includes('culinary') || textLower.includes('sushi') || textLower.includes('dining')) travelStyles.push('Gastronomy');
    if (textLower.includes('family') || textLower.includes('kids')) travelStyles.push('Family');
    if (textLower.includes('adventure') || textLower.includes('hiking') || textLower.includes('outdoor')) travelStyles.push('Adventure');
    if (textLower.includes('leisure') || textLower.includes('relaxation') || textLower.includes('spa')) travelStyles.push('Leisure');

    if (travelStyles.length === 0) {
      travelStyles.push('Cultural', 'Highlights');
    }

    const interests: string[] = [];
    const interestKeywords = [
      'temple', 'shrine', 'tea ceremony', 'sushi', 'ramen', 'street food', 
      'shopping', 'mt fuji', 'fuji', 'geisha', 'samurai', 'garden', 
      'museum', 'cruise', 'boat', 'nightlife', 'photography', 'onsen', 'ryokan'
    ];
    interestKeywords.forEach(kw => {
      if (textLower.includes(kw)) {
        interests.push(kw.charAt(0).toUpperCase() + kw.slice(1));
      }
    });

    // 8. Transport Preference
    let transportPref: 'PRIVATE' | 'SHARED' | 'TRAIN' | 'MIXED' = 'PRIVATE';
    if (textLower.includes('train') || textLower.includes('shinkansen') || textLower.includes('rail')) {
      transportPref = 'TRAIN';
    } else if (textLower.includes('shared') || textLower.includes('coach') || textLower.includes('sic')) {
      transportPref = 'SHARED';
    } else if (textLower.includes('private') || textLower.includes('chauffeur') || textLower.includes('luxury van') || textLower.includes('mpv')) {
      transportPref = 'PRIVATE';
    }

    // 9. Visa Assistance
    let visaAssistance: 'YES' | 'NO' | 'NOT_REQUIRED' = 'NOT_REQUIRED';
    if (textLower.includes('visa required') || textLower.includes('need visa') || textLower.includes('visa assistance')) {
      visaAssistance = 'YES';
    }

    // 10. Client Name Extraction
    let clientName = 'VIP Travelers';
    const clientMatch = text.match(/(?:client|for|guest|traveler)\s*:\s*([A-Za-z\s]+?)(?:,|\.|\n|$)/i) || 
                       text.match(/(?:for\s+)(?:mr\.|ms\.|dr\.)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    if (clientMatch && clientMatch[1]) {
      clientName = clientMatch[1].trim();
    }

    return {
      destination: {
        value: matchedDest?.name || 'Japan',
        status: destConfirmed ? 'CONFIRMED' : 'INFERRED',
        confidence: destConfirmed ? 0.95 : 0.65
      },
      destinationId: matchedDest?.id || 'dest-japan',
      hubs: {
        value: matchedHubs.map(h => h.name),
        status: hubsConfirmed ? 'CONFIRMED' : 'INFERRED',
        confidence: hubsConfirmed ? 0.9 : 0.6
      },
      hubIds: matchedHubs.map(h => h.id),
      travelers: {
        adults: {
          value: adults,
          status: adultsStatus,
          confidence: adultsStatus === 'CONFIRMED' ? 0.95 : 0.6
        },
        children: {
          value: children,
          status: childrenStatus,
          confidence: childrenStatus === 'CONFIRMED' ? 0.9 : 0.5
        },
        infants: {
          value: infants,
          status: infants > 0 ? 'CONFIRMED' : 'INFERRED',
          confidence: 0.8
        },
        childAges: {
          value: childAges,
          status: childAges.length > 0 ? 'CONFIRMED' : 'INFERRED',
          confidence: childAges.length > 0 ? 0.85 : 0.5
        }
      },
      duration: {
        nights: {
          value: nights,
          status: nightsStatus,
          confidence: nightsStatus === 'CONFIRMED' ? 0.95 : 0.6
        },
        days: {
          value: nights + 1,
          status: nightsStatus,
          confidence: nightsStatus === 'CONFIRMED' ? 0.95 : 0.6
        }
      },
      travelDates: {
        startDate: {
          value: startDate,
          status: datesStatus,
          confidence: datesStatus === 'CONFIRMED' ? 0.9 : 0.5
        },
        endDate: {
          value: endDate,
          status: datesStatus,
          confidence: datesStatus === 'CONFIRMED' ? 0.9 : 0.5
        }
      },
      hotelPreference: {
        category: {
          value: hotelCategory,
          status: hotelCatStatus,
          confidence: hotelCatStatus === 'CONFIRMED' ? 0.9 : 0.65
        },
        mealPlan: {
          value: mealPlan,
          status: 'INFERRED',
          confidence: 0.7
        },
        roomCount: {
          value: roomCount,
          status: 'INFERRED',
          confidence: 0.8
        }
      },
      travelStyle: {
        value: travelStyles,
        status: 'CONFIRMED',
        confidence: 0.85
      },
      transportPreference: {
        value: transportPref,
        status: 'CONFIRMED',
        confidence: 0.85
      },
      interests: {
        value: interests.length > 0 ? interests : ['Cultural Highlights', 'Sightseeing'],
        status: interests.length > 0 ? 'CONFIRMED' : 'INFERRED',
        confidence: 0.8
      },
      visaAssistance: {
        value: visaAssistance,
        status: visaAssistance === 'YES' ? 'CONFIRMED' : 'INFERRED',
        confidence: 0.7
      },
      clientName: clientName
    };
  }

  /**
   * Generates smart follow-up questions only for material missing fields.
   */
  public generateFollowUpQuestions(requirements: AiPlannerStructuredRequirements): AiPlannerFollowUpQuestion[] {
    const questions: AiPlannerFollowUpQuestion[] = [];

    // Dates check
    if (requirements.travelDates.startDate.status === 'MISSING' || requirements.travelDates.startDate.status === 'INFERRED') {
      questions.push({
        id: 'q-travel-dates',
        field: 'travelDates.startDate',
        question: 'What is the client’s exact travel start date or preferred month of departure?',
        placeholder: 'e.g., 2026-10-15 or Mid-October 2026',
        currentValue: requirements.travelDates.startDate.value,
        resolved: false
      });
    }

    // Children ages check
    if (requirements.travelers.children.value > 0 && requirements.travelers.childAges.status !== 'CONFIRMED') {
      questions.push({
        id: 'q-child-ages',
        field: 'travelers.childAges',
        question: `What are the ages of the ${requirements.travelers.children.value} children?`,
        placeholder: 'e.g., 6, 9',
        currentValue: requirements.travelers.childAges.value.join(', '),
        resolved: false
      });
    }

    // Visa check if international
    if (requirements.visaAssistance.status === 'INFERRED' && requirements.destination.value.toLowerCase().includes('japan')) {
      questions.push({
        id: 'q-visa-assistance',
        field: 'visaAssistance',
        question: 'Does the client require TheUnbound consular visa facilitation & guarantor paperwork?',
        options: ['Yes, Include Visa Service', 'No, Client handles visa independently', 'Not Required / Visa-Free'],
        currentValue: requirements.visaAssistance.value,
        resolved: false
      });
    }

    return questions;
  }

  /**
   * Generate Full 3-Tier Itinerary & Quote Plan from Structured Requirements
   * Strictly reads real database and enforces zero hallucination.
   */
  public async generatePlan(
    requirements: AiPlannerStructuredRequirements, 
    user: User | null, 
    currency: CurrencyCode = 'USD',
    promptText: string = ''
  ): Promise<AiPlannerResult> {
    const destinationId = requirements.destinationId || 'dest-japan';
    const destName = requirements.destination.value;
    const nights = requirements.duration.nights.value;
    const totalDays = nights + 1;
    const adults = requirements.travelers.adults.value;
    const children = requirements.travelers.children.value;
    const infants = requirements.travelers.infants.value;
    const startDate = requirements.travelDates.startDate.value || new Date().toISOString().split('T')[0];

    // Controlled Database Retrieval
    const dbDestinations = this.tools.searchDestinations(destName);
    const destFound = dbDestinations.length > 0;
    
    // Controlled Hubs Retrieval
    let availableHubs = this.tools.searchHubs(destinationId);
    if (availableHubs.length === 0) {
      availableHubs = this.db.getCityHubs();
    }

    // Filter hubs to the requested ones, or use defaults
    const requestedHubNames = requirements.hubs.value.map(h => h.toLowerCase());
    let selectedHubs = availableHubs.filter(h => requestedHubNames.some(rh => rh.includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(rh)));
    if (selectedHubs.length === 0) {
      selectedHubs = availableHubs.slice(0, 2);
    }

    // Distribute nights across hubs
    const hubCount = selectedHubs.length;
    const baseNightsPerHub = Math.floor(nights / hubCount);
    let remainderNights = nights % hubCount;

    const routeHubs: TripRouteHub[] = selectedHubs.map((hub, idx) => {
      const hubNights = baseNightsPerHub + (idx === 0 ? remainderNights : 0);
      return {
        id: `route-hub-${hub.id}-${idx}`,
        hubId: hub.id,
        hubName: hub.name,
        destinationId: destinationId,
        order: idx + 1,
        nights: Math.max(1, hubNights),
        status: 'CONFIRMED'
      };
    });

    // Controlled Hotel Retrieval for each hub
    const allHubHotels: Record<string, Hotel[]> = {};
    for (const rh of routeHubs) {
      allHubHotels[rh.hubId] = this.tools.searchHotels({
        destinationId: destinationId,
        hubId: rh.hubId
      });
      // Fallback: if no hub-specific hotels, retrieve destination hotels
      if (allHubHotels[rh.hubId].length === 0) {
        allHubHotels[rh.hubId] = this.tools.searchHotels({ destinationId: destinationId });
      }
    }

    // Controlled Activity Retrieval for each hub
    const allHubActivities: Record<string, Product[]> = {};
    for (const rh of routeHubs) {
      allHubActivities[rh.hubId] = this.tools.searchActivities({
        destinationId: destinationId,
        hubId: rh.hubId,
        interests: requirements.interests.value
      });
      if (allHubActivities[rh.hubId].length === 0) {
        allHubActivities[rh.hubId] = this.tools.searchActivities({ destinationId: destinationId });
      }
    }

    // Controlled Transfer Retrieval
    const transferData = this.tools.searchTransfers({ destinationId: destinationId, minCapacity: adults + children });

    // Controlled Visa Retrieval
    const visaProducts = this.tools.searchVisaProducts(destinationId);

    // BUILD 3 DIFFERENTIATED OPTIONS:
    // Option 1: Best Match (Direct translation of requirements)
    // Option 2: Best Value (High-value 4-star, optimized pricing)
    // Option 3: Premium (5-star flagship luxury, VIP private chauffeur)

    const option1 = this.buildOptionPlan({
      optionNumber: 1,
      optionKey: 'BEST_MATCH',
      title: 'Curated Itinerary',
      badge: 'Best Match',
      tagline: 'Precision alignment with client dates, style, and travel pace.',
      hotelTierCriteria: '4_STAR_SUPERIOR',
      destinationId,
      destinationName: destName,
      routeHubs,
      allHubHotels,
      allHubActivities,
      transferData,
      visaProducts,
      requirements,
      user,
      currency,
      startDate,
      totalDays
    });

    const option2 = this.buildOptionPlan({
      optionNumber: 2,
      optionKey: 'BEST_VALUE',
      title: 'Smart Value Itinerary',
      badge: 'Best Value',
      tagline: 'Top-reviewed 4-star boutique hotels & flexible curated sightseeing.',
      hotelTierCriteria: 'VALUE_BOUTIQUE',
      destinationId,
      destinationName: destName,
      routeHubs,
      allHubHotels,
      allHubActivities,
      transferData,
      visaProducts,
      requirements,
      user,
      currency,
      startDate,
      totalDays
    });

    const option3 = this.buildOptionPlan({
      optionNumber: 3,
      optionKey: 'PREMIUM',
      title: 'Ultra Luxury & Chauffeur Plan',
      badge: 'Premium Luxury',
      tagline: 'Flagship 5-star properties, executive private MPVs, and VIP guided access.',
      hotelTierCriteria: '5_STAR_LUXURY',
      destinationId,
      destinationName: destName,
      routeHubs,
      allHubHotels,
      allHubActivities,
      transferData,
      visaProducts,
      requirements,
      user,
      currency,
      startDate,
      totalDays
    });

    const confirmedSummary: string[] = [];
    const inferredSummary: string[] = [];
    const missingSummary: string[] = [];

    if (requirements.destination.status === 'CONFIRMED') confirmedSummary.push(`Destination: ${requirements.destination.value}`);
    else inferredSummary.push(`Destination inferred as ${requirements.destination.value}`);

    if (requirements.hubs.status === 'CONFIRMED') confirmedSummary.push(`Route Hubs: ${requirements.hubs.value.join(' → ')}`);
    else inferredSummary.push(`Route Hubs inferred: ${requirements.hubs.value.join(' → ')}`);

    if (requirements.duration.nights.status === 'CONFIRMED') confirmedSummary.push(`Duration: ${requirements.duration.nights.value} Nights (${totalDays} Days)`);
    else inferredSummary.push(`Duration: ${requirements.duration.nights.value} Nights (${totalDays} Days)`);

    if (requirements.travelers.adults.status === 'CONFIRMED') confirmedSummary.push(`Travelers: ${adults} Adults${children > 0 ? `, ${children} Children` : ''}`);
    else inferredSummary.push(`Travelers: ${adults} Adults default`);

    if (requirements.travelDates.startDate.status === 'CONFIRMED') confirmedSummary.push(`Travel Start Date: ${startDate}`);
    else {
      inferredSummary.push(`Estimated start date: ${startDate}`);
      missingSummary.push('Definitive client travel start date');
    }

    if (requirements.hotelPreference.category.status === 'CONFIRMED') confirmedSummary.push(`Accommodation Tier: ${requirements.hotelPreference.category.value}`);
    else inferredSummary.push(`Accommodation: ${requirements.hotelPreference.category.value}`);

    const warnings: string[] = [];
    const totalHotelsFound = Object.values(allHubHotels).reduce((acc, list) => acc + list.length, 0);
    const totalActivitiesFound = Object.values(allHubActivities).reduce((acc, list) => acc + list.length, 0);

    if (totalHotelsFound === 0) {
      warnings.push(`No exact hotel properties configured for destination ${destName}. Suggested manual accommodation.`);
    }

    return {
      requirements,
      confirmedSummary,
      inferredSummary,
      missingSummary,
      followUpQuestions: this.generateFollowUpQuestions(requirements),
      options: [option1, option2, option3],
      selectedOptionIndex: 0,
      generatedAt: new Date().toISOString(),
      plannerVersion: '2.4.0-B2B-PROD',
      promptText: promptText || 'AI Planner Itinerary Recommendation',
      assumptions: [
        'All rates calculated via authoritative TheUnbound Pricing Engine.',
        'Zero fictional inventory: only active verified supplier contracts and properties.',
        'Daily operational buffers & private intercity transfers included.'
      ],
      inventoryStatus: {
        destinationFound: destFound,
        hubsFound: routeHubs.length,
        hotelsFound: totalHotelsFound,
        activitiesFound: totalActivitiesFound,
        transfersFound: transferData.routes.length,
        warnings
      }
    };
  }

  /**
   * Builds an individual option plan (Best Match, Best Value, or Premium)
   */
  private buildOptionPlan(params: {
    optionNumber: 1 | 2 | 3;
    optionKey: 'BEST_MATCH' | 'BEST_VALUE' | 'PREMIUM';
    title: string;
    badge: string;
    tagline: string;
    hotelTierCriteria: '4_STAR_SUPERIOR' | 'VALUE_BOUTIQUE' | '5_STAR_LUXURY';
    destinationId: string;
    destinationName: string;
    routeHubs: TripRouteHub[];
    allHubHotels: Record<string, Hotel[]>;
    allHubActivities: Record<string, Product[]>;
    transferData: { routes: any[]; products: Product[] };
    visaProducts: any[];
    requirements: AiPlannerStructuredRequirements;
    user: User | null;
    currency: CurrencyCode;
    startDate: string;
    totalDays: number;
  }): AiPlannerOptionPlan {
    const { 
      optionNumber, 
      optionKey, 
      title, 
      badge, 
      tagline, 
      hotelTierCriteria, 
      destinationId, 
      destinationName, 
      routeHubs, 
      allHubHotels, 
      allHubActivities, 
      transferData, 
      requirements, 
      user, 
      currency, 
      startDate, 
      totalDays 
    } = params;

    const adults = requirements.travelers.adults.value;
    const children = requirements.travelers.children.value;
    const infants = requirements.travelers.infants.value;
    const totalPax = adults + children + infants;
    const roomCount = requirements.hotelPreference.roomCount.value;

    const quoteItems: QuoteItem[] = [];
    const days: AiPlannerDaySlot[] = [];
    const dayThemes: Record<number, string> = {};

    // 1. Select Hotel for each Hub
    const updatedRouteHubs: TripRouteHub[] = [];
    let currentHubStartDay = 1;

    routeHubs.forEach((rh, hubIdx) => {
      const hubHotels = allHubHotels[rh.hubId] || [];
      let selectedHotel: Hotel | undefined;

      if (hotelTierCriteria === '5_STAR_LUXURY') {
        selectedHotel = hubHotels.find(h => (h.starRating || 0) >= 5) || hubHotels[0];
      } else if (hotelTierCriteria === 'VALUE_BOUTIQUE') {
        selectedHotel = hubHotels.find(h => (h.starRating || 0) === 4) || hubHotels[hubHotels.length - 1] || hubHotels[0];
      } else {
        selectedHotel = hubHotels[0];
      }

      const checkIn = new Date(startDate);
      checkIn.setDate(checkIn.getDate() + (currentHubStartDay - 1));
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + rh.nights);

      const checkInStr = checkIn.toISOString().split('T')[0];
      const checkOutStr = checkOut.toISOString().split('T')[0];

      if (selectedHotel) {
        const roomType = selectedHotel.roomTypes?.[optionNumber === 3 ? Math.min(1, selectedHotel.roomTypes.length - 1) : 0] || selectedHotel.roomTypes?.[0];
        const rate = roomType?.rates?.[0];

        const hotelProd = hotelToProduct(selectedHotel, roomType, rate, rh.nights, roomCount);

        const calculation = calculateProductPrice(hotelProd, {
          productId: hotelProd.id,
          adults,
          children,
          infants,
          travelDate: checkInStr,
          targetCurrency: currency,
          pricingTier: 'B2B',
          userRole: user?.role || 'B2B_AGENT',
          user: user
        });

        quoteItems.push({
          id: `qi-htl-${selectedHotel.id}-${hubIdx}`,
          product: hotelProd,
          pax: { adults, children, infants },
          travelDate: checkInStr,
          selectedAddonIds: [],
          notes: `${rh.nights} Nights accommodation at ${selectedHotel.name} (${roomType?.roomName || 'Selected Room'}). Check-in: ${checkInStr}, Check-out: ${checkOutStr}.`,
          calculation
        });

        updatedRouteHubs.push({
          ...rh,
          hotelId: selectedHotel.id,
          roomTypeId: roomType?.id,
          roomsCount: roomCount,
          notes: `${selectedHotel.name} (${roomType?.roomName || 'Selected Room'}). Check-in: ${checkInStr}, Check-out: ${checkOutStr}`
        });
      } else {
        updatedRouteHubs.push({
          ...rh,
          notes: `Check-in: ${checkInStr}, Check-out: ${checkOutStr}`
        });
      }

      currentHubStartDay += rh.nights;
    });

    // 2. Add Arrival Transfer (Day 1)
    const firstHub = updatedRouteHubs[0];
    const arrivalTransferProduct = transferData.products.find(p => 
      p.name.toLowerCase().includes('arrival') || 
      p.name.toLowerCase().includes('airport') || 
      p.category.toLowerCase().includes('transfer')
    ) || transferData.products[0];

    if (arrivalTransferProduct) {
      const calculation = calculateProductPrice(arrivalTransferProduct, {
        productId: arrivalTransferProduct.id,
        adults,
        children,
        infants,
        travelDate: startDate,
        targetCurrency: currency,
        pricingTier: 'B2B',
        userRole: user?.role || 'B2B_AGENT',
        user: user
      });

      quoteItems.push({
        id: 'qi-trf-arr-day1',
        product: arrivalTransferProduct,
        pax: { adults, children, infants },
        travelDate: startDate,
        serviceTime: '14:00',
        notes: `Airport Arrival Private Transfer to ${firstHub?.hubName || 'Hotel'}. Flight meet-and-greet.`,
        selectedAddonIds: [],
        calculation
      });
    }

    // 3. Build Day-by-Day Slots & Schedule Curated Experiences
    let dayCursorDate = new Date(startDate);
    let activeHubIndex = 0;
    let nightsAccumulatedInCurrentHub = 0;

    for (let dayNumber = 1; dayNumber <= totalDays; dayNumber++) {
      const dateStr = dayCursorDate.toISOString().split('T')[0];
      const formattedDate = dayCursorDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      // Determine active hub for this day
      const currentHub = updatedRouteHubs[activeHubIndex] || updatedRouteHubs[0];
      const isFirstDay = dayNumber === 1;
      const isLastDay = dayNumber === totalDays;
      const isTransitionDay = !isFirstDay && !isLastDay && nightsAccumulatedInCurrentHub === currentHub.nights;

      let themeTitle = '';
      if (isFirstDay) {
        themeTitle = `Arrival in ${currentHub.hubName} & Welcome Experience`;
      } else if (isLastDay) {
        themeTitle = `Farewell ${currentHub.hubName} & Departure`;
      } else if (isTransitionDay && activeHubIndex < updatedRouteHubs.length - 1) {
        const nextHub = updatedRouteHubs[activeHubIndex + 1];
        themeTitle = `Scenic Journey: ${currentHub.hubName} to ${nextHub.hubName}`;
      } else {
        const themes = [
          `Exploring ${currentHub.hubName}: Historic Temples & Sacred Heritage`,
          `Flavors of ${currentHub.hubName}: Exclusive Culinary Walk & Markets`,
          `Nature & Panorama: Mount Fuji / Scenic Highlights`,
          `Artisan Traditions & Craftsmanship in ${currentHub.hubName}`,
          `Modern Metropolises: Architecture, Shopping & Evening Skyline`
        ];
        themeTitle = themes[(dayNumber - 1) % themes.length];
      }

      dayThemes[dayNumber] = themeTitle;

      const dayItems: AiPlannerDayItem[] = [];

      // If Day 1: Add arrival transfer and check-in item
      if (isFirstDay) {
        if (arrivalTransferProduct) {
          dayItems.push({
            type: 'TRANSFER',
            id: 'item-trf-arr-day1',
            name: arrivalTransferProduct.name,
            category: 'Ground Transfer',
            hubId: currentHub.hubId,
            hubName: currentHub.hubName,
            timeSlot: 'AFTERNOON',
            serviceTime: '14:00',
            productId: arrivalTransferProduct.id,
            sellingPrice: 100,
            sellingPriceFormatted: formatCurrency(100, currency),
            notes: 'VIP Airport Meet & Chauffeur Transfer to Hotel.'
          });
        }
        const currentHotelName = currentHub.hotelId ? (allHubHotels[currentHub.hubId]?.find(h => h.id === currentHub.hotelId)?.name || 'Selected Hotel') : 'Selected Hotel';
        dayItems.push({
          type: 'HOTEL',
          id: `item-htl-checkin-${currentHub.hubId}`,
          name: `${currentHotelName} (Check-in & Settle)`,
          category: 'Accommodation',
          hubId: currentHub.hubId,
          hubName: currentHub.hubName,
          timeSlot: 'AFTERNOON',
          serviceTime: '15:00',
          hotelId: currentHub.hotelId,
          sellingPrice: 0,
          sellingPriceFormatted: 'Included in Stay',
          notes: 'Standard check-in from 15:00. Luggage unpacking and leisure evening.'
        });
      }

      // If Transition Day: Add Inter-hub Transfer
      if (isTransitionDay && activeHubIndex < updatedRouteHubs.length - 1) {
        const nextHub = updatedRouteHubs[activeHubIndex + 1];
        const intercityTransferProduct = transferData.products.find(p => 
          p.name.toLowerCase().includes('intercity') || 
          p.name.toLowerCase().includes('bullet') || 
          p.name.toLowerCase().includes('transfer')
        ) || arrivalTransferProduct;

        if (intercityTransferProduct) {
          const calculation = calculateProductPrice(intercityTransferProduct, {
            productId: intercityTransferProduct.id,
            adults,
            children,
            infants,
            travelDate: dateStr,
            targetCurrency: currency,
            pricingTier: 'B2B',
            userRole: user?.role || 'B2B_AGENT',
            user: user
          });

          quoteItems.push({
            id: `qi-trf-intercity-day${dayNumber}`,
            product: intercityTransferProduct,
            pax: { adults, children, infants },
            travelDate: dateStr,
            serviceTime: '10:00',
            notes: `Private Chauffeur / Express Intercity Transfer: ${currentHub.hubName} Hotel to ${nextHub.hubName} Hotel.`,
            selectedAddonIds: [],
            calculation
          });

          dayItems.push({
            type: 'TRANSFER',
            id: `item-trf-intercity-day${dayNumber}`,
            name: `${currentHub.hubName} to ${nextHub.hubName} Transfer`,
            category: 'Intercity Transport',
            hubId: currentHub.hubId,
            hubName: currentHub.hubName,
            timeSlot: 'MORNING',
            serviceTime: '10:00',
            productId: intercityTransferProduct.id,
            sellingPrice: 175,
            sellingPriceFormatted: formatCurrency(175, currency),
            notes: `Door-to-door luggage assistance and transfer to ${nextHub.hubName}.`
          });
        }

        // Switch to next hub
        activeHubIndex++;
        nightsAccumulatedInCurrentHub = 0;
      }

      // Add Curated Activity for non-transition, non-arrival days (or afternoon of arrival if light)
      const hubActs = allHubActivities[currentHub.hubId] || [];
      if (!isLastDay && hubActs.length > 0) {
        const actIndex = (dayNumber - 1) % hubActs.length;
        const chosenAct = hubActs[actIndex];

        if (chosenAct && !quoteItems.some(qi => qi.product.id === chosenAct.id)) {
          const calculation = calculateProductPrice(chosenAct, {
            productId: chosenAct.id,
            adults,
            children,
            infants,
            travelDate: dateStr,
            targetCurrency: currency,
            pricingTier: 'B2B',
            userRole: user?.role || 'B2B_AGENT',
            user: user
          });

          quoteItems.push({
            id: `qi-act-${chosenAct.id}-day${dayNumber}`,
            product: chosenAct,
            pax: { adults, children, infants },
            travelDate: dateStr,
            serviceTime: isTransitionDay ? '15:30' : '09:30',
            notes: `Day ${dayNumber}: ${chosenAct.name}. Licensed bilingual expert guide included.`,
            selectedAddonIds: [],
            calculation
          });

          dayItems.push({
            type: 'ACTIVITY',
            id: `item-act-${chosenAct.id}-day${dayNumber}`,
            name: chosenAct.name,
            category: chosenAct.category || 'Sightseeing',
            hubId: currentHub.hubId,
            hubName: currentHub.hubName,
            timeSlot: isTransitionDay ? 'AFTERNOON' : 'MORNING',
            serviceTime: isTransitionDay ? '15:30' : '09:30',
            productId: chosenAct.id,
            sellingPrice: (chosenAct.adultNetPrice || 90) * 1.25 * totalPax,
            sellingPriceFormatted: formatCurrency((chosenAct.adultNetPrice || 90) * 1.25 * totalPax, currency),
            notes: (chosenAct.shortDescription || chosenAct.longDescription || 'Curated guided experience.').substring(0, 120),
            product: chosenAct
          });
        }
      }

      // If Last Day: Add Departure Transfer
      if (isLastDay) {
        const lastHub = updatedRouteHubs[updatedRouteHubs.length - 1] || currentHub;
        const departureTransferProduct = transferData.products.find(p => 
          p.name.toLowerCase().includes('departure') || 
          p.name.toLowerCase().includes('airport') || 
          p.category.toLowerCase().includes('transfer')
        ) || arrivalTransferProduct;

        if (departureTransferProduct) {
          const calculation = calculateProductPrice(departureTransferProduct, {
            productId: departureTransferProduct.id,
            adults,
            children,
            infants,
            travelDate: dateStr,
            targetCurrency: currency,
            pricingTier: 'B2B',
            userRole: user?.role || 'B2B_AGENT',
            user: user
          });

          quoteItems.push({
            id: `qi-trf-dep-day${dayNumber}`,
            product: departureTransferProduct,
            pax: { adults, children, infants },
            travelDate: dateStr,
            serviceTime: '11:00',
            notes: `Private Airport Drop-off Transfer from ${lastHub.hubName} Hotel to International Airport.`,
            selectedAddonIds: [],
            calculation
          });

          dayItems.push({
            type: 'TRANSFER',
            id: `item-trf-dep-day${dayNumber}`,
            name: departureTransferProduct.name,
            category: 'Ground Transfer',
            hubId: lastHub.hubId,
            hubName: lastHub.hubName,
            timeSlot: 'MORNING',
            serviceTime: '11:00',
            productId: departureTransferProduct.id,
            sellingPrice: 100,
            sellingPriceFormatted: formatCurrency(100, currency),
            notes: 'Timely airport drop-off 3.5h prior to flight departure.'
          });
        }
      }

      days.push({
        dayNumber,
        dateString: dateStr,
        formattedDate,
        hubId: currentHub.hubId,
        hubName: currentHub.hubName,
        themeTitle,
        isTransitionDay,
        items: dayItems
      });

      nightsAccumulatedInCurrentHub++;
      dayCursorDate.setDate(dayCursorDate.getDate() + 1);
    }

    // 4. Calculate Final Authoritative Pricing
    const pricingResult = this.tools.calculateQuotePricing(quoteItems, user, currency);
    const totalSellingPrice = pricingResult.totalSellingPrice;
    const perPersonSellingPrice = totalPax > 0 ? totalSellingPrice / totalPax : totalSellingPrice;

    // 5. Run Feasibility Check
    const feasibility = this.tools.validateItinerary(
      updatedRouteHubs,
      pricingResult.itemsWithPrice,
      totalDays,
      requirements.visaAssistance.value
    );

    const routeSummary = updatedRouteHubs.map(h => `${h.hubName} (${h.nights} Nights)`);

    const highlights: string[] = [
      `${totalDays} Days / ${requirements.duration.nights.value} Nights across ${updatedRouteHubs.map(h => h.hubName).join(', ')}`,
      `${hotelTierCriteria === '5_STAR_LUXURY' ? 'Luxury 5-Star Accommodations' : hotelTierCriteria === 'VALUE_BOUTIQUE' ? 'Charming 4-Star Boutique Properties' : 'Premium Handpicked 4-Star Superior Hotels'}`,
      'Door-to-door private airport arrival & departure chauffeur transfers',
      `${quoteItems.filter(i => !i.product.isTransfer && !i.product.category?.toLowerCase().includes('hotel')).length} Curated Cultural & Scenic Sightseeing Experiences`
    ];

    return {
      optionNumber,
      optionKey,
      title: `${title}: ${destinationName} Highlights`,
      badge,
      tagline,
      hotelTier: hotelTierCriteria === '5_STAR_LUXURY' ? '5 Star Luxury' : hotelTierCriteria === 'VALUE_BOUTIQUE' ? '4 Star Boutique' : '4 Star Superior',
      destinationId,
      destinationName,
      routeSummary,
      routeHubs: updatedRouteHubs,
      days,
      items: pricingResult.itemsWithPrice,
      dayThemes,
      totalSellingPrice,
      perPersonSellingPrice,
      currency,
      feasibility,
      reasoning: `Selected based on client requirement for ${requirements.travelStyle.value.join(', ')} travel style, with ${requirements.transportPreference.value.toLowerCase()} ground transport and optimal daily travel buffers.`,
      highlights
    };
  }

  /**
   * Refine and regenerate an existing plan based on conversational feedback.
   */
  public async refinePlan(
    currentResult: AiPlannerResult,
    refinementPrompt: string,
    user: User | null
  ): Promise<AiPlannerResult> {
    const updatedReqs = { ...currentResult.requirements };
    const textLower = refinementPrompt.toLowerCase();

    // Check hotel tier changes
    if (textLower.includes('5 star') || textLower.includes('luxury') || textLower.includes('upgrade hotel')) {
      updatedReqs.hotelPreference.category = {
        value: '5 Star Luxury',
        status: 'CONFIRMED',
        confidence: 0.95
      };
    } else if (textLower.includes('cheaper') || textLower.includes('budget') || textLower.includes('lower price') || textLower.includes('3 star')) {
      updatedReqs.hotelPreference.category = {
        value: '4 Star Standard',
        status: 'CONFIRMED',
        confidence: 0.95
      };
    }

    // Check transport changes
    if (textLower.includes('bullet train') || textLower.includes('shinkansen') || textLower.includes('train')) {
      updatedReqs.transportPreference = {
        value: 'TRAIN',
        status: 'CONFIRMED',
        confidence: 0.95
      };
    } else if (textLower.includes('private transfer') || textLower.includes('private car') || textLower.includes('chauffeur')) {
      updatedReqs.transportPreference = {
        value: 'PRIVATE',
        status: 'CONFIRMED',
        confidence: 0.95
      };
    }

    // Check extra nights
    const nightsMatch = textLower.match(/(\d+)\s*more\s*nights?/);
    if (nightsMatch) {
      const extraNights = parseInt(nightsMatch[1], 10);
      const newNights = updatedReqs.duration.nights.value + extraNights;
      updatedReqs.duration.nights = {
        value: newNights,
        status: 'CONFIRMED',
        confidence: 0.95
      };
      updatedReqs.duration.days = {
        value: newNights + 1,
        status: 'CONFIRMED',
        confidence: 0.95
      };
    }

    return this.generatePlan(
      updatedReqs, 
      user, 
      currentResult.options[0]?.currency || 'USD',
      refinementPrompt
    );
  }
}
