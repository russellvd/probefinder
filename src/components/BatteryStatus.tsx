import React from 'react';
import { IonIcon } from '@ionic/react';
import { batteryFull, batteryHalf, batteryDead } from 'ionicons/icons';

interface BatteryStatusProps {
  batteryLevel: number;
}

const BatteryStatus: React.FC<BatteryStatusProps> = ({ batteryLevel }) => {
  let icon;
  if (batteryLevel >= 75) {
    icon = batteryFull;
  } else if (batteryLevel >= 10) {
    icon = batteryHalf;
  } else {
    icon = batteryDead;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <IonIcon icon={icon} style={{ fontSize: '24px', color: 'black' }} />
      <span style={{ marginLeft: '8px' }}>{batteryLevel}%</span>
    </div>
  );
};

export default BatteryStatus;
