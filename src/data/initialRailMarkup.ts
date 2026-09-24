import { RailMarkupRule } from '../types/rail';

export const INITIAL_RAIL_MARKUP_RULE: RailMarkupRule = {
  id: 'markup-jp-rail-default',
  country: 'Japan',
  destinationId: 'dest-japan',
  railOperator: 'JR Central / JR West / smartEX',
  b2bAgentMarkupPercent: 12, // Wholesale B2B partner markup
  buyerMarkupPercent: 18,    // Retail direct buyer markup
  minMarginJPY: 500,         // Minimum guaranteed margin per ticket
  conciergeServiceFeeJPY: 0,
  oversizedBaggageFeeJPY: 0, // smartEX seat reservation with baggage area is free
  taxPercent: 10,
  lastUpdated: new Date().toISOString(),
  updatedBy: 'Operations Pricing Architect'
};
