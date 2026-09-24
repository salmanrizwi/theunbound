import React from 'react';
import { Product, QuoteItem } from '../types';
import { RailCarType, RailPricingResult } from '../types/rail';
import { JapanRailJourneyConfigurator } from './JapanRail/JapanRailJourneyConfigurator';
import { useAuth } from '../context/AuthContext';
import { JourneyPortalOrigin } from '../types/japanRailJourney';

export interface RailJourneyModalProps {
  product: Product;
  onClose: () => void;
  onAddToQuote?: (item: QuoteItem) => void;
  onInstantBook?: (product: Product, pricingResult: RailPricingResult) => void;
  onSelectCarType?: (carType: RailCarType) => void;
  initialOriginStationId?: string;
  initialDestinationStationId?: string;
  portalOrigin?: JourneyPortalOrigin;
  existingQuoteItemId?: string;
  existingJourneySnapshot?: any;
}

/**
 * RailJourneyModal is the platform wrapper around the shared
 * authoritative JapanRailJourneyConfigurator engine.
 */
export const RailJourneyModal: React.FC<RailJourneyModalProps> = ({
  product,
  onClose,
  onAddToQuote,
  onInstantBook,
  initialOriginStationId = 'JP-ST-TOKYO',
  initialDestinationStationId = 'JP-ST-KYOTO',
  portalOrigin: explicitOrigin,
  existingQuoteItemId,
  existingJourneySnapshot
}) => {
  const { user } = useAuth();

  // Resolve role-specific portal origin if not explicitly provided
  const resolvedOrigin: JourneyPortalOrigin = explicitOrigin || (() => {
    if (user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER') {
      return 'ADMIN_CMS';
    }
    if (user?.role === 'B2B_AGENT' || user?.role === 'AGENT') {
      return 'B2B_AGENT';
    }
    return 'BUYER';
  })();

  return (
    <JapanRailJourneyConfigurator
      portalOrigin={resolvedOrigin}
      initialProduct={product}
      onClose={onClose}
      onAddToQuote={onAddToQuote}
      onInstantBook={onInstantBook}
      initialOriginStationId={initialOriginStationId}
      initialDestinationStationId={initialDestinationStationId}
      existingQuoteItemId={existingQuoteItemId}
      existingJourneySnapshot={existingJourneySnapshot}
    />
  );
};
