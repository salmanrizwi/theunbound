import React from 'react';
import { Product, QuoteItem, Hotel } from '../../types';
import { 
  getConfiguratorForProduct,
  ResolvedConfigurator,
  ProductCategoryEnum
} from '../../services/configuratorRegistry';
import { AlertCircle } from 'lucide-react';

// The 11 Dedicated Configurators
import { PrivateTourConfigurator } from './PrivateTourConfigurator';
import { GroupTourConfigurator } from './GroupTourConfigurator';
import { TransferConfigurator } from './TransferConfigurator';
import { TicketConfigurator } from './TicketConfigurator';
import { PrivateYachtConfigurator } from './PrivateYachtConfigurator';
import { FerryConfigurator } from './FerryConfigurator';
import { GuideConfigurator } from './GuideConfigurator';
import { HotelConfigurator } from './HotelConfigurator';
import { VisaServiceAndFacilitationConfigurator } from './VisaServiceAndFacilitationConfigurator';
import { RailJourneyModal } from '../RailJourneyModal';
import { RestaurantConfigurator } from './RestaurantConfigurator';

export interface GlobalConfiguratorRouterProps {
  isOpen: boolean;
  itemOrProduct: Product | QuoteItem | Hotel | null;
  portalOrigin?: 'BUYER' | 'B2B_AGENT' | 'B2B_QUOTE_BUILDER' | 'ADMIN_CMS' | 'CART';
  existingQuoteItemId?: string;
  initialTravelDate?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialInfants?: number;
  initialServiceTime?: string;
  initialNotes?: string;
  onClose: () => void;
  onSuccess?: (item: any, details?: any) => void;
}

/**
 * AUTHORITATIVE GLOBAL CONFIGURATOR ROUTING ENGINE
 *
 * Implements Section 1, 3, 4 & 5 of TheUnbound Master Product Architecture:
 * EXACTLY 11 Authoritative Categories -> EXACTLY 11 Dedicated Configurators
 *
 * 1. Private Tours               -> Private Tour Configurator
 * 2. Group Tours                 -> Group Tour Configurator
 * 3. Transfers                   -> Transfer Configurator
 * 4. Tickets                     -> Ticket Configurator
 * 5. Private Yacht               -> Private Yacht Configurator
 * 6. Ferries                     -> Ferry Configurator
 * 7. Guides                      -> Guide Configurator
 * 8. Hotels                      -> Hotel Configurator
 * 9. Visa & Ancillary Services   -> Visa & Ancillary Services Configurator
 * 10. Rail / Shinkansen          -> Shinkansen Dynamic Journey Configurator
 * 11. Lunch / Dinner Restaurant  -> Restaurant Configurator
 *
 * ZERO GENERIC CUSTOMIZER sits in the configuration flow.
 */
export const GlobalConfiguratorRouter: React.FC<GlobalConfiguratorRouterProps> = ({
  isOpen,
  itemOrProduct,
  portalOrigin = 'BUYER',
  existingQuoteItemId,
  initialTravelDate,
  initialAdults,
  initialChildren,
  initialInfants,
  initialServiceTime,
  initialNotes,
  onClose,
  onSuccess
}) => {
  if (!isOpen || !itemOrProduct) return null;

  // Resolve authoritative configurator via Central Resolver (Section 11)
  const resolved = getConfiguratorForProduct(itemOrProduct);

  if (!resolved) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-2">Category Not Resolved</h3>
          <p className="text-xs text-slate-600 mb-5 leading-relaxed">
            Unable to determine the configuration module for this product. Please contact an administrator.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleSuccess = (configuredItem: any, details?: any) => {
    onClose();
    if (onSuccess) onSuccess(configuredItem, details);
  };

  switch (resolved.categoryEnum) {
    // 01 — Private Tours
    case 'PRIVATE_TOURS':
      return (
        <PrivateTourConfigurator
          isOpen={true}
          itemOrProduct={itemOrProduct}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId}
          initialTravelDate={initialTravelDate}
          initialAdults={initialAdults}
          initialChildren={initialChildren}
          initialInfants={initialInfants}
          initialServiceTime={initialServiceTime}
          initialNotes={initialNotes}
          onClose={onClose}
          onSuccess={handleSuccess}
        />
      );

    // 02 — Group Tours
    case 'GROUP_TOURS':
      return (
        <GroupTourConfigurator
          isOpen={true}
          itemOrProduct={itemOrProduct}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId}
          initialTravelDate={initialTravelDate}
          initialAdults={initialAdults}
          initialChildren={initialChildren}
          initialInfants={initialInfants}
          initialServiceTime={initialServiceTime}
          initialNotes={initialNotes}
          onClose={onClose}
          onSuccess={handleSuccess}
        />
      );

    // 03 — Transfers
    case 'TRANSFERS':
      return (
        <TransferConfigurator
          isOpen={true}
          itemOrProduct={itemOrProduct}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId}
          initialTravelDate={initialTravelDate}
          initialAdults={initialAdults}
          initialChildren={initialChildren}
          initialInfants={initialInfants}
          initialServiceTime={initialServiceTime}
          initialNotes={initialNotes}
          onClose={onClose}
          onSuccess={handleSuccess}
        />
      );

    // 04 — Tickets
    case 'TICKETS':
      return (
        <TicketConfigurator
          isOpen={true}
          itemOrProduct={itemOrProduct}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId}
          initialTravelDate={initialTravelDate}
          initialAdults={initialAdults}
          initialChildren={initialChildren}
          initialInfants={initialInfants}
          initialServiceTime={initialServiceTime}
          initialNotes={initialNotes}
          onClose={onClose}
          onSuccess={handleSuccess}
        />
      );

    // 05 — Private Yacht
    case 'PRIVATE_YACHT':
      return (
        <PrivateYachtConfigurator
          isOpen={true}
          itemOrProduct={itemOrProduct}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId}
          initialTravelDate={initialTravelDate}
          initialAdults={initialAdults}
          initialChildren={initialChildren}
          initialInfants={initialInfants}
          initialServiceTime={initialServiceTime}
          initialNotes={initialNotes}
          onClose={onClose}
          onSuccess={handleSuccess}
        />
      );

    // 06 — Ferries
    case 'FERRIES':
      return (
        <FerryConfigurator
          isOpen={true}
          itemOrProduct={itemOrProduct}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId}
          initialTravelDate={initialTravelDate}
          initialAdults={initialAdults}
          initialChildren={initialChildren}
          initialInfants={initialInfants}
          initialServiceTime={initialServiceTime}
          initialNotes={initialNotes}
          onClose={onClose}
          onSuccess={handleSuccess}
        />
      );

    // 07 — Guides
    case 'GUIDES':
      return (
        <GuideConfigurator
          isOpen={true}
          itemOrProduct={itemOrProduct}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId}
          initialTravelDate={initialTravelDate}
          initialAdults={initialAdults}
          initialChildren={initialChildren}
          initialInfants={initialInfants}
          initialServiceTime={initialServiceTime}
          initialNotes={initialNotes}
          onClose={onClose}
          onSuccess={handleSuccess}
        />
      );

    // 08 — Hotels
    case 'HOTELS':
      return (
        <HotelConfigurator
          isOpen={true}
          itemOrProduct={itemOrProduct}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId}
          initialTravelDate={initialTravelDate}
          initialAdults={initialAdults}
          initialChildren={initialChildren}
          initialInfants={initialInfants}
          initialNotes={initialNotes}
          onClose={onClose}
          onSuccess={handleSuccess}
        />
      );

    // 09 — Visa & Ancillary Services
    case 'VISA_ANCILLARY':
      return (
        <VisaServiceAndFacilitationConfigurator
          isOpen={true}
          itemOrProduct={itemOrProduct}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId}
          initialTravelDate={initialTravelDate}
          initialAdults={initialAdults}
          initialChildren={initialChildren}
          initialInfants={initialInfants}
          initialNotes={initialNotes}
          onClose={onClose}
          onSuccess={handleSuccess}
        />
      );

    // 10 — Rail / Shinkansen
    case 'SHINKANSEN':
    case 'RAIL': {
      const product: Product = (itemOrProduct as QuoteItem).product || (itemOrProduct as Product);
      const existingSnapshot = (itemOrProduct as QuoteItem).japanRailJourneySnapshot ||
        (itemOrProduct as any).metadata?.journeySnapshot ||
        (itemOrProduct as QuoteItem).railJourneyDetails;

      return (
        <RailJourneyModal
          product={product}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId || (itemOrProduct as QuoteItem).id}
          existingJourneySnapshot={existingSnapshot}
          initialOriginStationId={(itemOrProduct as QuoteItem).railJourneyDetails?.originStationId || 'JP-ST-TOKYO'}
          initialDestinationStationId={(itemOrProduct as QuoteItem).railJourneyDetails?.destinationStationId || 'JP-ST-KYOTO'}
          initialTravelDate={initialTravelDate || (itemOrProduct as QuoteItem).travelDate}
          onClose={onClose}
          onAddToQuote={handleSuccess}
        />
      );
    }

    // 11 — Lunch / Dinner Restaurant
    case 'RESTAURANT':
      return (
        <RestaurantConfigurator
          isOpen={true}
          itemOrProduct={itemOrProduct}
          portalOrigin={portalOrigin}
          existingQuoteItemId={existingQuoteItemId}
          initialTravelDate={initialTravelDate}
          initialAdults={initialAdults}
          initialChildren={initialChildren}
          initialInfants={initialInfants}
          initialServiceTime={initialServiceTime}
          initialNotes={initialNotes}
          onClose={onClose}
          onSuccess={handleSuccess}
        />
      );

    // Strict Architectural Fallback
    default:
      return (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Category Not Resolved</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Unable to determine the configuration module for this product. Please contact an administrator.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      );
  }
};
