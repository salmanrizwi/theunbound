import React from 'react';
import { Booking, User } from '../../../types';
import { PaymentProofsManager } from '../PaymentProofsManager';

interface DeskPaymentsSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const DeskPaymentsSection: React.FC<DeskPaymentsSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  return (
    <div id="desk-payments-section">
      <PaymentProofsManager
        booking={booking}
        currentUser={currentUser}
        onRefresh={onRefresh}
      />
    </div>
  );
};
