import React from 'react';
import { User } from '../../types';
import { OperationsCommandCenter } from './overview/OperationsCommandCenter';

interface CMSDashboardHomeProps {
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
  currentUser?: User | null;
}

export const CMSDashboardHome: React.FC<CMSDashboardHomeProps> = ({
  onNavigate,
  currentUser = null
}) => {
  return (
    <OperationsCommandCenter
      currentUser={currentUser || null}
      onNavigate={onNavigate}
    />
  );
};
