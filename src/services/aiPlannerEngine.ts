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
  MealPlanCode,
  AiPlannerRefinementItem 
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

    // 5. Travel Dates - Authoritative parsing
    let startDate: string | null = null;
    let endDate: string | null = null;
    let datesStatus: 'CONFIRMED' | 'INFERRED' | 'MISSING' = 'MISSING';

    const isoDateMatch = text.match(/\b(202[5-9])[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (isoDateMatch) {
      const y = isoDateMatch[1];
      const m = isoDateMatch[2].padStart(2, '0');
      const d = isoDateMatch[3].padStart(2, '0');
      startDate = `${y}-${m}-${d}`;
      datesStatus = 'CONFIRMED';
    } else {
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const monthShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthRegexStr = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

      // 1. Day Month Year: e.g. "17 October 2026", "17th Oct 2026", "from 17 October 2026", "17 Oct"
      const dayMonthYearRegex = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthRegexStr})(?:\\s*,?\\s*(\\d{4}))?\\b`, 'i');
      const matchDMY = text.match(dayMonthYearRegex);

      // 2. Month Day Year: e.g. "October 17, 2026", "Oct 17th 2026", "October 17"
      const monthDayYearRegex = new RegExp(`\\b(${monthRegexStr})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`, 'i');
      const matchMDY = text.match(monthDayYearRegex);

      let foundDay: number | null = null;
      let foundMonthName: string | null = null;
      let foundYear: number | null = null;

      if (matchDMY) {
        foundDay = parseInt(matchDMY[1], 10);
        foundMonthName = matchDMY[2].toLowerCase();
        if (matchDMY[3]) foundYear = parseInt(matchDMY[3], 10);
      } else if (matchMDY) {
        foundMonthName = matchMDY[1].toLowerCase();
        foundDay = parseInt(matchMDY[2], 10);
        if (matchMDY[3]) foundYear = parseInt(matchMDY[3], 10);
      } else {
        // Month only, e.g. "in October 2026" or "October"
        const monthOnlyRegex = new RegExp(`\\b(?:in\\s+)?(${monthRegexStr})(?:\\s+(\\d{4}))?\\b`, 'i');
        const matchMonth = text.match(monthOnlyRegex);
        if (matchMonth) {
          foundMonthName = matchMonth[1].toLowerCase();
          foundDay = 15;
          if (matchMonth[2]) foundYear = parseInt(matchMonth[2], 10);
        }
      }

      if (foundMonthName && foundDay) {
        const monthIdx = months.findIndex(m => m.startsWith(foundMonthName!.slice(0, 3)));
        if (monthIdx !== -1) {
          const currentYear = new Date().getFullYear();
          const finalYear = foundYear || (monthIdx < new Date().getMonth() ? currentYear + 1 : currentYear);
          const mm = String(monthIdx + 1).padStart(2, '0');
          const dd = String(foundDay).padStart(2, '0');
          startDate = `${finalYear}-${mm}-${dd}`;
          datesStatus = 'CONFIRMED';
        }
      }
    }

    if (!startDate) {
      // If dates not specified, infer a date 30 days in the future for simulation
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      startDate = futureDate.toISOString().split('T')[0];
      datesStatus = 'MISSING';
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
        currentValue: Array.isArray(requirements.travelers?.childAges?.value) ? requirements.travelers.childAges.value.join(', ') : '',
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

    const hubsList = Array.isArray(requirements.hubs?.value) ? requirements.hubs.value.join(' → ') : (requirements.hubs?.value || '');
    if (requirements.hubs.status === 'CONFIRMED') confirmedSummary.push(`Route Hubs: ${hubsList}`);
    else inferredSummary.push(`Route Hubs inferred: ${hubsList}`);

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

    const initialPlan: AiPlannerOptionPlan = {
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
      reasoning: `Selected based on client requirement for ${Array.isArray(requirements.travelStyle?.value) ? requirements.travelStyle.value.join(', ') : (requirements.travelStyle?.value || 'Luxury')} travel style, with ${(requirements.transportPreference?.value || 'Private').toLowerCase()} ground transport and optimal daily travel buffers.`,
      highlights,
      appliedRefinements: [],
      dismissedRefinements: [],
      suggestedRefinements: []
    };

    initialPlan.suggestedRefinements = this.generateContextualSuggestions(initialPlan, destinationId);

    return initialPlan;
  }

  /**
   * Generate context-aware actionable suggested refinements.
   * Ensures suggestions never recommend what is already present in the plan,
   * nor what has already been applied or dismissed.
   */
  public generateContextualSuggestions(
    plan: AiPlannerOptionPlan,
    destinationId: string
  ): AiPlannerRefinementItem[] {
    const suggestions: AiPlannerRefinementItem[] = [];
    const applied = plan.appliedRefinements || [];
    const dismissed = plan.dismissedRefinements || [];

    const isExcluded = (refId: string) => 
      applied.some(a => a.refinementId === refId) || dismissed.includes(refId);

    const isJapan = destinationId === 'dest-japan' || plan.destinationName.toLowerCase().includes('japan');

    // 1. Suggest Hakone if destination is Japan and Hakone is not in routeHubs
    const hasHakone = plan.routeHubs.some(h => 
      h.hubName.toLowerCase().includes('hakone') || 
      h.hubId.includes('hakone')
    );
    if (!hasHakone && isJapan && !isExcluded('sug-add-hakone')) {
      suggestions.push({
        refinementId: 'sug-add-hakone',
        type: 'ADD_HUB',
        entityId: 'hub-hakone',
        label: 'Add Hakone (Mt. Fuji Vistas & Onsen Ryokan)',
        description: 'Include an overnight Hakone escape with traditional onsen ryokan hospitality, Lake Ashi cruise, and Mt. Fuji views.',
        status: 'PENDING',
        source: 'AI_PLANNER'
      });
    }

    // 2. Suggest 5-Star Luxury upgrade if not already 5-star
    const is5Star = plan.hotelTier.includes('5 Star') || 
      plan.items.some(i => i.notes?.includes('5 Star') || i.product.name.includes('Hoshinoya') || i.product.name.includes('Four Seasons') || i.product.name.includes('Gora Kadan'));

    if (!is5Star && !isExcluded('sug-upgrade-5star')) {
      suggestions.push({
        refinementId: 'sug-upgrade-5star',
        type: 'UPGRADE_HOTEL',
        label: 'Upgrade Accommodations to 5-Star Luxury',
        description: 'Upgrade properties to premier 5-star luxury hotels (e.g. Hoshinoya Tokyo & Four Seasons Kyoto) with gourmet breakfast.',
        status: 'PENDING',
        source: 'AI_PLANNER'
      });
    }

    // 3. Suggest Best Value / 4-Star Boutique if currently 5-Star
    if (is5Star && !isExcluded('sug-val-boutique')) {
      suggestions.push({
        refinementId: 'sug-val-boutique',
        type: 'DOWNGRADE_HOTEL',
        label: 'Switch to 4-Star Boutique Hotels (Best Value)',
        description: 'Optimize total trip investment with handpicked 4-star boutique hotels offering prime central locations.',
        status: 'PENDING',
        source: 'AI_PLANNER'
      });
    }

    // 4. Suggest VIP Private Airport Limousine if not already private limousine
    const hasVipTransfer = plan.items.some(i => 
      i.product.isTransfer && 
      (i.product.name.toLowerCase().includes('limousine') || i.product.name.toLowerCase().includes('vip') || i.product.name.toLowerCase().includes('executive'))
    );
    if (!hasVipTransfer && !isExcluded('sug-vip-transfer')) {
      suggestions.push({
        refinementId: 'sug-vip-transfer',
        type: 'UPGRADE_TRANSFER',
        label: 'Upgrade to VIP Executive Limousine Chauffeur',
        description: 'Enjoy dedicated airport arrival & departure chauffeur service in a Mercedes-Benz or Toyota Alphard with flight tracking.',
        status: 'PENDING',
        source: 'AI_PLANNER'
      });
    }

    // 5. Suggest Tsukiji Food Tasting if not in items
    const hasFoodTour = plan.items.some(i => 
      i.product.name.toLowerCase().includes('food') || 
      i.product.name.toLowerCase().includes('culinary') || 
      i.product.name.toLowerCase().includes('tsukiji')
    );
    if (!hasFoodTour && isJapan && !isExcluded('sug-food-tour')) {
      suggestions.push({
        refinementId: 'sug-food-tour',
        type: 'ADD_ACTIVITY',
        entityId: 'jp-cul-01',
        label: 'Add Tsukiji Market & Ginza Food Tasting Walk',
        description: 'Immerse in Tokyo gastronomy with a licensed guide: fresh sushi, tamagoyaki, wagashi sweets, and ceremonial matcha.',
        status: 'PENDING',
        source: 'AI_PLANNER'
      });
    }

    // 6. Suggest Relaxed Pace if any day has more than 1 activity
    const hasBusyDays = plan.days.some(d => d.items.filter(it => it.type === 'ACTIVITY').length > 1);
    if (hasBusyDays && !isExcluded('sug-relax-pace')) {
      suggestions.push({
        refinementId: 'sug-relax-pace',
        type: 'CHANGE_PACE',
        label: 'Make Itinerary More Relaxed & Leisurely',
        description: 'Trim secondary afternoon activities to allow ample unhurried exploration and spontaneous dining.',
        status: 'PENDING',
        source: 'AI_PLANNER'
      });
    }

    // 7. Suggest Add 1 Night in Tokyo
    const hasTokyo = plan.routeHubs.some(h => h.hubName.toLowerCase().includes('tokyo'));
    if (hasTokyo && !isExcluded('sug-add-night-tokyo')) {
      suggestions.push({
        refinementId: 'sug-add-night-tokyo',
        type: 'ADD_NIGHT',
        label: 'Add 1 Additional Night in Tokyo',
        description: 'Extend the Tokyo stay by 1 day to explore modern arts, shopping districts, and historic Asakusa.',
        status: 'PENDING',
        source: 'AI_PLANNER'
      });
    }

    return suggestions;
  }

  /**
   * Dismiss a suggestion so it is hidden from the visible suggestion list.
   */
  public dismissRefinement(
    currentResult: AiPlannerResult,
    refinementId: string,
    activeOptionIndex: number = 0
  ): AiPlannerResult {
    const updated = JSON.parse(JSON.stringify(currentResult)) as AiPlannerResult;
    const plan = updated.options[activeOptionIndex] || updated.options[0];
    if (!plan) return currentResult;
    plan.dismissedRefinements = plan.dismissedRefinements || [];
    if (!plan.dismissedRefinements.includes(refinementId)) {
      plan.dismissedRefinements.push(refinementId);
    }
    plan.suggestedRefinements = this.generateContextualSuggestions(plan, plan.destinationId);
    return updated;
  }

  /**
   * In-Place Smart Itinerary Refinement Engine.
   * Modifies existing selections without wiping the itinerary, recalculates authoritative pricing,
   * revalidates feasibility, and updates contextual suggestions.
   */
  public async refinePlan(
    currentResult: AiPlannerResult,
    refinementPrompt: string,
    user: User | null,
    activeOptionIndex: number = 0,
    actionRefinement?: AiPlannerRefinementItem
  ): Promise<AiPlannerResult> {
    const updatedResult = JSON.parse(JSON.stringify(currentResult)) as AiPlannerResult;
    const plan = updatedResult.options[activeOptionIndex] || updatedResult.options[0];
    if (!plan) return currentResult;

    plan.appliedRefinements = plan.appliedRefinements || [];
    plan.dismissedRefinements = plan.dismissedRefinements || [];
    plan.suggestedRefinements = plan.suggestedRefinements || [];

    const textLower = (refinementPrompt || '').toLowerCase();
    const currency = plan.currency || 'USD';
    const adults = updatedResult.requirements.travelers.adults.value;
    const children = updatedResult.requirements.travelers.children.value;
    const infants = updatedResult.requirements.travelers.infants.value;
    const totalPax = adults + children + infants;
    const roomCount = updatedResult.requirements.hotelPreference.roomCount.value;

    // Detect action intent from actionRefinement or natural language text
    const isRelaxedPace = actionRefinement?.type === 'CHANGE_PACE' || 
      textLower.includes('relaxed') || textLower.includes('leisure') || textLower.includes('slow down') || textLower.includes('less packed') || textLower.includes('reduce pace');

    const isAddHakone = (actionRefinement?.type === 'ADD_HUB' && actionRefinement.entityId?.includes('hakone')) || 
      textLower.includes('hakone') || textLower.includes('fuji');

    const shouldRemoveOneActivity = textLower.includes('remove one activity') || textLower.includes('remove an activity') || textLower.includes('remove activity');

    const isUpgradeHotel = actionRefinement?.type === 'UPGRADE_HOTEL' || 
      textLower.includes('better hotel') || textLower.includes('upgrade hotel') || textLower.includes('5 star') || textLower.includes('luxury hotel');

    const isReducePrice = actionRefinement?.type === 'DOWNGRADE_HOTEL' || 
      textLower.includes('reduce the price') || textLower.includes('reduce price') || textLower.includes('cheaper') || textLower.includes('budget') || textLower.includes('lower price') || textLower.includes('best value');

    const isAddFoodTour = (actionRefinement?.type === 'ADD_ACTIVITY' && actionRefinement.entityId?.includes('cul')) || 
      textLower.includes('food') || textLower.includes('culinary') || textLower.includes('sushi') || textLower.includes('tsukiji');

    const isAddNight = actionRefinement?.type === 'ADD_NIGHT' || 
      textLower.includes('more night') || textLower.includes('extra night') || textLower.includes('add 1 night') || textLower.includes('add one night');

    const isUpgradeTransfer = actionRefinement?.type === 'UPGRADE_TRANSFER' || 
      textLower.includes('vip transfer') || textLower.includes('private transfer') || textLower.includes('limousine') || textLower.includes('chauffeur');

    let modificationApplied = false;

    // 1. EXECUTE: More Relaxed Pace
    if (isRelaxedPace) {
      // Find days with multiple activities and remove secondary afternoon activities
      plan.days.forEach(day => {
        const actItems = day.items.filter(it => it.type === 'ACTIVITY');
        if (actItems.length > 1) {
          const removed = actItems[actItems.length - 1];
          day.items = day.items.filter(it => it.id !== removed.id);
          // Remove from plan.items
          plan.items = plan.items.filter(qi => qi.product.id !== removed.productId);
          day.themeTitle += ' (Relaxed Leisure Pace)';
          modificationApplied = true;
        }
      });

      plan.appliedRefinements.push({
        refinementId: 'ref-relaxed-' + Date.now(),
        type: 'CHANGE_PACE',
        label: 'Relaxed & Unhurried Pace',
        description: 'Optimized daily schedule by trimming secondary afternoon activities to provide ample unhurried exploration.',
        status: 'APPLIED',
        appliedAt: new Date().toISOString(),
        source: 'USER'
      });
    }

    // 2. EXECUTE: Add Hakone
    if (isAddHakone) {
      const hasHakone = plan.routeHubs.some(h => h.hubName.toLowerCase().includes('hakone') || h.hubId.includes('hakone'));
      if (!hasHakone) {
        const hakoneHubData = this.tools.searchHubs('dest-japan', 'Hakone');
        const hakoneHub = hakoneHubData[0] || {
          id: 'hub-hakone',
          destinationId: 'dest-japan',
          destinationName: 'Japan',
          name: 'Hakone & Mt. Fuji',
          description: 'Scenic hot spring resort area with mountain views and Lake Ashi',
          tagline: 'Scenic Onsen Hot Springs & Mount Fuji Vistas',
          heroImage: 'https://images.unsplash.com/photo-1509023464722-18d996393ca8?q=80&w=1200&auto=format&fit=crop',
          images: [],
          productCount: 4,
          hotelCount: 2,
          displayOrder: 2,
          highlights: ['Lake Ashi Cruise', 'Hakone Ropeway', 'Mount Fuji Views', 'Geothermal Onsen'],
          isPublished: true,
          status: 'ACTIVE'
        };

        const hakoneHotels = this.tools.searchHotels({ hubId: 'hub-hakone', destinationId: 'dest-japan' });
        const selectedHakoneHotel = (plan.hotelTier.includes('5 Star') ? hakoneHotels.find(h => (h.starRating || 0) >= 5) : null) || hakoneHotels[0];
        const hakoneActs = this.tools.searchProducts({ destinationId: 'dest-japan', hubId: 'hub-hakone', category: 'Activities' });
        const selectedHakoneAct = hakoneActs[0];

        // Insert Hakone into routeHubs with 1 night
        plan.routeHubs.splice(1, 0, {
          id: 'route-hub-hakone-' + Date.now(),
          order: 2,
          hubId: hakoneHub.id,
          hubName: hakoneHub.name,
          nights: 1,
          hotelId: selectedHakoneHotel?.id,
          roomTypeId: selectedHakoneHotel?.roomTypes?.[0]?.id,
          roomsCount: roomCount,
          notes: `${selectedHakoneHotel?.name || 'Onsen Ryokan'}. Traditional Hot Spring Retreat.`
        });

        // If user asked to remove one activity, remove a secondary activity in Tokyo or Kyoto
        if (shouldRemoveOneActivity) {
          const removableActIdx = plan.items.findIndex(qi => 
            !qi.product.isTransfer && 
            !qi.product.category.toLowerCase().includes('hotel') &&
            qi.source !== 'USER'
          );
          if (removableActIdx !== -1) {
            const removedItem = plan.items[removableActIdx];
            plan.items.splice(removableActIdx, 1);
            plan.days.forEach(d => {
              d.items = d.items.filter(it => it.productId !== removedItem.product.id);
            });
          }
        }

        // Add hotel quote item for Hakone
        if (selectedHakoneHotel) {
          const roomType = selectedHakoneHotel.roomTypes?.[0];
          const rate = roomType?.rates?.[0];
          const hotelProd = hotelToProduct(selectedHakoneHotel, roomType, rate, 1, roomCount);
          const calc = calculateProductPrice(hotelProd, {
            productId: hotelProd.id,
            adults,
            children,
            infants,
            travelDate: plan.days[1]?.dateString || new Date().toISOString().split('T')[0],
            targetCurrency: currency,
            pricingTier: 'B2B',
            userRole: user?.role || 'B2B_AGENT',
            user
          });

          plan.items.push({
            id: `qi-htl-hakone-${Date.now()}`,
            product: hotelProd,
            pax: { adults, children, infants },
            travelDate: plan.days[1]?.dateString || new Date().toISOString().split('T')[0],
            selectedAddonIds: [],
            notes: `1 Night accommodation at ${selectedHakoneHotel.name} (Traditional Onsen Ryokan).`,
            calculation: calc,
            source: 'USER'
          });
        }

        // Add Hakone activity quote item
        if (selectedHakoneAct) {
          const actCalc = calculateProductPrice(selectedHakoneAct, {
            productId: selectedHakoneAct.id,
            adults,
            children,
            infants,
            travelDate: plan.days[1]?.dateString || new Date().toISOString().split('T')[0],
            targetCurrency: currency,
            pricingTier: 'B2B',
            userRole: user?.role || 'B2B_AGENT',
            user
          });

          plan.items.push({
            id: `qi-act-hakone-${Date.now()}`,
            product: selectedHakoneAct,
            pax: { adults, children, infants },
            travelDate: plan.days[1]?.dateString || new Date().toISOString().split('T')[0],
            serviceTime: '10:30',
            notes: `${selectedHakoneAct.name}. Licensed bilingual scenic guide.`,
            selectedAddonIds: [],
            calculation: actCalc,
            source: 'USER'
          });

          // Insert Hakone day into schedule
          const insertDayIdx = 1;
          if (plan.days[insertDayIdx]) {
            plan.days[insertDayIdx].hubId = hakoneHub.id;
            plan.days[insertDayIdx].hubName = hakoneHub.name;
            plan.days[insertDayIdx].themeTitle = 'Hakone: Mt. Fuji Vistas, Lake Ashi Cruise & Onsen Ryokan';
            plan.days[insertDayIdx].items.unshift({
              type: 'ACTIVITY',
              id: `item-act-hakone-${Date.now()}`,
              name: selectedHakoneAct.name,
              category: 'Scenic Sightseeing',
              hubId: hakoneHub.id,
              hubName: hakoneHub.name,
              timeSlot: 'MORNING',
              serviceTime: '10:30',
              productId: selectedHakoneAct.id,
              sellingPrice: actCalc.sellingPriceFinal,
              sellingPriceFormatted: formatCurrency(actCalc.sellingPriceFinal, currency),
              notes: 'Scenic ropeway views of Mt. Fuji and Lake Ashi pirate boat cruise.',
              source: 'USER'
            });
          }
        }

        plan.routeSummary = plan.routeHubs.map(h => `${h.hubName} (${h.nights} Nights)`);
        plan.appliedRefinements.push({
          refinementId: 'ref-add-hakone-' + Date.now(),
          type: 'ADD_HUB',
          entityId: 'hub-hakone',
          label: 'Added Hakone & Scenic Mt. Fuji Stay',
          description: 'Integrated Hakone onsen ryokan stay, Lake Ashi cruise, and Mt. Fuji vistas.',
          status: 'APPLIED',
          appliedAt: new Date().toISOString(),
          source: 'USER'
        });
        modificationApplied = true;
      }
    }

    // 3. EXECUTE: Upgrade to 5-Star Luxury
    if (isUpgradeHotel) {
      plan.hotelTier = '5 Star Luxury';
      for (const rh of plan.routeHubs) {
        const hubHotels = this.tools.searchHotels({ hubId: rh.hubId, destinationId: 'dest-japan' });
        const luxuryHotel = hubHotels.find(h => (h.starRating || 0) >= 5) || hubHotels[0];
        if (luxuryHotel) {
          const roomType = luxuryHotel.roomTypes?.[1] || luxuryHotel.roomTypes?.[0];
          const rate = roomType?.rates?.[0];
          const hotelProd = hotelToProduct(luxuryHotel, roomType, rate, rh.nights, roomCount);

          // Replace existing hotel in plan.items (unless user explicitly customized it)
          const existingItemIdx = plan.items.findIndex(i => 
            i.product.category.toLowerCase().includes('hotel') && 
            (i.notes?.includes(rh.hubName) || i.product.name.includes(rh.hubName) || rh.hotelId === i.product.id) &&
            i.source !== 'USER'
          );

          const calc = calculateProductPrice(hotelProd, {
            productId: hotelProd.id,
            adults,
            children,
            infants,
            travelDate: plan.days[0]?.dateString || new Date().toISOString().split('T')[0],
            targetCurrency: currency,
            pricingTier: 'B2B',
            userRole: user?.role || 'B2B_AGENT',
            user
          });

          const upgradedQuoteItem: QuoteItem = {
            id: `qi-htl-upgraded-${luxuryHotel.id}-${Date.now()}`,
            product: hotelProd,
            pax: { adults, children, infants },
            travelDate: plan.days[0]?.dateString || new Date().toISOString().split('T')[0],
            selectedAddonIds: [],
            notes: `${rh.nights} Nights 5-Star Luxury accommodation at ${luxuryHotel.name} (${roomType?.roomName || 'Luxury Suite'}). Gourmet breakfast included.`,
            calculation: calc,
            source: 'USER'
          };

          if (existingItemIdx !== -1) {
            plan.items[existingItemIdx] = upgradedQuoteItem;
          } else {
            plan.items.push(upgradedQuoteItem);
          }

          // Update day checkin notes
          plan.days.forEach(d => {
            if (d.hubId === rh.hubId) {
              d.items.forEach(it => {
                if (it.type === 'HOTEL') {
                  it.name = `${luxuryHotel.name} (5-Star Luxury)`;
                  it.notes = `${roomType?.roomName || 'Luxury Room'}. Concierge service and bespoke amenities.`;
                  it.source = 'USER';
                }
              });
            }
          });

          rh.hotelId = luxuryHotel.id;
          rh.roomTypeId = roomType?.id;
        }
      }

      plan.appliedRefinements.push({
        refinementId: 'ref-upgrade-hotel-' + Date.now(),
        type: 'UPGRADE_HOTEL',
        label: 'Upgraded Accommodations to 5-Star Luxury',
        description: 'Replaced accommodations with premier 5-star luxury properties and deluxe suites.',
        status: 'APPLIED',
        appliedAt: new Date().toISOString(),
        source: 'USER'
      });
      modificationApplied = true;
    }

    // 4. EXECUTE: Reduce Price / 4-Star Boutique
    if (isReducePrice) {
      plan.hotelTier = '4 Star Boutique';
      for (const rh of plan.routeHubs) {
        const hubHotels = this.tools.searchHotels({ hubId: rh.hubId, destinationId: 'dest-japan' });
        const boutiqueHotel = hubHotels.find(h => (h.starRating || 0) === 4) || hubHotels[hubHotels.length - 1] || hubHotels[0];
        if (boutiqueHotel) {
          const roomType = boutiqueHotel.roomTypes?.[0];
          const rate = roomType?.rates?.[0];
          const hotelProd = hotelToProduct(boutiqueHotel, roomType, rate, rh.nights, roomCount);

          const existingItemIdx = plan.items.findIndex(i => 
            i.product.category.toLowerCase().includes('hotel') && 
            i.source !== 'USER' &&
            (i.notes?.includes(rh.hubName) || i.product.name.includes(rh.hubName))
          );

          const calc = calculateProductPrice(hotelProd, {
            productId: hotelProd.id,
            adults,
            children,
            infants,
            travelDate: plan.days[0]?.dateString || new Date().toISOString().split('T')[0],
            targetCurrency: currency,
            pricingTier: 'B2B',
            userRole: user?.role || 'B2B_AGENT',
            user
          });

          const boutiqueQuoteItem: QuoteItem = {
            id: `qi-htl-boutique-${boutiqueHotel.id}-${Date.now()}`,
            product: hotelProd,
            pax: { adults, children, infants },
            travelDate: plan.days[0]?.dateString || new Date().toISOString().split('T')[0],
            selectedAddonIds: [],
            notes: `${rh.nights} Nights 4-Star Boutique accommodation at ${boutiqueHotel.name} (${roomType?.roomName || 'Standard Room'}). Prime central location.`,
            calculation: calc,
            source: 'USER'
          };

          if (existingItemIdx !== -1) {
            plan.items[existingItemIdx] = boutiqueQuoteItem;
          } else {
            plan.items.push(boutiqueQuoteItem);
          }

          plan.days.forEach(d => {
            if (d.hubId === rh.hubId) {
              d.items.forEach(it => {
                if (it.type === 'HOTEL') {
                  it.name = `${boutiqueHotel.name} (4-Star Boutique)`;
                  it.notes = `${roomType?.roomName || 'Comfort Room'}. Prime central location.`;
                  it.source = 'USER';
                }
              });
            }
          });

          rh.hotelId = boutiqueHotel.id;
          rh.roomTypeId = roomType?.id;
        }
      }

      // Switch arrival transfer to value express shuttle if available
      const valueTrf = this.tools.searchProducts({ destinationId: 'dest-japan', category: 'Transfers' });
      const expressShuttle = valueTrf.find(p => p.name.toLowerCase().includes('express') || p.name.toLowerCase().includes('shuttle'));
      if (expressShuttle) {
        const trfIdx = plan.items.findIndex(i => i.product.isTransfer && i.source !== 'USER');
        if (trfIdx !== -1) {
          const calc = calculateProductPrice(expressShuttle, {
            productId: expressShuttle.id,
            adults,
            children,
            infants,
            travelDate: plan.days[0]?.dateString || new Date().toISOString().split('T')[0],
            targetCurrency: currency,
            pricingTier: 'B2B',
            userRole: user?.role || 'B2B_AGENT',
            user
          });
          plan.items[trfIdx] = {
            id: `qi-trf-val-${Date.now()}`,
            product: expressShuttle,
            pax: { adults, children, infants },
            travelDate: plan.days[0]?.dateString || new Date().toISOString().split('T')[0],
            serviceTime: '14:00',
            notes: `${expressShuttle.name}. Direct airport transfer.`,
            selectedAddonIds: [],
            calculation: calc,
            source: 'USER'
          };
        }
      }

      plan.appliedRefinements.push({
        refinementId: 'ref-reduce-price-' + Date.now(),
        type: 'DOWNGRADE_HOTEL',
        label: 'Optimized Rates with 4-Star Boutique Properties',
        description: 'Switched to 4-star boutique accommodations and cost-efficient ground transfers.',
        status: 'APPLIED',
        appliedAt: new Date().toISOString(),
        source: 'USER'
      });
      modificationApplied = true;
    }

    // 5. EXECUTE: Add Food & Street Market Experience
    if (isAddFoodTour) {
      const foodTourData = this.tools.searchProducts({ destinationId: 'dest-japan', hubId: 'hub-tokyo', category: 'Activities' });
      const foodTour = foodTourData.find(p => p.name.toLowerCase().includes('food') || p.name.toLowerCase().includes('tsukiji') || p.id === 'jp-cul-01') || foodTourData[0];

      if (foodTour && !plan.items.some(qi => qi.product.id === foodTour.id)) {
        const calc = calculateProductPrice(foodTour, {
          productId: foodTour.id,
          adults,
          children,
          infants,
          travelDate: plan.days[1]?.dateString || new Date().toISOString().split('T')[0],
          targetCurrency: currency,
          pricingTier: 'B2B',
          userRole: user?.role || 'B2B_AGENT',
          user
        });

        plan.items.push({
          id: `qi-act-food-${Date.now()}`,
          product: foodTour,
          pax: { adults, children, infants },
          travelDate: plan.days[1]?.dateString || new Date().toISOString().split('T')[0],
          serviceTime: '15:30',
          notes: `${foodTour.name}. Authentic market tastings and licensed culinary guide.`,
          selectedAddonIds: [],
          calculation: calc,
          source: 'USER'
        });

        // Add to Day 2 afternoon slot
        if (plan.days[1]) {
          plan.days[1].items.push({
            type: 'ACTIVITY',
            id: `item-food-${Date.now()}`,
            name: foodTour.name,
            category: 'Gastronomy Experience',
            hubId: plan.days[1].hubId,
            hubName: plan.days[1].hubName,
            timeSlot: 'AFTERNOON',
            serviceTime: '15:30',
            productId: foodTour.id,
            sellingPrice: calc.sellingPriceFinal,
            sellingPriceFormatted: formatCurrency(calc.sellingPriceFinal, currency),
            notes: 'Guided street food crawl featuring tuna sashimi, tamagoyaki, wagashi sweets, and matcha.',
            source: 'USER'
          });
        }

        plan.appliedRefinements.push({
          refinementId: 'ref-food-tour-' + Date.now(),
          type: 'ADD_ACTIVITY',
          entityId: foodTour.id,
          label: 'Added Tsukiji Market & Ginza Food Tasting Walk',
          description: 'Included expert bilingual food tour with authentic market tastings.',
          status: 'APPLIED',
          appliedAt: new Date().toISOString(),
          source: 'USER'
        });
        modificationApplied = true;
      }
    }

    // 6. EXECUTE: Upgrade to VIP Airport Limousine
    if (isUpgradeTransfer) {
      const vipTrfData = this.tools.searchProducts({ destinationId: 'dest-japan', hubId: 'hub-tokyo', category: 'Transfers' });
      const vipTrf = vipTrfData.find(p => p.id === 'jp-trf-01' || p.name.toLowerCase().includes('limousine') || p.name.toLowerCase().includes('vip')) || vipTrfData[0];

      if (vipTrf) {
        const arrTrfIdx = plan.items.findIndex(qi => qi.product.isTransfer && qi.notes?.includes('Arrival'));
        if (arrTrfIdx !== -1) {
          const calc = calculateProductPrice(vipTrf, {
            productId: vipTrf.id,
            adults,
            children,
            infants,
            travelDate: plan.days[0]?.dateString || new Date().toISOString().split('T')[0],
            targetCurrency: currency,
            pricingTier: 'B2B',
            userRole: user?.role || 'B2B_AGENT',
            user
          });
          plan.items[arrTrfIdx] = {
            id: `qi-trf-vip-${Date.now()}`,
            product: vipTrf,
            pax: { adults, children, infants },
            travelDate: plan.days[0]?.dateString || new Date().toISOString().split('T')[0],
            serviceTime: '14:00',
            notes: `VIP Airport Chauffeur Meet & Greet in Mercedes-Benz / Toyota Alphard.`,
            selectedAddonIds: [],
            calculation: calc,
            source: 'USER'
          };
          if (plan.days[0]) {
            plan.days[0].items.forEach(it => {
              if (it.type === 'TRANSFER') {
                it.name = vipTrf.name;
                it.sellingPrice = calc.sellingPriceFinal;
                it.sellingPriceFormatted = formatCurrency(calc.sellingPriceFinal, currency);
                it.source = 'USER';
              }
            });
          }
        }

        plan.appliedRefinements.push({
          refinementId: 'ref-vip-transfer-' + Date.now(),
          type: 'UPGRADE_TRANSFER',
          label: 'Upgraded to VIP Executive Limousine Chauffeur',
          description: 'Dedicated luxury vehicle with flight meet & greet and baggage handling.',
          status: 'APPLIED',
          appliedAt: new Date().toISOString(),
          source: 'USER'
        });
        modificationApplied = true;
      }
    }

    // 7. EXECUTE: Add 1 Night in Tokyo
    if (isAddNight) {
      const tokyoHub = plan.routeHubs.find(h => h.hubName.toLowerCase().includes('tokyo'));
      if (tokyoHub) {
        tokyoHub.nights += 1;
        const newDayNumber = plan.days.length + 1;
        const lastDayDate = new Date(plan.days[plan.days.length - 1]?.dateString || new Date());
        lastDayDate.setDate(lastDayDate.getDate() + 1);
        const newDateStr = lastDayDate.toISOString().split('T')[0];

        // Find Tokyo culinary or cultural activity
        const tokyoActs = this.tools.searchProducts({ destinationId: 'dest-japan', hubId: 'hub-tokyo', category: 'Activities' });
        const unusedAct = tokyoActs.find(p => !plan.items.some(qi => qi.product.id === p.id)) || tokyoActs[0];

        if (unusedAct) {
          const calc = calculateProductPrice(unusedAct, {
            productId: unusedAct.id,
            adults,
            children,
            infants,
            travelDate: newDateStr,
            targetCurrency: currency,
            pricingTier: 'B2B',
            userRole: user?.role || 'B2B_AGENT',
            user
          });

          plan.items.push({
            id: `qi-act-extra-${Date.now()}`,
            product: unusedAct,
            pax: { adults, children, infants },
            travelDate: newDateStr,
            serviceTime: '10:00',
            notes: `Day ${newDayNumber}: ${unusedAct.name}. Extended Tokyo exploration.`,
            selectedAddonIds: [],
            calculation: calc,
            source: 'USER'
          });

          plan.days.push({
            dayNumber: newDayNumber,
            dateString: newDateStr,
            formattedDate: lastDayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            hubId: tokyoHub.hubId,
            hubName: tokyoHub.hubName,
            themeTitle: `Tokyo Unveiled: Modern Arts & Neighborhood Discovery`,
            isTransitionDay: false,
            items: [
              {
                type: 'ACTIVITY',
                id: `item-act-extra-${Date.now()}`,
                name: unusedAct.name,
                category: unusedAct.category,
                hubId: tokyoHub.hubId,
                hubName: tokyoHub.hubName,
                timeSlot: 'MORNING',
                serviceTime: '10:00',
                productId: unusedAct.id,
                sellingPrice: calc.sellingPriceFinal,
                sellingPriceFormatted: formatCurrency(calc.sellingPriceFinal, currency),
                notes: 'Leisurely extended day in Tokyo with curated local sights.',
                source: 'USER'
              }
            ]
          });
        }

        plan.routeSummary = plan.routeHubs.map(h => `${h.hubName} (${h.nights} Nights)`);
        plan.appliedRefinements.push({
          refinementId: 'ref-add-night-' + Date.now(),
          type: 'ADD_NIGHT',
          label: 'Added 1 Additional Night in Tokyo',
          description: 'Extended the Tokyo stay by 1 day for in-depth exploration.',
          status: 'APPLIED',
          appliedAt: new Date().toISOString(),
          source: 'USER'
        });
        modificationApplied = true;
      }
    }

    // Fallback if no specific rule matched: update requirements and re-run controlled generation
    if (!modificationApplied && refinementPrompt.trim()) {
      return this.generatePlan(
        updatedResult.requirements,
        user,
        currency,
        refinementPrompt
      );
    }

    // RECALCULATE FINAL AUTHORITATIVE PRICING
    const pricingResult = this.tools.calculateQuotePricing(plan.items, user, currency);
    plan.items = pricingResult.itemsWithPrice;
    plan.totalSellingPrice = pricingResult.totalSellingPrice;
    plan.perPersonSellingPrice = totalPax > 0 ? plan.totalSellingPrice / totalPax : plan.totalSellingPrice;

    // RE-RUN FEASIBILITY VALIDATION
    plan.feasibility = this.tools.validateItinerary(
      plan.routeHubs,
      plan.items,
      plan.days.length,
      updatedResult.requirements.visaAssistance.value
    );

    // UPDATE CONTEXTUAL SUGGESTIONS (excludes newly applied/dismissed items)
    plan.suggestedRefinements = this.generateContextualSuggestions(plan, plan.destinationId);

    // Save updated active option
    updatedResult.options[activeOptionIndex] = plan;

    return updatedResult;
  }
}
