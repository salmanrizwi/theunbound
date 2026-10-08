import React from 'react';

export interface ModuleMasterSyncBarProps {
  moduleType?: 'PRODUCTS' | 'HOTELS' | 'VISA_ANCILLARY' | 'JAPAN_RAIL';
  title?: string;
  description?: string;
  onSyncCompleted?: (report: any) => void;
  onOpenMasterHub?: () => void;
  className?: string;
}

export const ModuleMasterSyncBar: React.FC<ModuleMasterSyncBarProps> = () => {
  return null;
};

export default ModuleMasterSyncBar;
