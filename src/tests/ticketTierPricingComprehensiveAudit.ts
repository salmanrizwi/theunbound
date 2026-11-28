/**
 * COMPREHENSIVE AUTOMATED AUDIT — TICKET TIER PRICING, PROPAGATION & VALIDATION
 *
 * Verifies Bug 2 fix end-to-end across pricingEngine, customerQuoteSanitizer,
 * quotationSnapshotService, userCartService, inventoryDisplayHelpers,
 * quotePresentationModel, db quote-to-booking conversion, and TicketConfigurator/B2BProductRowCard wiring:
 *   1. Multi-tier Ticket product (Tier 1 ₹1,000, Tier 2 ₹1,500, Tier 3 ₹2,000, Tier 4 ₹2,500)
 *      — selecting Tier 2/3/4 produces exact tier pricing (NEVER falls back to Tier 1)
 *   2. Switching Tier 2 -> Tier 3 in Quote Builder recalculation updates price & snapshot cleanly
 *   3. Pax multipliers (Adults + Children + Infants) + Native Currency == Target Currency (zero FX drift)
 *      + Cross-currency FX conversion (e.g. JPY tier -> INR target)
 *   4. Exclusive Margin Governance (PRODUCT_LEVEL vs AGENT_LEVEL) + Agent Additional Markup
 *   5. Agent Sanitizer (`sanitizePricingResultForAgent`) preserves selectedTicketTierId/Name/Description
 *   6. Commercial Content Hash (`computeQuotationCommercialContentHash`) changes when tier changes
 *   7. Presentation & Display (`getInventoryConfigurationSummary`, `transformQuoteItemToPresentation`, email formatter)
 *   8. Cart persistence (`buildUserCartItemDocument` + `cartDocumentToVerifiedQuoteItem`) & Booking conversion preserve tier fields
 *   9. Strict fail-closed validation on non-existent or INACTIVE explicit ticketTierId / ticketTierName (ZERO silent Tier 1 fallback)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { AppDatabase } from '../services/db';
import {
  calculateProductPrice,
  calculateProductPriceForAgent,
  calculateQuoteInternalBreakdown,
  buildQuotationCurrencySnapshot,
  clearPricingEngineCache
} from '../services/pricingEngine';
import { sanitizePricingResultForAgent, sanitizeProductForAgent } from '../utils/customerQuoteSanitizer';
import { computeQuotationCommercialContentHash } from '../services/quotationSnapshotService';
import { getInventoryConfigurationSummary } from '../utils/inventoryDisplayHelpers';
import {
  buildQuotePresentationModel,
  transformQuoteItemToPresentation
} from '../services/quotePresentationModel';
import { renderOption2CompleteFormattedHtmlEmail } from '../services/quoteEmailFormatter';
import { buildUserCartItemDocument, cartDocumentToVerifiedQuoteItem } from '../services/userCartService';
import { Product, QuoteItem, Quotation, User } from '../types';

function makeTicketProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'prod_tokyo_museum_tiers',
    name: 'teamLab Planets TOKYO DMM',
    sku: 'TUB-TKT-001',
    destinationId: 'dest_japan',
    destinationName: 'Japan',
    city: 'Tokyo',
    country: 'Japan',
    category: 'Tickets',
    productType: 'Tickets',
    duration: '2 Hours',
    adultNetPrice: 1000,
    childNetPrice: 500,
    infantNetPrice: 0,
    sellingPriceStartingFrom: 1200,
    currency: 'INR',
    taxPercent: 10,
    serviceFeePercent: 0,
    defaultMarkupPercent: 20,
    b2bAgentMarkupPercent: 20,
    supplierId: 'sup_jp_tickets',
    supplierName: 'Tokyo Passes Direct',
    status: 'ACTIVE',
    ticketConfig: {
      ticketType: 'TIMED_ENTRY',
      entryMethod: 'QR_CODE',
      instantConfirmation: true,
      ticketTiers: [
        {
          id: 'tier_1_std',
          name: 'Tier 1 — Standard Entry',
          description: 'General timed entry pass',
          currency: 'INR',
          adultNetPrice: 1000,
          childNetPrice: 500,
          infantNetPrice: 0,
          status: 'ACTIVE'
        },
        {
          id: 'tier_2_priority',
          name: 'Tier 2 — Priority Skip-the-Line',
          description: 'Dedicated priority lane',
          currency: 'INR',
          adultNetPrice: 1500,
          childNetPrice: 750,
          infantNetPrice: 0,
          status: 'ACTIVE'
        },
        {
          id: 'tier_3_vip',
          name: 'Tier 3 — VIP Private Access',
          description: 'Private host + lounge refreshment',
          currency: 'INR',
          adultNetPrice: 2000,
          childNetPrice: 1000,
          infantNetPrice: 0,
          status: 'ACTIVE'
        },
        {
          id: 'tier_4_all',
          name: 'Tier 4 — All-Access + After-Hours',
          description: 'Exclusive after-hours photographer tour',
          currency: 'INR',
          adultNetPrice: 2500,
          childNetPrice: 1250,
          infantNetPrice: 0,
          status: 'ACTIVE'
        },
        {
          id: 'tier_5_retired',
          name: 'Tier 5 — Retired Promo Pass',
          description: 'No longer available',
          currency: 'INR',
          adultNetPrice: 900,
          childNetPrice: 400,
          infantNetPrice: 0,
          status: 'INACTIVE'
        }
      ]
    },
    ...(overrides || {})
  } as unknown as Product;
}

const B2B_AGENT: User = {
  id: 'uid_tier_agent_1',
  name: 'Riya Kapoor',
  email: 'riya@luxurytravels.in',
  role: 'B2B_AGENT',
  category: 'EXTERNAL',
  approvalStatus: 'APPROVED',
  agencyName: 'Luxury Travels India',
  companyId: 'agency_lux_in',
  agentMarginPercent: 15
} as unknown as User;

const CMS_ADMIN: User = {
  id: 'uid_admin_business',
  name: 'Business Admin',
  email: 'business@theunbound.in',
  role: 'ADMIN',
  category: 'INTERNAL',
  approvalStatus: 'APPROVED'
} as unknown as User;

async function runAudit() {
  let passed = 0;
  const pass = (label: string) => {
    passed++;
    console.log(`  [PASS] ${label}`);
  };

  console.log('\n=====================================================================');
  console.log(' TICKET TIER PRICING, PROPAGATION & GOVERNANCE — COMPREHENSIVE AUDIT');
  console.log('=====================================================================\n');

  const db = AppDatabase.getInstance();
  clearPricingEngineCache();
  const ticketProd = makeTicketProduct();

  // Save product into local catalog so db conversions/helpers can find it
  const existingProds = db.getProducts();
  (db as any).setItem('products', [ticketProd, ...existingProds.filter((p) => p.id !== ticketProd.id)]);

  try {

    // --------------------------------------------------------------------------
    // TEST 1: TIER 1 / 2 / 3 / 4 DISTINCT PRICING (NO TIER 1 FALLBACK)
    // --------------------------------------------------------------------------
    console.log('--- TEST 1: Tier 1 / 2 / 3 / 4 Distinct Pricing & Native Currency ---');
    {
      // With Nett = N, Margin 20% = 0.2N, Tax 10% on Margin = 0.02N, Fee 0 => Selling = 1.22N
      const resT1 = calculateProductPrice(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_1_std',
        adults: 1,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT
      });
      const resT2 = calculateProductPrice(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_2_priority',
        adults: 1,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT
      });
      const resT3 = calculateProductPrice(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_3_vip',
        adults: 1,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT
      });
      const resT4 = calculateProductPrice(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_4_all',
        adults: 1,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT
      });

      assert.strictEqual(resT1.selectedTicketTierId, 'tier_1_std');
      assert.strictEqual(resT2.selectedTicketTierId, 'tier_2_priority');
      assert.strictEqual(resT3.selectedTicketTierId, 'tier_3_vip');
      assert.strictEqual(resT4.selectedTicketTierId, 'tier_4_all');

      assert.strictEqual(resT2.selectedTicketTierName, 'Tier 2 — Priority Skip-the-Line');
      assert.strictEqual(resT2.selectedTicketTierDescription, 'Dedicated priority lane');

      // Net costs exact per tier
      assert.strictEqual(resT1.totalNetCost, 1000);
      assert.strictEqual(resT2.totalNetCost, 1500);
      assert.strictEqual(resT3.totalNetCost, 2000);
      assert.strictEqual(resT4.totalNetCost, 2500);

      // Selling prices exact per tier (1.22x net)
      assert.strictEqual(resT1.finalTotalSellingPrice, 1220);
      assert.strictEqual(resT2.finalTotalSellingPrice, 1830);
      assert.strictEqual(resT3.finalTotalSellingPrice, 2440);
      assert.strictEqual(resT4.finalTotalSellingPrice, 3050);

      // Zero spurious FX conversion when tier nativeCurrency === targetCurrency
      assert.strictEqual(resT2.nativeCurrency, 'INR');
      assert.strictEqual(resT2.currency, 'INR');
      assert.strictEqual(Boolean(resT2.fxDetails?.isConverted), false);

      // Agent pricing wrapper strictly mirrors selling price and tier identity while redacting net cost
      const agentT3 = calculateProductPriceForAgent(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_3_vip',
        adults: 1,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT
      });
      assert.strictEqual(agentT3.finalTotalSellingPrice, 2440);
      assert.strictEqual(agentT3.selectedTicketTierId, 'tier_3_vip');
      assert.strictEqual(agentT3.selectedTicketTierName, 'Tier 3 — VIP Private Access');
      assert.strictEqual((agentT3 as any).totalNetCost, undefined);

      pass('Tiers 1/2/3/4 produce distinct exact prices (1220, 1830, 2440, 3050 INR) with zero Tier 1 fallback & zero spurious FX');
    }

    // --------------------------------------------------------------------------
    // TEST 2: PAX MULTIPLIERS + TIER NATIVE FOREIGN CURRENCY & FX CONVERSION
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 2: Pax Multipliers (2 Adults + 1 Child) & Tier Native Currency ---');
    {
      // 2 Adults (1500*2=3000) + 1 Child (750*1=750) = 3750 Nett => Selling = 3750 * 1.22 = 4575
      const paxRes = calculateProductPrice(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_2_priority',
        adults: 2,
        children: 1,
        infants: 1,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT
      });
      assert.strictEqual(paxRes.totalNetCost, 3750);
      assert.strictEqual(paxRes.finalTotalSellingPrice, 4575);

      // Multi-currency tier: Product defaults to USD, Tier 2 is priced natively in JPY
      const jpyProd = makeTicketProduct({
        id: 'prod_jpy_tier_test',
        currency: 'USD',
        ticketConfig: {
          ticketType: 'TIMED_ENTRY',
          instantConfirmation: true,
          ticketTiers: [
            {
              id: 't1_usd',
              name: 'Tier 1 USD',
              currency: 'USD',
              adultNetPrice: 50,
              childNetPrice: 25,
              status: 'ACTIVE'
            },
            {
              id: 't2_jpy',
              name: 'Tier 2 JPY Native',
              currency: 'JPY',
              adultNetPrice: 10000,
              childNetPrice: 5000,
              status: 'ACTIVE'
            }
          ]
        }
      });

      const jpyMatch = calculateProductPrice(jpyProd, {
        productId: jpyProd.id,
        ticketTierId: 't2_jpy',
        adults: 1,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'JPY',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT
      });
      assert.strictEqual(jpyMatch.nativeCurrency, 'JPY');
      assert.strictEqual(jpyMatch.currency, 'JPY');
      assert.strictEqual(Boolean(jpyMatch.fxDetails?.isConverted), false, 'When tier native currency === targetCurrency, no FX conversion runs');
      assert.strictEqual(jpyMatch.finalTotalSellingPrice, 12200);

      const jpyToInr = calculateProductPrice(jpyProd, {
        productId: jpyProd.id,
        ticketTierId: 't2_jpy',
        adults: 1,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT
      });
      assert.strictEqual(jpyToInr.nativeCurrency, 'JPY');
      assert.strictEqual(jpyToInr.currency, 'INR');
      assert.strictEqual(Boolean(jpyToInr.fxDetails?.isConverted), true);
      assert.ok(jpyToInr.finalTotalSellingPrice > 0);

      pass('Pax counts & Tier native currency (exact zero-FX match + JPY->INR conversion) verified');
    }

    // --------------------------------------------------------------------------
    // TEST 3: EXCLUSIVE MARGIN GOVERNANCE (PRODUCT vs AGENT) & QUOTE BREAKDOWN SWITCHING
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 3: Exclusive Margin Governance & Quote Builder Tier Switching ---');
    {
      // AGENT_LEVEL mode: Product-Level Margin = OFF -> Agent 12% margin applied, Product 20% ignored
      clearPricingEngineCache();

      // Tier 3 Net = 2000; Margin 12% = 240; Tax 10% on Margin = 24; Selling = 2264
      const agentModeT3 = calculateProductPrice(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_3_vip',
        adults: 1,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT,
        productLevelMarginEnabled: false,
        customAgentMarginPercent: 12
      });
      assert.strictEqual(agentModeT3.activeMarginMode, 'AGENT_LEVEL');
      assert.strictEqual(agentModeT3.totalNetCost, 2000);
      assert.strictEqual(agentModeT3.markupAmount, 240);
      assert.strictEqual(agentModeT3.taxAmount, 24);
      assert.strictEqual(agentModeT3.finalTotalSellingPrice, 2264);

      // PRODUCT_LEVEL mode: Product 20% margin applied, Agent-level 12% disabled
      const prodModeT3 = calculateProductPrice(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_3_vip',
        adults: 1,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT,
        productLevelMarginEnabled: true,
        customAgentMarginPercent: 12
      });
      assert.strictEqual(prodModeT3.activeMarginMode, 'PRODUCT_LEVEL');
      assert.strictEqual(prodModeT3.finalTotalSellingPrice, 2440);
      clearPricingEngineCache();

      // Quote Builder switching Tier 2 -> Tier 3 + Agent Additional Markup (+₹500 fixed)
      const calcT2 = calculateProductPrice(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_2_priority',
        adults: 2,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT
      });
      const itemTier2: QuoteItem = {
        id: 'qitem_tier_switch_1',
        product: sanitizeProductForAgent(ticketProd),
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-10-15',
        serviceTime: '10:30 AM',
        selectedAddonIds: [],
        ticketTierId: 'tier_2_priority',
        ticketTierName: 'Tier 2 — Priority Skip-the-Line',
        ticketTierDescription: 'Dedicated priority lane',
        agentAdditionalMarkupType: 'FIXED',
        agentAdditionalMarkupValue: 500,
        calculation: sanitizePricingResultForAgent(calcT2) as any
      };

      const bd2 = calculateQuoteInternalBreakdown({
        items: [itemTier2] as any,
        targetCurrency: 'INR',
        productLevelMarginEnabled: true
      });
      // Tier 2 for 2 adults: Net 3000 -> System Sell 3660, plus Agent Additional Fixed 500 = 4160
      assert.strictEqual(bd2.totalNettCost, 3000);
      assert.strictEqual(bd2.baseSellingPrice, 3660);
      assert.strictEqual(bd2.totalAgentAdditionalMarkupAmount, 500);
      assert.strictEqual(bd2.finalPackagePrice, 4160);

      // Switch item in draft from Tier 2 -> Tier 3 (even if product was sanitized and stale Tier 2 calc remained)
      const calcT3 = calculateProductPrice(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_3_vip',
        adults: 2,
        children: 0,
        infants: 0,
        travelDate: '2026-10-15',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT,
        productLevelMarginEnabled: true
      });
      const itemTier3: QuoteItem = {
        ...itemTier2,
        ticketTierId: 'tier_3_vip',
        ticketTierName: 'Tier 3 — VIP Private Access',
        ticketTierDescription: 'Private host + lounge refreshment',
        // Intentionally pass stale calcT2 initially to prove calculateQuoteInternalBreakdown detects selectedTicketTierId mismatch!
        calculation: sanitizePricingResultForAgent(calcT2) as any
      };

      const bd3 = calculateQuoteInternalBreakdown({
        items: [itemTier3] as any,
        targetCurrency: 'INR',
        productLevelMarginEnabled: true
      });
      // Tier 3 for 2 adults: Net 4000 -> System Sell 4880, plus Agent Additional Fixed 500 = 5380
      assert.strictEqual(bd3.totalNettCost, 4000);
      assert.strictEqual(bd3.baseSellingPrice, 4880);
      assert.strictEqual(bd3.totalAgentAdditionalMarkupAmount, 500);
      assert.strictEqual(bd3.finalPackagePrice, 5380);

      // Now populate itemTier3 with calcT3 and verify buildQuotationCurrencySnapshot preserves exact Tier 3 amounts
      const itemTier3Fresh: QuoteItem = {
        ...itemTier3,
        calculation: sanitizePricingResultForAgent(calcT3) as any
      };
      const snap = buildQuotationCurrencySnapshot({
        quoteId: 'Q-TIER-1',
        quoteVersion: 1,
        items: [itemTier3Fresh],
        targetCurrency: 'INR',
        productLevelMarginEnabled: true
      });
      assert.strictEqual(snap.lineItems[0].convertedNetCost, 4000);
      assert.strictEqual(snap.lineItems[0].finalLineSellingAmount, 4880);
      assert.strictEqual(snap.totals.finalCustomerSellingPrice, 5380);

      // Commercial content hash changes cleanly when switching Tier 2 -> Tier 3
      const h2 = computeQuotationCommercialContentHash({
        id: 'Q-TIER-1',
        currency: 'INR',
        items: [itemTier2]
      } as unknown as Quotation);
      const h3 = computeQuotationCommercialContentHash({
        id: 'Q-TIER-1',
        currency: 'INR',
        items: [itemTier3]
      } as unknown as Quotation);
      assert.notStrictEqual(h2, h3, 'Commercial hash MUST differ between Tier 2 and Tier 3');

      pass('Exclusive margin governance (Agent-level vs Product-level), Quote Builder Tier 2->3 switching, Agent markup & commercial hash verified');
    }

    // --------------------------------------------------------------------------
    // TEST 4: SANITIZER, PRESENTATION SUMMARY, CART SERIALIZATION & BOOKING CONVERSION
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 4: Cart Serialization, Presentation Summary & Booking Conversion ---');
    {
      const calcT4 = calculateProductPrice(ticketProd, {
        productId: ticketProd.id,
        ticketTierId: 'tier_4_all',
        adults: 2,
        children: 0,
        infants: 0,
        travelDate: '2026-11-10',
        targetCurrency: 'INR',
        userRole: 'B2B_AGENT',
        user: B2B_AGENT
      });
      const quoteItemT4: QuoteItem = {
        id: 'cart_t4_item',
        product: sanitizeProductForAgent(ticketProd),
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-11-10',
        serviceTime: '06:00 PM',
        selectedAddonIds: [],
        ticketTierId: 'tier_4_all',
        ticketTierName: 'Tier 4 — All-Access + After-Hours',
        ticketTierDescription: 'Exclusive after-hours photographer tour',
        calculation: sanitizePricingResultForAgent(calcT4) as any
      };

      // Cart serialization roundtrip
      const cartDoc = buildUserCartItemDocument({
        ownerUid: B2B_AGENT.id,
        quoteItem: quoteItemT4,
        addedByUid: B2B_AGENT.id,
        addedByRole: 'B2B_AGENT'
      });
      assert.strictEqual(cartDoc.selectedOptions?.ticketTierId, 'tier_4_all');
      assert.strictEqual(cartDoc.selectedOptions?.ticketTierName, 'Tier 4 — All-Access + After-Hours');

      const restoredCartItem = cartDocumentToVerifiedQuoteItem(cartDoc, B2B_AGENT.id);
      assert.ok(restoredCartItem);
      assert.strictEqual(restoredCartItem!.ticketTierId, 'tier_4_all');
      assert.strictEqual(restoredCartItem!.ticketTierName, 'Tier 4 — All-Access + After-Hours');
      assert.strictEqual(restoredCartItem!.ticketTierDescription, 'Exclusive after-hours photographer tour');
      assert.strictEqual(restoredCartItem!.calculation.finalTotalSellingPrice, 6100);

      // Summary / Presentation model (shared by Preview, PDF, and Email formatter)
      const summary = getInventoryConfigurationSummary(restoredCartItem);
      assert.ok(summary.includes('Tier: Tier 4 — All-Access + After-Hours'), `Expected tier in summary: ${summary}`);
      assert.ok(summary.includes('Entry Slot: 06:00 PM'), `Expected entry slot in summary: ${summary}`);

      const pres = transformQuoteItemToPresentation(restoredCartItem!, 'INR');
      assert.ok(pres.configurationSummary.includes('Tier: Tier 4 — All-Access + After-Hours'));
      assert.strictEqual(pres.rawItem.ticketTierId, 'tier_4_all');

      // Quote -> PDF Presentation Model & Formatted Email + Quote -> Booking conversion
      const draftQuoteObj = {
        id: 'Q-TIER-BK-TEST',
        quotationNumber: 'QTE-TIER-100',
        currency: 'INR',
        clientName: 'Aarav Mehta',
        clientEmail: 'aarav@example.com',
        clientPhone: '+91-9876543210',
        destination: 'Japan',
        travelStartDate: '2026-11-10',
        travelEndDate: '2026-11-12',
        items: [restoredCartItem!],
        totalSellingPrice: 6100,
        totalNetCost: 5000,
        status: 'SENT'
      } as unknown as Quotation;

      const pdfModel = buildQuotePresentationModel(draftQuoteObj, {
        name: B2B_AGENT.name,
        agencyName: B2B_AGENT.agencyName,
        email: B2B_AGENT.email
      });
      const pdfServices = pdfModel.days.flatMap((d) => d.services);
      assert.ok(pdfServices.length >= 1);
      assert.ok(
        pdfServices.some((s) => s.configurationSummary.includes('Tier: Tier 4 — All-Access + After-Hours')),
        'PDF presentation model must display Tier 4'
      );

      const emailHtml = renderOption2CompleteFormattedHtmlEmail(pdfModel);
      assert.ok(
        emailHtml.includes('Tier 4'),
        'Option 2 Proposal email HTML must display Tier 4'
      );

      db.saveQuote(draftQuoteObj, CMS_ADMIN, 'SAVED');
      const booking = db.convertQuotationToBooking(draftQuoteObj.id, CMS_ADMIN);
      assert.ok(booking && booking.items.length === 1);
      assert.strictEqual(booking!.items[0].ticketTierId, 'tier_4_all');
      assert.strictEqual(booking!.items[0].ticketTierName, 'Tier 4 — All-Access + After-Hours');
      assert.strictEqual(booking!.items[0].ticketTierDescription, 'Exclusive after-hours photographer tour');
      assert.strictEqual(booking!.items[0].totalPrice, 6100);

      pass('Cart roundtrip, PDF/Email configuration summary, Quote presentation & Quote->Booking preserve Tier 4 end-to-end');
    }

    // --------------------------------------------------------------------------
    // TEST 5: EXPLICIT INVALID / INACTIVE TIER REJECTION (ZERO SILENT TIER 1 FALLBACK)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 5: Explicit Invalid / INACTIVE Ticket Tier Rejection ---');
    {
      assert.throws(
        () =>
          calculateProductPrice(ticketProd, {
            productId: ticketProd.id,
            ticketTierId: 'tier_does_not_exist',
            adults: 1,
            children: 0,
            infants: 0,
            travelDate: '2026-10-15',
            targetCurrency: 'INR',
            userRole: 'B2B_AGENT',
            user: B2B_AGENT
          }),
        /unknown|does not exist/i,
        'Non-existent explicit ticketTierId MUST throw validation error (never fallback to Tier 1)'
      );

      assert.throws(
        () =>
          calculateProductPrice(ticketProd, {
            productId: ticketProd.id,
            ticketTierId: 'tier_5_retired',
            adults: 1,
            children: 0,
            infants: 0,
            travelDate: '2026-10-15',
            targetCurrency: 'INR',
            userRole: 'B2B_AGENT',
            user: B2B_AGENT
          }),
        /inactive/i,
        'INACTIVE explicit ticketTierId MUST throw validation error (never fallback to Tier 1)'
      );

      assert.throws(
        () =>
          calculateProductPrice(ticketProd, {
            productId: ticketProd.id,
            ticketTierName: 'Nonexistent VIP Tier',
            adults: 1,
            children: 0,
            infants: 0,
            travelDate: '2026-10-15',
            targetCurrency: 'INR',
            userRole: 'B2B_AGENT',
            user: B2B_AGENT
          }),
        /unknown|does not exist/i,
        'Non-existent explicit ticketTierName MUST throw validation error'
      );

      const inactiveOnlyProduct = makeTicketProduct({
        id: 'prod_all_tiers_inactive',
        ticketConfig: {
          ticketType: 'TIMED_ENTRY',
          instantConfirmation: true,
          ticketTiers: [
            {
              id: 'only_inactive',
              name: 'Paused Tier',
              currency: 'INR',
              adultNetPrice: 1000,
              status: 'INACTIVE'
            }
          ]
        }
      });
      assert.throws(
        () =>
          calculateProductPrice(inactiveOnlyProduct, {
            productId: inactiveOnlyProduct.id,
            adults: 1,
            children: 0,
            infants: 0,
            travelDate: '2026-10-15',
            targetCurrency: 'INR',
            userRole: 'B2B_AGENT',
            user: B2B_AGENT
          }),
        /No active ticket tiers/i,
        'Product with only INACTIVE tiers must reject pricing'
      );

      pass('Invalid & INACTIVE explicit tiers throw validation errors cleanly with ZERO silent Tier 1 fallback');
    }

    // --------------------------------------------------------------------------
    // TEST 6: UI CONFIGURATOR & QUOTATION CONTEXT STATIC PROPAGATION AUDIT
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 6: UI Configurator & QuotationContext Static Wiring Audit ---');
    {
      const root = process.cwd();
      const ticketCfgSrc = fs.readFileSync(
        path.join(root, 'src/components/Configurators/TicketConfigurator.tsx'),
        'utf-8'
      );
      const rowCardSrc = fs.readFileSync(path.join(root, 'src/components/B2BProductRowCard.tsx'), 'utf-8');
      const quoteCtxSrc = fs.readFileSync(path.join(root, 'src/context/QuotationContext.tsx'), 'utf-8');
      const unifiedSrc = fs.readFileSync(
        path.join(root, 'src/components/B2BAgentPortal/UnifiedB2BQuotationBuilder.tsx'),
        'utf-8'
      );

      assert.ok(ticketCfgSrc.includes('selectedTierId'), 'TicketConfigurator must track immutable selectedTierId');
      assert.ok(
        ticketCfgSrc.includes('calculateProductPrice') && ticketCfgSrc.includes('calculateProductPriceForAgent'),
        'TicketConfigurator must use central pricingEngine (never hardcoded * 1.25)'
      );
      assert.strictEqual(
        ticketCfgSrc.includes('* 1.25'),
        false,
        'TicketConfigurator must NOT contain hardcoded * 1.25 tier markup'
      );
      assert.ok(rowCardSrc.includes('activeTicketTiers'), 'B2BProductRowCard must expose activeTicketTiers selector');
      assert.ok(rowCardSrc.includes('ticketTierId'), 'B2BProductRowCard must forward ticketTierId');
      assert.ok(quoteCtxSrc.includes('resolveItemTierFields'), 'QuotationContext must preserve ticket tier metadata across updates');
      assert.ok(unifiedSrc.includes('ticketTierId'), 'UnifiedB2BQuotationBuilder recalc must forward ticketTierId');

      pass('TicketConfigurator, B2BProductRowCard, QuotationContext & UnifiedB2BQuotationBuilder wiring verified');
    }
  } finally {
    clearPricingEngineCache();
  }

  console.log(`\n=====================================================================`);
  console.log(` ALL ${passed}/${passed} TICKET TIER PRICING AUDIT SUITES PASSED 100%!`);
  console.log(`=====================================================================\n`);
  process.exit(0);
}

runAudit().catch((err) => {
  console.error('\n[FAIL] Ticket Tier Pricing Audit failed:', err);
  process.exit(1);
});
