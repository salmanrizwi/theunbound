import { buildQuotePresentationModel } from '../services/quotePresentationModel';
import {
  paginateQuotePresentationModel,
  validatePaginatedQuoteCompleteness,
  validatePdfLayoutBounds,
  measureHeaderAndFooterHeights,
  getPageContentBounds,
  stripHtmlTagsAndEntities
} from '../services/pdfPaginationEngine';
import { Quotation } from '../types';
import { THEUNBOUND_REGISTERED_ADDRESS, THEUNBOUND_CURRENT_ADDRESS } from '../services/db';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[QTE-4847 REGRESSION ASSERTION FAILED] ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

const mtFujiDescription = `Mount Fuji Panoramic Line: One-Day Tour of Popular Fuji Photo Spots
★ Arakurayama Sengen Park ★ Oshino Hakkai ★ Hikawa Clock Shop ★ Lawson Kawaguchiko Station Front

Tokyo, 08:00
7:50–8:00 Meet and depart at JR Tokyo Station Marunouchi North Exit (Package with boarding & alighting at meeting point)
7:30–8:30 Door-to-door hotel pick-up across 12 wards of Tokyo Hotel & Guesthouse Transfer Package 【Minimum booking of 2 guests required】
Door-to-door pick-up is confirmed instantly for hotels/guesthouses in: Shinjuku Ward, Chiyoda Ward, Chuo Ward, Taito Ward.
Secondary confirmation is required for locations in the following wards: Minato Ward, Shibuya Ward, Toshima Ward, Nakano Ward, Sumida Ward, Koto Ward, Bunkyo Ward, Edogawa Ward.
※ The vehicle will not wait for late arrivals. Please arrive at the meeting point 10 minutes prior to departure.

Yama Nashi, 10:30
▼ Arakurayama Sengen Park—Internet famous Spot, the ideal viewpoint for full panoramic views of Mount Fuji (approx. 80 minutes stay)
Arakurayama Sengen Park is an ideal destination to admire the beauty of Mount Fuji and soak in serene natural scenery. You can capture the five-story pagoda, cherry blossoms and Mount Fuji all in one frame here.
The park boasts distinct charms with the changing seasons: blooming cherry blossoms in spring, fresh green foliage in summer, fiery red maple leaves in autumn and snow-covered vistas in winter.
An ancient Sengen Shrine stands within the park for visitors to offer prayers, adding a profound touch of history to the surroundings.

Yama Nashi, 11:50
▼ Hikawa Clock Shop – Hidden Japanese Street Photo Spot with a direct view of Mount Fuji at the road's end (approx. 20 minutes stay)
Beneath Mount Fuji lies not only the famous ballad, but also a collection of diverse traditional Japanese scenic spots, and Hikawa Clock Shop is one of them. Low wooden eaves line both sides of the street, embodying unrefined craftsmanship and traces of time.
No refunds will be issued if poor weather or other force majeure results in unsightly scenery or unsatisfactory photos!

Yama Nashi, 12:50
▼ Oshino Hakkai, known as the "Jiuzhaigou at the foot of Mount Fuji" (approx. 80 minutes, including lunch break)
Blessed by nature, Oshino Hakkai is a stunning scenic spot. Meltwater from Mount Fuji seeps through underground strata to form eight clear spring ponds. The crystal-clear springs mirror the grand mountain and tranquil sky.

Yama Nashi, 14:20
▼ Oishi Park by Lake Kawaguchiko (approx. 60 minutes; visit Oishi Park instead of the Lake Kawaguchiko Cherry Blossom Festival during non-cherry blossom seasons)
Nestled along the shore of Lake Kawaguchiko, Oishi Park unfolds like a vivid painting at the foot of Mount Fuji.
Come autumn, cosmos flowers sway gently in the breeze, adding soft pastel hues to Mount Fuji. In winter, everything is blanketed in snow, turning Mount Fuji and Lake Kawaguchiko into a magical fairyland.

Yama Nashi, 15:40
▼ Lawson Kawaguchiko Station Front – Popular Travel Photography Spot (approx. 20 minutes)
Nestled amid the picturesque scenery where Mount Fuji and Lake Kawaguchiko complement each other.

16:00
End of today's itinerary, time to head back.
Tokyo, 18:00 Arrive at JR Tokyo Station Marunouchi North Exit / your hotel or guesthouse.`;

const izuDescription = `Tales of Izu: A Fantastic Journey Through Volcanoes, Coasts and Zoo (★ Mt. Omuro Park ★ Izu Shaboten Zoo ★ Southern Jogasaki Coast ★ Kadowaki Suspension Bridge)

7:20 Departure from Tokyo to kick off your Izu journey at JR Tokyo Station Marunouchi North Exit.
The distance from Tokyo to Mt. Omuro & Izu Shaboten Zoo is approximately 150 kilometers, with a driving time of around 2.5 to 3 hours.

10:30 AM – 1:00 PM Mt. Omuro & Izu Shaboten Zoo (140 minutes of free time; admission tickets at your own expense)
- Mt. Omuro Park — Trace Footsteps from Your Name. & Explore Its Iconic Volcanic Crater. Standing at merely 580 meters above sea level, Mt. Omuro is known as Japan's lowest volcano.
Chairlift fees at your own cost: Round trip for adults ¥1,000, children ¥500.
- Izu Shaboten Zoo — A Soothing Cactus Getaway with Capybaras! Boasting one of the world's largest cactus collections and interactive capybara feeding areas.

1:20 PM – 2:00 PM Izu Ocean View Train Experience (Izu-Kōgen Station -> Izu-Inatori Station)
Board the scenic train on the Izu Kyūkō Line along the dramatic Pacific coastline.

2:40 PM – 3:20 PM Southern Jogasaki Coast & Kadowaki Suspension Bridge (Approx. 40 minutes of sightseeing)
Stretch across 48 meters overlooking crystal-clear coves and rugged volcanic cliffs.

3:30 PM Head back to Tokyo, arriving around 7:00 PM at JR Tokyo Station.`;

const tokyoCharterDescription = `10-hour Private Charter Tour Tokyo City Highlight: Meiji Jingu -> Imperial Palace -> Senso-ji + Nakamise -> Tokyo Skytree -> teamLab Planets -> Rainbow Bridge -> Odaiba -> Hotel.

Tokyo City Highlights Tour
Experience Tokyo's traditional heritage and futuristic cityscape by private charter. Visit Meiji Jingu Shrine, the Imperial Palace, and historic Senso-ji Temple, followed by free time along Nakamise Shopping Street. Continue to Tokyo Skytree for spectacular city views and experience teamLab Planets TOKYO. Complete the tour with a scenic drive across Rainbow Bridge and time in Odaiba before returning to the hotel.

Ticket Requirements:
Meiji Jingu: No ticket.
Imperial Palace: No ticket for public viewing areas.
Senso-ji: No ticket.
Nakamise: Free.
Tokyo Skytree: Ticket required for observation decks.
teamLab Planets: Ticket required + fixed timed entry.
Rainbow Bridge: No ticket when crossing by vehicle.
Odaiba: Free.`;

const otaruDescription = `Discover Otaru, a charming harbour city known for its historic canal, preserved merchant buildings, glass crafts, music boxes and fresh seafood.

Recommended route: Sapporo Hotel -> Otaru Canal -> Sakaimachi Street -> Music Box Museum -> Kitaichi Glass -> Lunch -> Mt. Tengu -> Sapporo Hotel.
09:00–10:00 | Sapporo to Otaru: Travel to Otaru by private vehicle (45-60 mins).
10:00–10:45 | Otaru Sankaku Market: Browse local seafood and fresh bowls.
10:45–11:45 | Otaru Canal: Walk along historic stone warehouses and Asakusa Bridge viewpoint.
11:45–13:00 | Sakaimachi Street: Historic merchant boutiques, glassware, and confectionery shops.
13:00–13:30 | Otaru Music Box Museum: Historic steam clock and handcrafted music boxes.
13:30–14:00 | Kitaichi Glass Sangokan: Traditional oil-lamp hall and handcrafted glass.
14:00–14:45 | Lunch in Otaru (at guests' own expense).
14:45–16:20 | Otaru Tenguyama Ropeway: Panoramic views of Otaru harbour and Ishikari Bay.
16:20–17:20 | Return to Sapporo Hotel.`;

const furanoDescription = `This tour combines Furano's famous flower fields with Biei's scenic colourfully landscaped hills and Blue Pond.

07:00–09:00 | Sapporo to Furano: Travel through Hokkaido's countryside (~2 hours).
09:00–10:00 | Farm Tomita: Explore seasonal lavender fields, viewpoints and gift shops. Tickets: General admission free.
10:00–11:15 | Furano Cheese Factory: Cheese-making facilities and tastings.
11:15–12:00 | Lunch in Furano: Local Hokkaido curry and seasonal produce (own expense).
12:00–13:45 | Drive to Biei & Shikisai no Oka: Expansive rolling hills and flower gardens.
13:45–14:50 | Shirogane Blue Pond: Striking mineral blue water and standing trees.
14:50–15:30 | Shirahige Waterfall: Dramatic blue river waterfall viewpoint.
15:30–18:00 | Return to Sapporo Hotel.`;

// Exact Japan Destination Commercial Terms structure from QTE-2026-4847 (Page 16 + missing overflow)
const japan16SectionCommercialTermsHtml = `
<p><strong>1. Payment Policy</strong><br/><strong>JPY Payments:</strong> Payments made in Indian Rupees (INR) against JPY quotations will be calculated at XE + 0.03.<br/><strong>USD Payments:</strong> Payments made in Indian Rupees (INR) against USD quotations will be calculated at XE + 1.<br/>An additional 5% GST will be applicable.</p>
<p><strong>2. Rate Quotation</strong><br/>All land services, excluding hotels, are quoted in Japanese Yen (JPY).</p>
<p><strong>3. Vehicles Provided</strong><br/>The following vehicle categories may be provided, subject to availability:</p>
<table>
  <thead>
    <tr><th>Vehicle</th><th>Capacity</th></tr>
  </thead>
  <tbody>
    <tr><td>Toyota Alphard or similar</td><td>7-seater (6 passengers + 1 driver)</td></tr>
    <tr><td>Toyota Hiace</td><td>10-seater (9 passengers + 1 driver)</td></tr>
    <tr><td>Toyota Hi-Roof</td><td>14-seater (13 passengers + 1 driver)</td></tr>
  </tbody>
</table>
<p><strong>4. Driver Language</strong><br/>Drivers speak Japanese and communicate with guests using a translation device or application. If an English-speaking driver is required, an additional charge will apply, subject to availability.</p>
<p><strong>5. Guide Services</strong><br/>An English-speaking guide can be arranged at an additional cost of <strong>JPY 40,000 per day</strong>, subject to availability at the time of confirmation. Hindi-speaking guides can be arranged at an additional cost, subject to availability.</p>
<p><strong>6. Temple, Parks &amp; Shrine Tickets</strong><br/>Many temples, parks and shrines in Japan do not offer online or advance ticket purchases. We recommend purchasing tickets directly from the counter (approx. 5-10 minutes).</p>
<p><strong>7. Private Tour Duration</strong><br/>The standard duration for a private tour vehicle at disposal is <strong>10 hours per day</strong>. Additional hours will be charged at <strong>JPY 5,000 per extra hour</strong>.</p>
<p><strong>8. In-Car Policy</strong><br/>Eating inside the vehicle is strictly prohibited. Guests violating this policy will be fined.</p>
<p><strong>9. Point-to-Point Transfers</strong><br/>Maximum waiting time for point-to-point transfers is <strong>15 minutes</strong>. Failure to arrive within this window will be considered a no-show.</p>
<p><strong>10. Airport Pickups</strong><br/>Maximum waiting time for airport pickups is <strong>1 hour after the flight lands</strong>.</p>
<p><strong>11. Bullet Train Travel — Luggage Handling</strong><br/>Luggage courier services can be arranged directly through the hotel (<strong>JPY 2,000 to JPY 4,500 per piece</strong>). If guests plan to carry luggage on the train, sufficient storage space may not be available.</p>
<p><strong>12. Baggage Allowance</strong><br/>Each guest is allowed 1 handbag and 1 check-in bag. Additional baggage requiring a support transport vehicle will be arranged separately at actual cost.</p>
<p><strong>13. City Tax at Hotels</strong><br/>Hotels in Japan may charge a mandatory city tax payable directly by guests at check-in.</p>
<p><strong>14. Tours</strong><br/>All SIC tours operate on a sharing basis from a designated pickup point unless hotel pickup is specifically mentioned in the quotation.</p>
<p><strong>15. Shinkansen Luggage Policy</strong><br/>Most travellers can carry their luggage on the Shinkansen without a special reservation. Guests should check which category their luggage falls into based on its overall dimensions (Length + Width + Height).<br/><strong>A. Small to Medium Bags — Under 160 cm / 62 inches</strong><br/>Fits comfortably on overhead luggage racks above seats or beneath legs without prior oversized baggage reservation.<br/><strong>B. Large Bags — 161 cm to 250 cm</strong><br/>Requires advance reservation of dedicated Oversized Baggage Area seats (last row of designated Shinkansen cars). Carrying unreserved oversized baggage incurs an onboard JPY 1,000 fee.<br/><strong>C. Extra-Large Bags — Over 250 cm</strong><br/>Prohibited aboard Shinkansen bullet trains; guests must use hotel-to-hotel Takkyubin luggage forwarding services.</p>
<p><strong>16. Acceptance &amp; Cancellation Schedule</strong><br/>Upon deposit confirmation, all commercial terms above take effect. Standard tier penalties apply 35 days, 34-15 days (50%), and 14 days or less (100% non-refundable).</p>
`;

const quote4847Fixture: Quotation = ({
  id: 'qte-2026-4847',
  quoteNumber: 'QTE-2026-4847',
  version: 8,
  status: 'DRAFT',
  leadId: 'lead-qte-4847',
  agentId: 'agent-tp',
  agentName: 'Travel Partner',
  agentAgency: 'Travel Partner',
  agentEmail: 'business@theunbound.in',
  agentPhone: '+91 9811654959',
  clientName: 'Client Name Pending',
  clientCompany: 'Travel Expedition',
  clientEmail: 'client@example.com',
  clientPhone: '+919802050501',
  destination: 'Japan Bespoke Travel Itinerary',
  travelStartDate: '2026-12-16',
  travelEndDate: '2026-12-25',
  paxCount: 2,
  adults: 2,
  children: 0,
  infants: 0,
  effectivePax: 2,
  currency: 'INR',
  totalAmount: 427375.27,
  netTotal: 375000,
  marginAmount: 52375.27,
  marginPercent: 13.9,
  createdAt: '2026-11-13T10:00:00.000Z',
  validUntil: '2026-12-10T23:59:59.000Z',
  brandingMode: 'STANDARD',
  routeHubs: [
    { hubId: 'tokyo', hubName: 'Tokyo (Kanto)', nights: 4, order: 1 },
    { hubId: 'sapporo', hubName: 'Sapporo (Hokkaido)', nights: 3, order: 2 },
    { hubId: 'osaka', hubName: 'Osaka (Kinki)', nights: 2, order: 3 }
  ],
  dayNotes: {
    'day-2': '', // Intentionally empty like Page 2 of uploaded PDF (should NOT emit empty DAY 2 OVERVIEW box!)
    'day-4': '   ', // Whitespace only like Page 6 (should NOT emit empty DAY 4 OVERVIEW box!)
    'day-7': '<p><br/></p>' // Empty HTML like Page 12 (should NOT emit empty DAY 7 OVERVIEW box!)
  },
  commercialTermsSnapshot: {
    combinedHeading: 'COMMERCIAL QUOTATION TERMS — TOKYO (KANTO) & SAPPORO (HOKKAIDO) & OSAKA (KINKI) & HAKONE & MT. FUJI (CHUBU)',
    combinedPlainText: stripHtmlTagsAndEntities(japan16SectionCommercialTermsHtml),
    combinedHtml: japan16SectionCommercialTermsHtml,
    entries: [
      {
        targetId: 'japan-multi',
        targetName: 'TOKYO (KANTO) & SAPPORO (HOKKAIDO) & OSAKA (KINKI) & HAKONE & MT. FUJI (CHUBU)',
        version: 2,
        inheritedFromParentName: 'Japan',
        sections: [
          {
            sectionId: 'sec-japan-1',
            heading: '1. Commercial Quotation Terms',
            htmlContent: japan16SectionCommercialTermsHtml,
            displayOrder: 1,
            isActive: true
          }
        ]
      }
    ]
  },
  items: [
    {
      id: 'item-d1-nrt',
      service_type: 'TRANSFER',
      category: 'Transfers',
      dayNumber: 1,
      totalPrice: 28000,
      currency: 'INR',
      paxCount: 2,
      inclusions: ['Private Chauffeur', 'Professional Driver', 'Hotel Drop-Off in Tokyo', 'All Taxes'],
      exclusions: ['Lunch', 'Extra Waiting Time'],
      notes: 'Tokyo (Kanto) -> Tokyo (Kanto) (Toyota Alphard (7 Seater))',
      product: {
        id: 'p-d1',
        name: 'Narita Airport -> Tokyo Hotel',
        productType: 'Transfer',
        category: 'Transfers',
        description: 'Enjoy a comfortable and hassle-free private transfer from Narita International Airport (NRT) to your hotel in Tokyo.'
      }
    },
    {
      id: 'item-d2-fuji',
      service_type: 'ACTIVITY',
      category: 'Group Tours',
      dayNumber: 2,
      totalPrice: 44000,
      currency: 'INR',
      paxCount: 2,
      inclusions: [
        'Vehicle service fees as listed in the itinerary',
        'Fuel, toll and expressway fees',
        'Vehicle service duration within 10 hours (as required by Japanese law)',
        'Driver-guide service charge (small private group for 1–9 passengers)',
        'Reference vehicle types 5–8 seater Toyota Alphard or equivalent, 10 seater Toyota Hiace or equivalent',
        'All children are charged the same rate as adults'
      ],
      exclusions: ['Accommodation, meals, attraction entrance tickets, optional local activities and all other personal expenses', 'Any items not listed under the above "Inclusions" section'],
      notes: 'Hotel/ JR Tokyo Station Marunouchi North Exit (Package with boarding & alighting at meeting point)',
      product: {
        id: 'p-d2',
        name: 'Mt Fuji Panoramic 9-Pax Small Group Tour',
        productType: 'Activity',
        category: 'Group Tours',
        description: mtFujiDescription
      }
    },
    {
      id: 'item-d3-izu',
      service_type: 'ACTIVITY',
      category: 'Group Tours',
      dayNumber: 3,
      totalPrice: 45000,
      currency: 'INR',
      paxCount: 2,
      inclusions: [
        'Vehicle service fees as listed in the itinerary',
        'Fuel, toll and expressway fees',
        'Vehicle service duration within 10 hours (as required by Japanese law)',
        'Driver-guide service charge (small private group for 1–9 passengers)'
      ],
      exclusions: ['Accommodation, meals, attraction entrance tickets', 'Any items not listed under Inclusions'],
      notes: 'JR Tokyo Station Marunouchi North Exit Door-to-door pickup at hotels within 12 special wards of Tokyo',
      product: {
        id: 'p-d3',
        name: 'Izu One-Day Tour',
        productType: 'Activity',
        category: 'Group Tours',
        description: izuDescription
      }
    },
    {
      id: 'item-d4-tokyo',
      service_type: 'ACTIVITY',
      category: 'Private Tours',
      dayNumber: 4,
      totalPrice: 55000,
      currency: 'INR',
      paxCount: 2,
      inclusions: ['Professional Driver', 'Private Vehicle'],
      exclusions: ['Lunch', 'Guide'],
      notes: 'Tokyo City Highlight - 10-Hour Private Charter (Toyota Alphard (7 Seater) • 6 Seats)',
      product: {
        id: 'p-d4-1',
        name: 'Tokyo City Highlight – 10-Hour Private Charter',
        productType: 'Activity',
        category: 'Private Tours',
        description: tokyoCharterDescription
      }
    },
    {
      id: 'item-d4-skytree',
      service_type: 'TICKET',
      category: 'Tickets',
      dayNumber: 4,
      totalPrice: 9500,
      currency: 'INR',
      paxCount: 2,
      inclusions: ['Entry Ticket'],
      exclusions: ['Meal', 'Guide', 'Personal Expense'],
      notes: 'Tembo Deck (350m) (10:00 AM)',
      product: {
        id: 'p-d4-2',
        name: 'Tokyo Skytree',
        productType: 'Ticket',
        category: 'Tickets',
        description: 'Bespoke curated travel experience: Tokyo Skytree.'
      }
    },
    {
      id: 'item-d4-teamlab',
      service_type: 'TICKET',
      category: 'Tickets',
      dayNumber: 4,
      totalPrice: 8500,
      currency: 'INR',
      paxCount: 2,
      inclusions: ['Entry Ticket'],
      exclusions: ['Guide', 'Meal', 'Personal Expense'],
      notes: 'Standard General Admission (10:00 AM)',
      product: {
        id: 'p-d4-3',
        name: 'teamLab Planets Tokyo',
        productType: 'Ticket',
        category: 'Tickets',
        description: 'Bespoke curated travel experience: teamLab Planets Tokyo.'
      }
    },
    {
      id: 'item-d5-nrt',
      service_type: 'TRANSFER',
      category: 'Transfers',
      dayNumber: 5,
      totalPrice: 28000,
      currency: 'INR',
      paxCount: 2,
      product: {
        id: 'p-d5-1',
        name: 'Tokyo Hotel -> Narita Airport',
        productType: 'Transfer',
        category: 'Transfers',
        description: 'Private executive departure transfer from Tokyo Hotel to Narita International Airport.'
      }
    },
    {
      id: 'item-d5-cts',
      service_type: 'ACTIVITY',
      category: 'Private Tours',
      dayNumber: 5,
      totalPrice: 25000,
      currency: 'INR',
      paxCount: 2,
      inclusions: ['Private Transfer', 'Professional Driver'],
      exclusions: ['Lunch', 'Guide'],
      product: {
        id: 'p-d5-2',
        name: 'New Chitose Airport -> Sapporo',
        productType: 'Activity',
        category: 'Private Tours',
        description: 'Private vehicle arrival transfer from New Chitose Airport to Sapporo Hotel.'
      }
    },
    {
      id: 'item-d6-otaru',
      service_type: 'ACTIVITY',
      category: 'Private Tours',
      dayNumber: 6,
      totalPrice: 54000,
      currency: 'INR',
      paxCount: 2,
      inclusions: ['Private Vehicle', 'Professional Driver'],
      exclusions: ['Lunch', 'Guide', 'Tickets'],
      product: {
        id: 'p-d6',
        name: 'Otaru Canal, Glass Crafts & Mount Tengu - 10 Hour Private Tour from Sapporo',
        productType: 'Activity',
        category: 'Private Tours',
        description: otaruDescription
      }
    },
    {
      id: 'item-d7-furano',
      service_type: 'ACTIVITY',
      category: 'Private Tours',
      dayNumber: 7,
      totalPrice: 56000,
      currency: 'INR',
      paxCount: 2,
      inclusions: ['Private Vehicle', 'Professional Driver'],
      exclusions: ['Lunch', 'Guide'],
      product: {
        id: 'p-d7',
        name: 'Furano Flower Fields & Biei Scenic Highlights - Private Day Tour from Sapporo',
        productType: 'Activity',
        category: 'Private Tours',
        description: furanoDescription
      }
    },
    {
      id: 'item-d8-cts',
      service_type: 'ACTIVITY',
      category: 'Private Tours',
      dayNumber: 8,
      totalPrice: 25000,
      currency: 'INR',
      paxCount: 2,
      inclusions: ['Private Transfer', 'Professional Driver'],
      exclusions: ['Lunch', 'Guide'],
      product: {
        id: 'p-d8-1',
        name: 'Sapporo -> New Chitose Airport',
        productType: 'Activity',
        category: 'Private Tours',
        description: 'Private executive departure transfer from Sapporo Hotel to New Chitose Airport.'
      }
    },
    {
      id: 'item-d8-kix',
      service_type: 'TRANSFER',
      category: 'Transfers',
      dayNumber: 8,
      totalPrice: 49375.27,
      currency: 'INR',
      paxCount: 2,
      inclusions: ['Private Chauffeur', 'Professional Driver', 'Airport Drop-Off in Osaka'],
      exclusions: ['Lunch', 'Extra Waiting Time'],
      product: {
        id: 'p-d8-2',
        name: 'Kansai Airport (KIX) -> Osaka Hotel',
        productType: 'Transfer',
        category: 'Transfers',
        description: 'Enjoy a comfortable private transfer from Kansai International Airport (KIX) to your hotel in Osaka.'
      }
    }
  ]
} as unknown as Quotation);

async function runQte4847RegressionSuite() {
  console.log('================================================================================');
  console.log('🧪 QTE-2026-4847 PDF GENERATION & PAGINATION REGRESSION SUITE');
  console.log('================================================================================');

  // --- TEST 1: Full QTE-2026-4847 (v8) 10-Day Reference Reproduction ---
  console.log('\n--- TEST 1: Full QTE-2026-4847 (v8) 10-Day Japan Quotation & 16-Section Terms ---');
  const model4847 = buildQuotePresentationModel(quote4847Fixture, {
    name: 'Travel Partner',
    agencyName: 'Travel Partner',
    email: 'business@theunbound.in',
    phone: '+91 9811654959',
    registeredAddress: THEUNBOUND_REGISTERED_ADDRESS,
    currentAddress: THEUNBOUND_CURRENT_ADDRESS
  });

  const pages4847 = paginateQuotePresentationModel(model4847);
  const completeness4847 = validatePaginatedQuoteCompleteness(model4847, pages4847);
  const bounds4847 = validatePdfLayoutBounds(pages4847);

  console.log(`  📄 Paginated QTE-2026-4847 into ${pages4847.length} pages:`);
  pages4847.forEach((p) => {
    console.log(
      `     Page ${String(p.pageNumber).padStart(2, '0')}/${p.totalPages}: used=${p.usedContentHeight}px / max=${p.availableContentHeight}px | header=${p.bounds.headerHeight}px | footer=${p.bounds.footerHeight}px | blocks=${p.blocks.length}`
    );
  });

  assert(completeness4847.valid, `Completeness check passed cleanly (${completeness4847.errors.join(', ') || '0 errors'})`);
  assert(bounds4847.valid, `Layout bounds check passed cleanly across all ${pages4847.length} pages (${bounds4847.errors.join(', ') || '0 errors'})`);

  const allBodyHtml = pages4847.map((p) => p.blocks.map((b) => b.html).join('\n')).join('\n');
  const allBlocks = pages4847.flatMap((p) => p.blocks);

  // Verify NO empty DAY X OVERVIEW boxes anywhere in body
  assert(!allBodyHtml.includes('DAY 2 OVERVIEW'), 'Empty DAY 2 OVERVIEW placeholder removed');
  assert(!allBodyHtml.includes('DAY 4 OVERVIEW'), 'Empty DAY 4 OVERVIEW placeholder removed');
  assert(!allBodyHtml.includes('DAY 7 OVERVIEW'), 'Empty DAY 7 OVERVIEW placeholder removed');

  // Verify NO legacy footer / company address dumped inside body flow
  assert(
    !allBlocks.some((b) => b.id === 'block-terms-signature'),
    'Legacy block-terms-signature removed from body block flow'
  );
  const nonHeroBodyHtml = pages4847
    .flatMap((p) => p.blocks)
    .filter((b) => b.type !== 'HERO_AND_DOSSIER')
    .map((b) => b.html)
    .join('\n');
  assert(
    !nonHeroBodyHtml.includes('Kanchan Kunj') && !nonHeroBodyHtml.includes('alt.f coworking'),
    'Company registered & current addresses never appear inside continuation/terms body blocks'
  );

  // Verify every page's fixed footer renders Registered Address + Current Address + Page X of Y cleanly
  pages4847.forEach((p) => {
    assert(
      p.footerHtml.includes('Registered Address:') && p.footerHtml.includes('Current Address:'),
      `Page ${p.pageNumber} fixed footer displays both Registered Address and Current Address`
    );
    assert(
      p.footerHtml.includes('A-46, Kanchan Kunj') && p.footerHtml.includes('alt.f coworking'),
      `Page ${p.pageNumber} fixed footer displays complete multi-line New Delhi addresses`
    );
    assert(
      p.footerHtml.includes(`Page ${p.pageNumber} of ${pages4847.length}`),
      `Page ${p.pageNumber} footer contains exact "Page ${p.pageNumber} of ${pages4847.length}"`
    );
    assert(
      p.usedContentHeight <= p.availableContentHeight,
      `Page ${p.pageNumber} body (${p.usedContentHeight}px) stays strictly above reserved footer (${p.availableContentHeight}px)`
    );
    const lastBlock = p.blocks[p.blocks.length - 1];
    assert(!lastBlock.keepWithNext, `Page ${p.pageNumber} never ends with an orphaned keepWithNext heading`);
  });

  // Verify Sections 14, 15 (A, B, C), 16, and Vehicles table all survived completely in Commercial Terms!
  const termsPages = pages4847.filter((p) => p.blocks.some((b) => b.type === 'TERMS_AND_SIGNATURE'));
  assert(termsPages.length >= 2, `16-section Japan Commercial Terms cleanly span ${termsPages.length} pages without clipping`);
  assert(allBodyHtml.includes('14. Tours'), 'Section 14. Tours is preserved intact');
  assert(allBodyHtml.includes('15. Shinkansen Luggage Policy'), 'Section 15. Shinkansen Luggage Policy is preserved intact');
  assert(allBodyHtml.includes('A. Small to Medium Bags'), 'Subsection 15.A preserved intact');
  assert(allBodyHtml.includes('B. Large Bags'), 'Subsection 15.B preserved intact');
  assert(allBodyHtml.includes('C. Extra-Large Bags'), 'Subsection 15.C preserved intact');
  assert(allBodyHtml.includes('16. Acceptance &amp; Cancellation Schedule'), 'Section 16 preserved intact');

  // Verify final page is substantial terms content, NOT a near-empty address spillover page
  const lastPage4847 = pages4847[pages4847.length - 1];
  assert(
    lastPage4847.blocks.every((b) => !b.html.includes('Official Contracted Quotation Document')),
    'Final page contains real terms content instead of orphaned inline footer block'
  );

  // --- TEST 2: Short Quote (1-2 Pages, Minimal Items) ---
  console.log('\n--- TEST 2: Short Quote Compact Pagination ---');
  const shortQuote: Quotation = ({
    ...quote4847Fixture,
    id: 'qte-short-4847',
    quoteNumber: 'QTE-SHORT-01',
    travelStartDate: '2026-12-16',
    travelEndDate: '2026-12-17',
    routeHubs: [{ hubId: 'tokyo', hubName: 'Tokyo', nights: 1, order: 1 }],
    items: [quote4847Fixture.items[0]]
  } as unknown as Quotation);
  const shortModel = buildQuotePresentationModel(shortQuote);
  const shortPages = paginateQuotePresentationModel(shortModel);
  const shortBounds = validatePdfLayoutBounds(shortPages);
  assert(shortBounds.valid, `Short quote passed strict layout bounds across ${shortPages.length} pages`);
  assert(shortPages.every((p) => p.blocks.length > 0), 'Short quote produces zero blank pages');

  // --- TEST 3: Large Multi-Page Table Inside Commercial Terms (Row Break + Repeated <thead>) ---
  console.log('\n--- TEST 3: Long Multi-Page Commercial Terms Table With Repeated <thead> ---');
  const largeTableRows = Array.from({ length: 18 }, (_, idx) =>
    `<tr><td>Zone ${idx + 1} Executive Coach</td><td>${12 + idx} Passengers</td><td>JPY ${(35000 + idx * 2500).toLocaleString()}</td></tr>`
  ).join('');
  const tableTermsHtml = `
    <p><strong>1. Fleet Matrix &amp; Regional Surcharges</strong></p>
    <table>
      <thead><tr><th>Vehicle Tier</th><th>Capacity</th><th>Daily Tariff</th></tr></thead>
      <tbody>${largeTableRows}</tbody>
    </table>
    <p><strong>2. Confirmation</strong><br/>Final coach assignments are confirmed 72 hours prior to departure.</p>
  `;
  const tableQuote: Quotation = ({
    ...shortQuote,
    id: 'qte-long-table',
    quoteNumber: 'QTE-TBL-18',
    commercialTermsSnapshot: {
      combinedHeading: 'COMMERCIAL QUOTATION TERMS — FLEET MATRIX',
      combinedPlainText: stripHtmlTagsAndEntities(tableTermsHtml),
      combinedHtml: tableTermsHtml,
      entries: [
        {
          targetId: 'japan-tbl',
          targetName: 'Japan Fleet Operations',
          version: 1,
          sections: [
            { sectionId: 'sec-tbl', heading: 'Vehicle Tariff Schedule', htmlContent: tableTermsHtml, displayOrder: 1, isActive: true }
          ]
        }
      ]
    }
  } as unknown as Quotation);

  const tableModel = buildQuotePresentationModel(tableQuote);
  const tablePages = paginateQuotePresentationModel(tableModel);
  const tableBounds = validatePdfLayoutBounds(tablePages);
  assert(tableBounds.valid, `Long table quote passed layout bounds across ${tablePages.length} pages`);

  const tableHtmlChunks = tablePages
    .flatMap((p) => p.blocks)
    .filter((b) => b.html.includes('<thead>'))
    .map((b) => b.html);
  assert(tableHtmlChunks.length >= 3, `18-row table split cleanly into ${tableHtmlChunks.length} row-aligned chunks`);
  assert(
    tableHtmlChunks.every((h) => h.includes('Vehicle Tier') && h.includes('Daily Tariff')),
    'Every continuation chunk of the split table repeats the original <thead> header row'
  );
  assert(tableHtmlChunks.join('').includes('Zone 18 Executive Coach'), 'All 18 table rows preserved without loss');

  // --- TEST 4: Extra-Long Company Address Dynamically Increases Reserved Footer Height ---
  console.log('\n--- TEST 4: Long Company Address Dynamic Footer Height Scaling ---');
  const shortAddrModel = {
    ...shortModel,
    agencyRegisteredAddress: 'Suite 10, Tokyo',
    agencyCurrentAddress: 'Block A, New Delhi'
  };
  const longAddrModel = {
    ...shortModel,
    agencyRegisteredAddress:
      'Floor 18, Tower B, Cyberpark Diplomatic Enclave, Sector 62 International Business District, Gautam Buddha Nagar, Uttar Pradesh 201301, Republic of India',
    agencyCurrentAddress:
      'Suite 101-114, alt.f coworking Enterprise Hub, Mathura Road NH-19, CRRI Ishwar Nagar Extension, Okhla Industrial Area Phase III, New Delhi, Delhi 110020, India'
  };
  const shortFooterH = measureHeaderAndFooterHeights(shortAddrModel).footerHeight;
  const longFooterH = measureHeaderAndFooterHeights(longAddrModel).footerHeight;
  const longAddrBounds = getPageContentBounds(2, { footerHeight: longFooterH });
  const defaultBounds = getPageContentBounds(2);

  assert(
    longFooterH > shortFooterH,
    `Long wrapped multi-line addresses automatically expand reserved footer height (${shortFooterH}px -> ${longFooterH}px)`
  );
  assert(
    longAddrBounds.availableContentHeight < defaultBounds.availableContentHeight,
    `Body area shrinks dynamically (${defaultBounds.availableContentHeight}px -> ${longAddrBounds.availableContentHeight}px) so body never touches expanded footer`
  );

  // --- TEST 5: White-Label Branding & Address Isolation ---
  console.log('\n--- TEST 5: White-Label Footer & Header Branding Isolation ---');
  const wlQuote: Quotation = ({
    ...quote4847Fixture,
    id: 'qte-wl-4847',
    quoteNumber: 'QTE-WL-9901',
    brandingMode: 'WHITE_LABEL',
    brandingSnapshot: {
      mode: 'WHITE_LABEL',
      brandName: 'Vanguard Voyages',
      logoUrl: 'https://example.com/vanguard.png',
      primaryColor: '#1e3a8a',
      accentColor: '#d97706',
      footerText: 'Vanguard Voyages Registered Office: 22 Bishopsgate, London EC2N 4BQ | VAT GB9921044',
      address: '22 Bishopsgate, London',
      email: 'concierge@vanguardvoyages.co.uk',
      phone: '+44 20 7946 0011',
      website: 'https://vanguardvoyages.co.uk'
    }
  } as unknown as Quotation);

  const wlModel = buildQuotePresentationModel(wlQuote);
  const wlPages = paginateQuotePresentationModel(wlModel);
  const wlBounds = validatePdfLayoutBounds(wlPages);
  assert(wlBounds.valid, `White-Label quote passed layout bounds across ${wlPages.length} pages`);

  const wlFullOutput = wlPages.map((p) => `${p.headerHtml}\n${p.blocks.map((b) => b.html).join('\n')}\n${p.footerHtml}`).join('\n');
  assert(!wlFullOutput.toLowerCase().includes('theunbound'), 'Zero "TheUnbound" brand leakage in White-Label PDF');
  assert(!wlFullOutput.includes('Kanchan Kunj') && !wlFullOutput.includes('alt.f coworking'), 'Zero TheUnbound office addresses leaked into White-Label PDF');
  assert(wlPages.every((p) => p.footerHtml.includes('22 Bishopsgate, London EC2N 4BQ')), 'Partner White-Label footer text & address preserved on every page');

  console.log('\n================================================================================');
  console.log('🎉 ALL QTE-2026-4847 PDF REGRESSION TESTS PASSED CLEANLY!');
  console.log('================================================================================\n');
}

runQte4847RegressionSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[QTE-4847 REGRESSION AUDIT FAILED]:', err);
    process.exit(1);
  });
