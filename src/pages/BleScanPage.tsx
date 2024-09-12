import React, { useState } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonItem, IonLabel } from '@ionic/react';
import { BleDevice } from '@capacitor-community/bluetooth-le';
import { scanForBleDevices, formatBleDevice } from '../utils/bleUtils';

const BleScanPage: React.FC = () => {
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const startScan = async () => {
    setIsScanning(true);
    console.log("scan started :)");
    try {
      const discoveredDevices = await scanForBleDevices();
      console.log('Discovered Devices:', discoveredDevices);

      setDevices(discoveredDevices);
    } catch (error) {
      console.error('Error during BLE scan:', error);
    }
    setIsScanning(false);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>BLE Scanner</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonButton expand="block" onClick={startScan} disabled={isScanning}>
          {isScanning ? 'Scanning...' : 'Start Scan'}
        </IonButton>
        <IonList>
          {devices.map((device) => (
            <IonItem key={device.deviceId}>
              <IonLabel>{formatBleDevice(device)}</IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default BleScanPage;