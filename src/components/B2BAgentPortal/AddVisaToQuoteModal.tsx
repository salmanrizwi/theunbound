import React from 'react';
import { VisaProduct } from './B2BVisaView';
import { 
  VisaServiceAndFacilitationConfigurator,
  visaProductToProduct 
} from '../Configurators/VisaServiceAndFacilitationConfigurator';

export interface AddVisaToQuoteModalProps {
  visa: VisaProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (visa: VisaProduct, details: { applicants: number; travelDate: string; notes?: string }) => void;
  existingItemId?: string;
  existingQuoteItemId?: string;
  initialTravelDate?: string;
  initialApplicants?: number;
  initialNotes?: string;
  onAdded?: () => void;
}

/**
 * Dedicated Visa & Ancillary Services Configurator Entry Point
 * 
 * Enforces: ZERO GENERIC CUSTOMIZER.
 * Connects directly to authoritative canonical Visa inventory and structured requirement engine.
 */
export const AddVisaToQuoteModal: React.FC<AddVisaToQuoteModalProps> = ({
  visa,
  isOpen,
  onClose,
  onSuccess,
  existingItemId,
  existingQuoteItemId,
  initialTravelDate,
  initialApplicants = 1,
  initialNotes = '',
  onAdded
}) => {
  if (!isOpen || !visa) return null;

  return (
    <VisaServiceAndFacilitationConfigurator
      isOpen={isOpen}
      visa={visa}
      itemOrProduct={visa}
      portalOrigin="B2B_AGENT"
      existingQuoteItemId={existingItemId || existingQuoteItemId}
      initialTravelDate={initialTravelDate}
      initialAdults={initialApplicants}
      initialNotes={initialNotes}
      onClose={onClose}
      onSuccess={(configuredProduct, details) => {
        if (onSuccess) {
          onSuccess(details?.visa || visa, {
            applicants: details?.applicants || initialApplicants,
            travelDate: details?.travelDate || initialTravelDate || '',
            notes: details?.snapshot?.notes || initialNotes
          });
        }
        if (onAdded) {
          onAdded();
        }
      }}
    />
  );
};

export { 
  VisaServiceAndFacilitationConfigurator,
  visaProductToProduct 
};
