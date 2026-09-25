import React from 'react';
import { Product, QuoteItem, Hotel } from '../../types';
import { 
  detectAuthoritativeServiceCategory, 
  isHotelService, 
  isShinkansenService, 
  isVisaService,
  isActivityExperienceService 
} from '../../services/configuratorRoutingEngine';
import { RailJourneyModal } from '../RailJourneyModal';
import { HotelConfigurator } from '../B2BAgentPortal/AddHotelToQuoteModal';
import { ActivityExperienceConfigurator } from '../B2BAgentPortal/AddProductToQuoteModal';
import { VisaServiceAndFacilitationConfigurator } from './VisaServiceAndFacilitationConfigurator';
import { AppDatabase } from '../../services/db';

export interface GlobalConfiguratorRouterProps {
  isOpen: boolean;
  itemOrProduct: Product | QuoteItem | Hotel | null;
  portalOrigin?: 'BUYER' | 'B2B_AGENT' | 'B2B_QUOTE_BUILDER' | 'ADMIN_CMS';
  existingQuoteItemId?: string;
  initialTravelDate?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialInfants?: number;
  initialServiceTime?: string;
  initialNotes?: string;
  onClose: () => void;
  onSuccess?: (item: any) => void;
}

/**
 * GLOBAL CONFIGURATOR ROUTING ENGINE COMPONENT
 *
 * Implements Section 1, 5, 6, 24, 30 & 31 of TheUnbound Architecture Constitution:
 * - Hotel -> Hotel Configurator
 * - Shinkansen -> Shinkansen Dynamic Journey Configurator
 * - Activity / Experience -> Activity & Experience Configurator
 *
 * Enforces: ZERO GENERIC CUSTOMIZER.
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

  const db = AppDatabase.getInstance();

  // 1. Shinkansen Dynamic Journey Configurator
  if (isShinkansenService(itemOrProduct)) {
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
        onAddToQuote={(item) => {
          onClose();
          if (onSuccess) onSuccess(item);
        }}
      />
    );
  }

  // 2. Hotel Configurator
  if (isHotelService(itemOrProduct)) {
    let hotel: Hotel | null = null;
    const allHotels = db.getHotels();

    // Determine target hotel
    if ((itemOrProduct as any).roomTypes) {
      hotel = itemOrProduct as Hotel;
    } else {
      const targetId = (itemOrProduct as QuoteItem).product?.id || (itemOrProduct as Product).id;
      const metaHotelId = (itemOrProduct as any).metadata?.hotelId || (itemOrProduct as any).hotelDetails?.hotelId;
      hotel = allHotels.find(h => h.id === targetId || h.id === metaHotelId || h.name.toLowerCase() === ((itemOrProduct as any).name || '').toLowerCase()) || null;

      // If not found in catalog, construct fallback hotel structure from product
      if (!hotel) {
        const prod = (itemOrProduct as QuoteItem).product || (itemOrProduct as Product);
        hotel = {
          id: prod.id,
          name: prod.name,
          city: prod.city || 'Tokyo',
          country: prod.country || 'Japan',
          destinationId: prod.destinationId || 'dest-japan',
          starRating: 5,
          roomTypes: [
            {
              id: `room-${prod.id}-std`,
              name: 'Standard Deluxe Room',
              roomName: 'Standard Deluxe Room',
              maxOccupancy: 3,
              rates: [
                {
                  id: `rate-${prod.id}-std`,
                  name: 'Best Flexible Wholesale Rate (Breakfast Included)',
                  rateName: 'Best Flexible Wholesale Rate (Breakfast Included)',
                  mealPlan: 'BB',
                  netRatePerNight: prod.adultNetPrice || 25000,
                  sellingRatePerNight: prod.sellingPriceStartingFrom || 32000,
                  currency: prod.currency || 'JPY'
                }
              ]
            }
          ]
        } as unknown as Hotel;
      }
    }

    const qItem = itemOrProduct as QuoteItem;
    const hotelMeta = (qItem as any)?.metadata?.hotelConfigurationPayload;

    return (
      <HotelConfigurator
        hotel={hotel}
        isOpen={true}
        onClose={onClose}
        existingItemId={existingQuoteItemId || qItem.id}
        initialCheckInDate={hotelMeta?.checkInDate || initialTravelDate || qItem.travelDate}
        initialNights={hotelMeta?.nights || 3}
        initialAdults={hotelMeta?.adults ?? initialAdults ?? qItem.pax?.adults ?? 2}
        initialChildren={hotelMeta?.children ?? initialChildren ?? qItem.pax?.children ?? 0}
        initialInfants={hotelMeta?.infants ?? initialInfants ?? qItem.pax?.infants ?? 0}
        initialRoomsCount={hotelMeta?.roomsCount || 1}
        initialRoomId={hotelMeta?.roomId}
        initialRateId={hotelMeta?.rateId}
        initialSpecialRequests={hotelMeta?.specialRequests || initialNotes || qItem.notes}
        initialBedPreference={hotelMeta?.bedPreference}
        onSuccess={(configuredHotel, details) => {
          onClose();
          if (onSuccess) onSuccess({ hotel: configuredHotel, details });
        }}
      />
    );
  }

  // 3. Visa & Ancillary Services Configurator
  if (isVisaService(itemOrProduct)) {
    const qItem = itemOrProduct as QuoteItem;
    return (
      <VisaServiceAndFacilitationConfigurator
        isOpen={true}
        itemOrProduct={itemOrProduct}
        portalOrigin={portalOrigin}
        existingQuoteItemId={existingQuoteItemId || qItem.id}
        initialTravelDate={initialTravelDate || qItem.travelDate}
        initialAdults={initialAdults ?? qItem.pax?.adults ?? 1}
        initialChildren={initialChildren ?? qItem.pax?.children ?? 0}
        initialInfants={initialInfants ?? qItem.pax?.infants ?? 0}
        initialNotes={initialNotes || qItem.notes}
        onClose={onClose}
        onSuccess={(configuredItem, details) => {
          onClose();
          if (onSuccess) onSuccess(configuredItem || details);
        }}
      />
    );
  }

  // 4. Activity & Experience Configurator
  if (isActivityExperienceService(itemOrProduct)) {
    const product: Product = (itemOrProduct as QuoteItem).product || (itemOrProduct as Product);
    const qItem = itemOrProduct as QuoteItem;
    const actMeta = (qItem as any)?.metadata?.activityConfigurationPayload;

    return (
      <ActivityExperienceConfigurator
        product={product}
        isOpen={true}
        onClose={onClose}
        existingItemId={existingQuoteItemId || qItem.id}
        initialTravelDate={actMeta?.travelDate || initialTravelDate || qItem.travelDate}
        initialAdults={actMeta?.pax?.adults ?? initialAdults ?? qItem.pax?.adults ?? 2}
        initialChildren={actMeta?.pax?.children ?? initialChildren ?? qItem.pax?.children ?? 0}
        initialInfants={actMeta?.pax?.infants ?? initialInfants ?? qItem.pax?.infants ?? 0}
        initialServiceTime={actMeta?.serviceTime || initialServiceTime || qItem.serviceTime || '09:30 AM'}
        initialNotes={actMeta?.notes || initialNotes || qItem.notes}
        initialSelectedAddonIds={actMeta?.selectedAddonIds || qItem.selectedAddonIds || []}
        onSuccess={(configuredProduct, details) => {
          onClose();
          if (onSuccess) onSuccess({ product: configuredProduct, details });
        }}
      />
    );
  }

  // Section 25: Error State (Never fall back to generic customizer)
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 animate-in fade-in">
        <h3 className="text-base font-bold text-slate-900 mb-2">Configurator Initialization Notice</h3>
        <p className="text-xs text-slate-600 mb-4">
          Unable to identify authoritative configurator for this service. Generic customizer fallback is strictly disabled by platform architecture.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </div>
  );
};
