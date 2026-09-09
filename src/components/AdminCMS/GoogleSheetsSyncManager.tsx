import React from 'react';
import { GoogleSheetsPanel } from './integrations/GoogleSheetsPanel';
import { useAuth } from '../../context/AuthContext';

export interface GoogleSheetsSyncManagerProps {
  initialView?: 'CONNECTION_HEALTH' | 'IMPORTER' | 'SELECTIVE_SYNC' | 'TEMPLATES' | 'HISTORY';
}

export const GoogleSheetsSyncManager: React.FC<GoogleSheetsSyncManagerProps> = ({ 
  initialView = 'IMPORTER' 
}) => {
  const { user } = useAuth();
  return <GoogleSheetsPanel currentUser={user} initialView={initialView} />;
};

export default GoogleSheetsSyncManager;
