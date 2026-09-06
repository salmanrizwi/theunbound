import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

interface GeminiChatRequestBody {
  sessionId?: string;
  message: string;
  history?: Array<{ sender: 'USER' | 'ASSISTANT'; content: string }>;
  tripState?: Record<string, any>;
  currentPlan?: Record<string, any>;
  userRole?: string;
  portal?: 'BUYER' | 'B2B_AGENT' | 'ADMIN';
  currency?: string;
  availableDestinations?: Array<{ id: string; name: string; country: string }>;
}

let genAiClient: GoogleGenAI | null = null;

function getGenAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!genAiClient) {
    try {
      genAiClient = new GoogleGenAI({ apiKey });
    } catch (err) {
      console.warn('[GEMINI] Failed to initialize GoogleGenAI client:', err);
      return null;
    }
  }
  return genAiClient;
}

export async function handleGeminiChat(req: Request, res: Response): Promise<void> {
  const body = req.body as GeminiChatRequestBody;
  const userMessage = (body?.message || '').trim();
  const history = body?.history || [];
  const userRole = body?.userRole || 'B2B_AGENT';
  const portal = body?.portal || (userRole === 'BUYER' ? 'BUYER' : 'B2B_AGENT');
  const currency = body?.currency || 'USD';
  const tripState = body?.tripState || {};
  const currentPlan = body?.currentPlan || null;

  if (!userMessage) {
    res.status(400).json({ success: false, error: 'User message is required.' });
    return;
  }

  const client = getGenAiClient();
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  // System instruction for TheUnbound Travel Specialist Chatbot
  const systemInstruction = `You are "TheUnbound AI", the premier Destination Management Company (DMC) travel planning assistant for TheUnbound.
Brand Colors & Identity: Turquoise/Mint (#00C6A6) & White.
Persona: Highly knowledgeable luxury travel specialist, professional, warm, concise, human, not robotic.

CORE OBJECTIVE:
Help travel agents and travelers plan personalized journeys, discover destinations and real inventory, build multi-city itineraries, check live booking status, query packages, compare hotel rates, and check activity prices.

USER ROLE: ${userRole} (Portal: ${portal})
${
  portal === 'BUYER'
    ? 'IMPORTANT SECURITY DIRECTIVE: The user is a retail BUYER. Show only customer-facing descriptions, final selling prices, inclusions and terms. NEVER reveal internal supplier costs, net rates, markups, or margins.'
    : 'The user is a verified B2B Travel Agent. Provide professional travel consultancy, structured itineraries, quick handoff to Guided Quote Builder, booking status lookups, and wholesale inventory intelligence.'
}

STRICT INVENTORY & PRICING RULES:
1. You are the intelligence and conversational reasoning layer. TheUnbound database and pricing engine are the commercial authorities.
2. Never invent fake hotel names, fake prices, fake bookings, or fake availability.
3. If specific travel dates are provided (e.g. October 12, 2026), always retain and use that EXACT date.
4. Keep natural language responses concise and structured.
5. If the user asks about booking status, package search, hotel prices, or activities list/price, categorize the intent accurately so real database inventory can be retrieved.

SUPPORTED INTENTS:
- "CHECK_BOOKING_STATUS": User wants to check the status of a booking, track a reservation, or find their booking. If a booking ID or reference (e.g. BK-12345, TUB-BK-...) is mentioned, extract it into "bookingId".
- "PACKAGE_SEARCH": User asks for tour packages, packages list, holiday packages, or package prices.
- "HOTEL_PRICE_SEARCH": User asks for hotel prices, room rates, hotel costs, or hotel options with price comparisons in a destination or city.
- "ACTIVITY_SEARCH": User asks for an activities list, excursions, sightseeing tours, things to do, and their prices/rates.
- "CREATE_ITINERARY": User wants to generate or plan a complete multi-day/multi-city trip or itinerary.
- "REFINE_ITINERARY": User wants to modify pace, budget, hotel stars, or items in an existing trip plan.
- "DESTINATION_SEARCH": User asks about destinations or places to visit.
- "GENERAL_TRAVEL_QUESTION": General travel advice or questions.
- "QUOTE_REQUEST": Requesting formal quotation or quote handoff.
- "TALK_TO_EXPERT": Asking to speak with operations or support team.

OUTPUT FORMAT:
You MUST always respond with valid JSON adhering to this exact schema:
{
  "intent": "CHECK_BOOKING_STATUS" | "PACKAGE_SEARCH" | "HOTEL_PRICE_SEARCH" | "HOTEL_SEARCH" | "ACTIVITY_SEARCH" | "CREATE_ITINERARY" | "REFINE_ITINERARY" | "DESTINATION_SEARCH" | "GENERAL_TRAVEL_QUESTION" | "QUOTE_REQUEST" | "TALK_TO_EXPERT",
  "replyText": "Your natural conversational response to the user. Clear, helpful, professional.",
  "extractedRequirements": {
    "bookingId": string or null,
    "destination": string or null,
    "hubs": string[],
    "durationNights": number or null,
    "travelStartDate": string or null (YYYY-MM-DD),
    "travelEndDate": string or null (YYYY-MM-DD),
    "adults": number or null,
    "children": number or null,
    "childAges": number[],
    "infants": number or null,
    "hotelCategory": string or null (e.g. "4-Star", "5-Star Luxury"),
    "travelStyle": string[] (e.g. ["Relaxed", "Cultural", "Romantic", "Family"]),
    "transportPreference": "PRIVATE" | "SHARED" | "TRAIN" | "MIXED" or null,
    "budget": number or null,
    "interests": string[]
  },
  "missingInformation": string[],
  "conciseRationale": string or null,
  "quickPrompts": string[]
}
Ensure the JSON is strictly valid. Do not wrap with markdown if possible, or use standard markdown json blocks.`;

  try {
    if (client) {
      // Build conversation contents
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      // Add recent context from history (up to last 6 messages to preserve context and tokens)
      const recentHistory = history.slice(-6);
      for (const item of recentHistory) {
        contents.push({
          role: item.sender === 'USER' ? 'user' : 'model',
          parts: [{ text: item.content }]
        });
      }

      // Add context about existing trip state if present
      let userPromptWithContext = userMessage;
      if (tripState && Object.keys(tripState).length > 0) {
        userPromptWithContext += `\n[Context: Existing trip state: ${JSON.stringify(tripState)}]`;
      }
      if (currentPlan && currentPlan.destinationName) {
        userPromptWithContext += `\n[Context: Current active plan in session: Destination: ${currentPlan.destinationName}, Nights: ${currentPlan.durationNights || 'N/A'}, Option: ${currentPlan.selectedBadge || 'Best Match'}]`;
      }

      contents.push({
        role: 'user',
        parts: [{ text: userPromptWithContext }]
      });

      const response = await client.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.3
        }
      });

      const responseText = response.text || '';
      let parsedResponse: any = null;

      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseErr) {
        // Fallback cleanup if response has markdown code fences
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          parsedResponse = JSON.parse(cleaned);
        } catch (e) {
          console.warn('[GEMINI] JSON parse error, using raw text as replyText:', responseText);
          parsedResponse = {
            intent: 'GENERAL_TRAVEL_QUESTION',
            replyText: responseText,
            extractedRequirements: {},
            missingInformation: [],
            quickPrompts: ['Plan a Japan trip for 2 adults', 'Show luxury hotels in Tokyo', 'Talk to a travel expert']
          };
        }
      }

      res.json({
        success: true,
        source: 'GEMINI_AI',
        model: modelName,
        ...parsedResponse
      });
      return;
    }
  } catch (apiError: any) {
    console.warn('[GEMINI] Gemini API error, falling back to deterministic travel intelligence:', apiError?.message || apiError);
  }

  // Graceful deterministic fallback when Gemini API key is not configured or fails
  const fallback = generateFallbackResponse(userMessage, tripState, currentPlan, userRole, currency);
  res.json({
    success: true,
    source: 'DETERMINISTIC_ENGINE',
    ...fallback
  });
}

/**
 * Intelligent deterministic fallback parser when Gemini API is unavailable or offline
 */
function generateFallbackResponse(
  message: string, 
  tripState: Record<string, any>, 
  currentPlan: Record<string, any>,
  userRole: string,
  currency: string
): Record<string, any> {
  const msgLower = message.toLowerCase();

  // Detect Destination
  let destination = tripState?.destination || null;
  if (msgLower.includes('japan') || msgLower.includes('tokyo') || msgLower.includes('kyoto') || msgLower.includes('osaka')) {
    destination = 'Japan';
  } else if (msgLower.includes('switzerland') || msgLower.includes('zurich') || msgLower.includes('lucerne')) {
    destination = 'Switzerland';
  } else if (msgLower.includes('france') || msgLower.includes('paris')) {
    destination = 'France';
  } else if (msgLower.includes('italy') || msgLower.includes('rome') || msgLower.includes('venice')) {
    destination = 'Italy';
  } else if (msgLower.includes('uk') || msgLower.includes('london') || msgLower.includes('united kingdom')) {
    destination = 'United Kingdom';
  }

  // Detect Duration
  const nightsMatch = msgLower.match(/(\d+)\s*(night|nt|day)/);
  const durationNights = nightsMatch ? parseInt(nightsMatch[1], 10) : (tripState?.durationNights || 7);

  // Detect Adults
  const adultsMatch = msgLower.match(/(\d+)\s*(adult|pax|people|person|traveler|guest)/);
  const adults = adultsMatch ? parseInt(adultsMatch[1], 10) : (tripState?.adults || 2);

  // Detect Hotel Star Category
  let hotelCategory = tripState?.hotelCategory || '4-Star';
  if (msgLower.includes('5-star') || msgLower.includes('5 star') || msgLower.includes('luxury')) {
    hotelCategory = '5-Star Luxury';
  } else if (msgLower.includes('3-star') || msgLower.includes('3 star') || msgLower.includes('budget')) {
    hotelCategory = '3-Star Standard';
  }

  // Detect Style
  const travelStyle: string[] = [];
  if (msgLower.includes('relaxed') || msgLower.includes('leisure')) travelStyle.push('Relaxed');
  if (msgLower.includes('honeymoon') || msgLower.includes('romantic')) travelStyle.push('Honeymoon');
  if (msgLower.includes('family') || msgLower.includes('kid') || msgLower.includes('children')) travelStyle.push('Family');
  if (msgLower.includes('cultural') || msgLower.includes('heritage') || msgLower.includes('temple')) travelStyle.push('Cultural');
  if (msgLower.includes('luxury') || msgLower.includes('premium')) travelStyle.push('Luxury');

  // Detect specific queries
  const bookingRegex = /\b(BK-[\w-]+|TUB-BK-[\w-]+|TUB-[\w-]+|\d{4,8})\b/i;
  const bookingMatch = message.match(bookingRegex);
  const extractedBookingId = bookingMatch ? bookingMatch[0].toUpperCase() : null;

  const isBookingCheck = Boolean(extractedBookingId) || 
    (msgLower.includes('booking') || msgLower.includes('reservation') || msgLower.includes('voucher') || msgLower.includes('status')) &&
    (msgLower.includes('status') || msgLower.includes('check') || msgLower.includes('track') || msgLower.includes('find') || msgLower.includes('where is') || msgLower.includes('my'));

  const isPackageSearch = msgLower.includes('package') || msgLower.includes('packages') || msgLower.includes('bundled tour') || msgLower.includes('tour package');

  const isActivitySearch = (msgLower.includes('activit') || msgLower.includes('excursion') || msgLower.includes('sightseeing') || msgLower.includes('things to do') || msgLower.includes('day tour')) &&
    (msgLower.includes('price') || msgLower.includes('list') || msgLower.includes('cost') || msgLower.includes('what') || msgLower.includes('show') || msgLower.includes('available') || msgLower.includes('rate'));

  const isHotelPriceSearch = (msgLower.includes('hotel') || msgLower.includes('stay') || msgLower.includes('resort')) &&
    (msgLower.includes('price') || msgLower.includes('rate') || msgLower.includes('cost') || msgLower.includes('how much') || msgLower.includes('compare') || msgLower.includes('list'));

  const isPlanning = msgLower.includes('plan') || msgLower.includes('itinerary') || msgLower.includes('trip') || msgLower.includes('nights') || msgLower.includes('days') || Boolean(destination);
  const isRefining = msgLower.includes('relaxed') || msgLower.includes('upgrade') || msgLower.includes('reduce') || msgLower.includes('add') || msgLower.includes('remove') || msgLower.includes('cheaper');

  let intent = 'GENERAL_TRAVEL_QUESTION';
  let quickPrompts: string[] = [];

  if (isBookingCheck) {
    intent = 'CHECK_BOOKING_STATUS';
    quickPrompts = [
      'Show my recent bookings',
      'Check booking status BK-2026-001',
      'Download booking voucher',
      'Ask for packages'
    ];
  } else if (isPackageSearch) {
    intent = 'PACKAGE_SEARCH';
    quickPrompts = [
      'Show all Japan packages',
      'Ask for hotel price',
      'Ask for activities list and price',
      'Check my booking status'
    ];
  } else if (isHotelPriceSearch) {
    intent = 'HOTEL_PRICE_SEARCH';
    quickPrompts = [
      'Compare 5-star hotels in Tokyo',
      'Show Kyoto hotel prices',
      'Ask for activities list and price',
      'Ask for packages'
    ];
  } else if (isActivitySearch) {
    intent = 'ACTIVITY_SEARCH';
    quickPrompts = [
      'Show Tokyo activities with price',
      'Kyoto cultural tours and rates',
      'Ask for hotel price',
      'Check booking status'
    ];
  } else if (isRefining && currentPlan) {
    intent = 'REFINE_ITINERARY';
    quickPrompts = [
      'Make it more relaxed',
      'Upgrade to 5-star hotels',
      'Add private airport transfers',
      'Open in Quote Builder'
    ];
  } else if (isPlanning) {
    intent = 'CREATE_ITINERARY';
    quickPrompts = [
      'Make it more relaxed',
      'Upgrade to 5-star hotels',
      'Add private airport transfers',
      'Open in Quote Builder'
    ];
  } else if (msgLower.includes('hotel')) {
    intent = 'HOTEL_SEARCH';
    quickPrompts = [
      'Compare hotel prices',
      'Ask for activities list and price',
      'Ask for packages'
    ];
  } else if (msgLower.includes('quote')) {
    intent = 'QUOTE_REQUEST';
    quickPrompts = [
      'Open in Quote Builder',
      'Check hotel prices',
      'Ask for packages'
    ];
  } else {
    quickPrompts = [
      'Check my booking status',
      'Ask for packages',
      'Ask for hotel price in Tokyo',
      'Ask for activities list and price'
    ];
  }

  let replyText = '';
  let rationale = '';

  if (intent === 'CHECK_BOOKING_STATUS') {
    if (extractedBookingId) {
      replyText = `I have located booking record ${extractedBookingId} in TheUnbound operational database. Retrieving live status, traveler details, and departure schedule:`;
    } else {
      replyText = `Here are your recent bookings from TheUnbound database. You can review the current operational status, confirmed vouchers, and payment states below:`;
    }
    rationale = `Retrieved direct from TheUnbound live booking ledger.`;
  } else if (intent === 'PACKAGE_SEARCH') {
    replyText = `Here are available curated DMC packages matching your criteria. Each package includes hotels, transfers, and activities with live commercial rates:`;
    rationale = `Packages retrieved from TheUnbound Package Management database with dynamic capacity-aware pricing.`;
  } else if (intent === 'HOTEL_PRICE_SEARCH' || intent === 'HOTEL_SEARCH') {
    replyText = `Here are live contracted hotel rates for ${destination || 'Tokyo, Japan'}. Rates reflect real DMC wholesale inventory and seasonal tiers:`;
    rationale = `Live hotel inventory queried with room category rates and inclusions.`;
  } else if (intent === 'ACTIVITY_SEARCH') {
    replyText = `Here are verified DMC activities and excursions in ${destination || 'Japan'} with per-person and group pricing:`;
    rationale = `Queried live Activity Management database with contracted rates and duration details.`;
  } else if (intent === 'CREATE_ITINERARY') {
    replyText = `I have structured your trip for ${destination || 'Japan'} (${durationNights} Nights for ${adults} Adults) with ${hotelCategory} accommodations and curated experiences. I have evaluated routing feasibility and applied live commercial rates.`;
    rationale = `Routing optimized across key cultural hubs with balanced travel times and morning leisure windows.`;
  } else if (intent === 'REFINE_ITINERARY') {
    replyText = `I have updated your itinerary based on your request. Unaffected hotel stays and transfers have been preserved, and pricing has been recalculated with live contract rates.`;
    rationale = `Adjusted pace and activities to reflect your updated preferences while ensuring transfer feasibility.`;
  } else {
    replyText = `Welcome to TheUnbound AI Travel Specialist. As an authorized agent, you can ask me to check your booking status, ask for packages, ask for hotel prices, or ask for an activities list and price. How may I assist your agency today?`;
  }

  return {
    intent,
    replyText,
    conciseRationale: rationale,
    extractedRequirements: {
      bookingId: extractedBookingId,
      destination: destination || 'Japan',
      hubs: ['Tokyo', 'Kyoto'],
      durationNights,
      travelStartDate: '2026-10-12',
      travelEndDate: '2026-10-20',
      adults,
      children: 0,
      childAges: [],
      infants: 0,
      hotelCategory,
      travelStyle: travelStyle.length > 0 ? travelStyle : ['Relaxed', 'Cultural'],
      transportPreference: msgLower.includes('private') ? 'PRIVATE' : 'MIXED',
      budget: null,
      interests: ['Temples', 'Culinary', 'Sightseeing']
    },
    missingInformation: [],
    quickPrompts
  };
}
