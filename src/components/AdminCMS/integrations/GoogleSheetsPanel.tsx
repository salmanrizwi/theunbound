import React from 'react';

export interface GoogleSheetsPanelProps {
  currentUser?: any;
  onRefresh?: () => void;
  onNavigateToMasterSync?: () => void;
  initialView?: string;
}

export const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = () => {
  return null;
};

export default GoogleSheetsPanel;
