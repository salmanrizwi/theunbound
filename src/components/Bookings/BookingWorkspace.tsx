import React from 'react';
import { User } from '../../types';
import { BookingOperationsDesk, DeskSection } from './BookingOperationsDesk';

interface BookingWorkspaceProps {
  bookingId: string;
  currentUser: User | null;
  onBack: () => void;
  initialTab?: 'ALL' | 'OPERATIONS' | 'TASKS' | 'PASSENGERS' | 'PAYMENTS' | 'NOTES' | 'TIMELINE';
}

export const BookingWorkspace: React.FC<BookingWorkspaceProps> = ({
  bookingId,
  currentUser,
  onBack,
  initialTab = 'OVERVIEW' as any
}) => {
  // Map legacy tabs to the new 7-section layout
  let mappedSection: DeskSection = 'OVERVIEW';
  if (initialTab === 'OPERATIONS') mappedSection = 'SERVICES';
  else if (initialTab === 'TASKS') mappedSection = 'TASKS';
  else if (initialTab === 'PASSENGERS') mappedSection = 'PASSENGERS';
  else if (initialTab === 'PAYMENTS') mappedSection = 'PAYMENTS';
  else if (initialTab === 'NOTES') mappedSection = 'NOTES';
  else if (initialTab === 'TIMELINE') mappedSection = 'TIMELINE';

  return (
    <BookingOperationsDesk
      bookingId={bookingId}
      currentUser={currentUser}
      onBack={onBack}
      initialSection={mappedSection}
    />
  );
};
