import React from 'react';
import { Booking, User } from '../../../types';
import { CustomerAndInternalNotes } from '../CustomerAndInternalNotes';

interface DeskNotesSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const DeskNotesSection: React.FC<DeskNotesSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  return (
    <div id="desk-notes-section">
      <CustomerAndInternalNotes
        booking={booking}
        currentUser={currentUser}
        onRefresh={onRefresh}
      />
    </div>
  );
};
