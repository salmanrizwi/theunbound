import React from 'react';
import { Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { GlobalConfiguratorRouter } from './Configurators/GlobalConfiguratorRouter';

export interface PricingCalculatorModalProps {
  product: Product;
  onClose: () => void;
  onAddedToQuote?: () => void;
}

export const PricingCalculatorModal: React.FC<PricingCalculatorModalProps> = ({
  product,
  onClose,
  onAddedToQuote
}) => {
  const { role } = useAuth();

  return (
    <GlobalConfiguratorRouter
      isOpen={true}
      itemOrProduct={product}
      portalOrigin={role === 'BUYER' ? 'BUYER' : 'B2B_AGENT'}
      onClose={onClose}
      onSuccess={() => {
        onClose();
        if (onAddedToQuote) onAddedToQuote();
      }}
    />
  );
};

export default PricingCalculatorModal;
