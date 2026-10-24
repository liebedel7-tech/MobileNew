import React from 'react';
import { StaffUser, ActiveScreen } from '../types';
import { SystemConnectionScreen } from './SystemConnectionScreen';

interface FlutterConfigScreenProps {
  user: StaffUser | null;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenApkModal?: () => void;
  onSyncTrigger?: () => void;
}

export const FlutterConfigScreen: React.FC<FlutterConfigScreenProps> = (props) => {
  return <SystemConnectionScreen {...props} />;
};

export default FlutterConfigScreen;
