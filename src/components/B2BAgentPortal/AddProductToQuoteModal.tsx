import React from 'react';
import { Product } from '../../types';
import { GlobalConfiguratorRouter } from '../Configurators/GlobalConfiguratorRouter';

export interface AddProductToQuoteModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (product: Product, details: { travelDate: string; serviceTime?: string; adults: number; children: number; infants: number }) => void;
  existingItemId?: string;
  initialTravelDate?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialInfants?: number;
  initialServiceTime?: string;
  initialNotes?: string;
  initialSelectedAddonIds?: string[];
}

/**
 * AddProductToQuoteModal
 * Authoritative B2B Agent Modal wrapper that routes dynamically to the dedicated
 * category configurator via GlobalConfiguratorRouter.
 * Guarantees that the product category determines the configurator.
 */
export const AddProductToQuoteModal: React.FC<AddProductToQuoteModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
  existingItemId,
  initialTravelDate,
  initialAdults = 2,
  initialChildren = 0,
  initialInfants = 0,
  initialServiceTime = '09:30 AM',
  initialNotes = '',
  initialSelectedAddonIds = []
}) => {
  if (!isOpen || !product) return null;

  return (
    <GlobalConfiguratorRouter
      isOpen={isOpen}
      itemOrProduct={product}
      portalOrigin="B2B_AGENT"
      existingQuoteItemId={existingItemId}
      initialTravelDate={initialTravelDate}
      initialAdults={initialAdults}
      initialChildren={initialChildren}
      initialInfants={initialInfants}
      initialServiceTime={initialServiceTime}
      initialNotes={initialNotes}
      onClose={onClose}
      onSuccess={(configuredItem, details) => {
        onClose();
        if (onSuccess && product) {
          onSuccess(product, {
            travelDate: details?.travelDate || configuredItem?.travelDate || initialTravelDate || '',
            serviceTime: details?.serviceTime || initialServiceTime,
            adults: details?.adults || details?.applicants || configuredItem?.pax?.adults || initialAdults,
            children: details?.children || configuredItem?.pax?.children || initialChildren,
            infants: details?.infants || configuredItem?.pax?.infants || initialInfants
          });
        }
      }}
    />
  );
};
