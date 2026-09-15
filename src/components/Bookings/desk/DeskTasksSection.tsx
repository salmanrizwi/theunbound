import React from 'react';
import { Booking, User } from '../../../types';
import { BookingTasksSection } from '../../AdminCMS/tasks/BookingTasksSection';

interface DeskTasksSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const DeskTasksSection: React.FC<DeskTasksSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  return (
    <div id="desk-tasks-section">
      <BookingTasksSection
        booking={booking}
        currentUser={currentUser}
      />
    </div>
  );
};
