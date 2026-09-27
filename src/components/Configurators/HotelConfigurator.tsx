import React from 'react';
import { Product, QuoteItem, Hotel } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { AddHotelToQuoteModal } from '../B2BAgentPortal/AddHotelToQuoteModal';

export interface HotelConfiguratorProps {
  isOpen: boolean;
  itemOrProduct?: Product | QuoteItem | Hotel | null;
  hotel?: Hotel | null;
  portalOrigin?: 'BUYER' | 'B2B_AGENT' | 'B2B_QUOTE_BUILDER' | 'ADMIN_CMS' | 'CART';
  existingQuoteItemId?: string;
  initialTravelDate?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialInfants?: number;
  initialServiceTime?: string;
  initialNotes?: string;
  onClose: () => void;
  onSuccess?: (configuredItem: any, details?: any) => void;
}

export const HotelConfigurator: React.FC<HotelConfiguratorProps> = ({
  isOpen,
  itemOrProduct,
  hotel: directHotel,
  portalOrigin = 'B2B_AGENT',
  existingQuoteItemId,
  initialTravelDate,
  initialAdults,
  initialChildren,
  initialInfants,
  initialNotes,
  onClose,
  onSuccess
}) => {
  if (!isOpen) return null;

  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const allHotels = db.getHotels();

  let targetHotel: Hotel | null = directHotel || null;

  if (!targetHotel && itemOrProduct) {
    if ((itemOrProduct as any).roomTypes) {
      targetHotel = itemOrProduct as Hotel;
    } else {
      const targetId = (itemOrProduct as QuoteItem).product?.id || (itemOrProduct as Product).id;
      const metaHotelId = (itemOrProduct as any).metadata?.hotelId || (itemOrProduct as any).hotelDetails?.hotelId;
      const name = ((itemOrProduct as any).name || (itemOrProduct as any).customTitle || '').toLowerCase();

      targetHotel = allHotels.find(h => 
        h.id === targetId || 
        h.id === metaHotelId || 
        h.name.toLowerCase() === name ||
        name.includes(h.name.toLowerCase())
      ) || null;

      if (!targetHotel) {
        const prod = (itemOrProduct as QuoteItem).product || (itemOrProduct as Product);
        targetHotel = {
          id: prod.id || `htl-${Date.now()}`,
          name: prod.name || 'Authoritative Luxury Hotel & Resort',
          city: prod.city || 'Tokyo',
          country: prod.country || 'Japan',
          destinationId: prod.destinationId || 'dest-japan',
          starRating: 5,
          address: prod.city ? `${prod.city} Central District` : 'Tokyo Luxury District',
          heroImage: prod.heroImage || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
          roomTypes: [
            {
              id: `room-${prod.id}-std`,
              name: 'Premier Deluxe King Suite',
              roomName: 'Premier Deluxe King Suite',
              maxOccupancy: 3,
              rates: [
                {
                  id: `rate-${prod.id}-std`,
                  name: 'Best Flexible Wholesale Rate (Breakfast Included)',
                  rateName: 'Best Flexible Wholesale Rate (Breakfast Included)',
                  mealPlan: 'BB',
                  netRatePerNight: prod.adultNetPrice || 35000,
                  sellingRatePerNight: prod.sellingPriceStartingFrom || 45000,
                  currency: prod.currency || 'JPY'
                }
              ]
            }
          ]
        } as unknown as Hotel;
      }
    }
  }

  const qItem: any = itemOrProduct || {};
  const hotelMeta = qItem.metadata?.hotelConfigurationPayload;

  return (
    <AddHotelToQuoteModal
      hotel={targetHotel}
      isOpen={isOpen}
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
        if (portalOrigin === 'ADMIN_CMS' && targetHotel) {
          const configPayload = {
            configuration_id: `cfg-hotel-${targetHotel.id}`,
            product_id: targetHotel.id,
            product_category: 'Hotels',
            configurator_type: 'HOTEL_CONFIGURATOR',
            hotelId: targetHotel.id,
            hotelName: targetHotel.name,
            selectedRoomId: details?.roomId,
            selectedRateId: details?.rateId,
            nights: details?.nights,
            roomsCount: details?.roomsCount,
            details
          };
          db.saveProductConfiguration(targetHotel.id, configPayload, user);
        }
        onClose();
        if (onSuccess) onSuccess(configuredHotel, details);
      }}
    />
  );
};

export default HotelConfigurator;
