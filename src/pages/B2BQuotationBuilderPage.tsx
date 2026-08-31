import React from 'react';
import { Product, Destination, Quotation } from '../types';
import { UnifiedB2BQuotationBuilder } from '../components/B2BAgentPortal/UnifiedB2BQuotationBuilder';

export interface B2BQuotationBuilderPageProps {
  destinations: Destination[];
  products: Product[];
  onViewProductDetails: (product: Product) => void;
  onOpenSpecs?: () => void;
  onBookQuotation?: (quotation: Quotation) => void;
}

export const B2BQuotationBuilderPage: React.FC<B2BQuotationBuilderPageProps> = ({
  destinations,
  products,
  onViewProductDetails,
  onOpenSpecs,
  onBookQuotation
}) => {
  return (
    <UnifiedB2BQuotationBuilder
      destinations={destinations}
      products={products}
      onViewProductDetails={onViewProductDetails}
      onOpenSpecs={onOpenSpecs}
      onBookQuotation={onBookQuotation}
      onConvertToBooking={onBookQuotation}
    />
  );
};
