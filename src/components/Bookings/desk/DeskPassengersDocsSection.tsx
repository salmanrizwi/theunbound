import React from 'react';
import { Booking, User } from '../../../types';
import { PassengerManifestManager } from '../PassengerManifestManager';

interface DeskPassengersDocsSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const DeskPassengersDocsSection: React.FC<DeskPassengersDocsSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  return (
    <div id="desk-passengers-docs-section">
      <PassengerManifestManager
        booking={booking}
        currentUser={currentUser}
        onRefresh={onRefresh}
      />
    </div>
  );
};
