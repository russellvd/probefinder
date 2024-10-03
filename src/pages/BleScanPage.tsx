import React, { useState, useEffect, useRef } from 'react';
import { IonContent, IonBadge, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonItem, IonLabel, IonAccordionGroup, IonAccordion, IonText, IonCard, IonCardContent, IonIcon, IonChip } from '@ionic/react';
import { bluetooth, batteryFull, wifi } from 'ionicons/icons';
import { BleDevice, BleClient } from '@capacitor-community/bluetooth-le';
import { formatBleDevice, connectToBleDevice, getRssiDescription, getDeviceServices, getBatteryLevel, sendBeep, readSerialNumber, startScan, stopScan } from '../utils/bleUtils';
import BatteryStatus from '../components/BatteryStatus';
import './customStyles.css'; // Include this line to apply custom styles

const BleScanPage: React.FC = () => {
  const [devices, setDevices] = useState<(BleDevice & { rssi: number })[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [deviceServicesWithCharacteristics, setDeviceServicesWithCharacteristics] = useState<{ [key: string]: { [serviceUuid: string]: string[] } }>({});
  const [rssiDescriptions, setRssiDescriptions] = useState<{ [deviceId: string]: { description: string, color: string } }>({});
  const [batteryLevels, setBatteryLevels] = useState<{ [deviceId: string]: number }>({});
  const [serialNumbers, setSerialNumbers] = useState<{ [deviceId: string]: string }>({});
  const rssiUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (isScanning) {
        stopScan();
      }
    };
  }, []);

  const handleStartScan = async () => {
    setIsScanning(true);
    try {
      await startScan((result) => handleScanResult(result));
      rssiUpdateIntervalRef.current = setInterval(updateRssiForAllDevices, 4000);
    } catch (error) {
      console.error('Error during BLE scan:', error);
      setIsScanning(false);
    }
  };

  const handleStopScan = async () => {
    try {
      await stopScan();
      setIsScanning(false);
      if (rssiUpdateIntervalRef.current) {
        clearInterval(rssiUpdateIntervalRef.current);
        rssiUpdateIntervalRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping BLE scan:', error);
    }
  };

  const handleScanResult = (result: { device: BleDevice; rssi: number }) => {
    const { device, rssi } = result;

    setDevices((prevDevices) => {
      const existingDeviceIndex = prevDevices.findIndex((d) => d.deviceId === device.deviceId);
      if (existingDeviceIndex !== -1) {
        const updatedDevices = [...prevDevices];
        updatedDevices[existingDeviceIndex] = { ...updatedDevices[existingDeviceIndex], rssi };
        return updatedDevices;
      } else {
        return [...prevDevices, { ...device, rssi }];
      }
    });
    updateRssiDescription(device.deviceId, rssi);
  };

  const updateRssiDescription = (deviceId: string, rssi: number) => {
    const rssiDescription = getRssiDescription(rssi);
    setRssiDescriptions((prevDescriptions) => ({
      ...prevDescriptions,
      [deviceId]: rssiDescription,
    }));
  };

  const updateRssiForAllDevices = async () => {
    try {
      await startScan((result) => handleScanResult(result));
    } catch (error) {
      console.error('Error during BLE scan:', error);
      setIsScanning(false);
    }
  };

  const handleConnectToDevice = async (device: BleDevice & { rssi: number }) => {
    setConnectingDeviceId(device.deviceId);
    try {
      await connectToBleDevice(device);
      const servicesWithCharacteristics = await getDeviceServices(device);
      setDeviceServicesWithCharacteristics((prevServices) => ({
        ...prevServices,
        [device.deviceId]: servicesWithCharacteristics,
      }));

      const batteryLevel = await getBatteryLevel(device.deviceId);
      setBatteryLevels((prevLevels) => ({
        ...prevLevels,
        [device.deviceId]: batteryLevel,
      }));

      await readSerialNumber(device.deviceId);
      setSerialNumbers((prevSerials) => ({
        ...prevSerials,
        [device.deviceId]: 'Fetching...',
      }));

      setConnectedDeviceId(device.deviceId);
    } catch (error) {
      console.error(`Error connecting to or retrieving services for device ${device.deviceId}:`, error);
    }
    setConnectingDeviceId(null);
  };

  const handleDisconnectFromDevice = async (device: BleDevice) => {
    try {
      await BleClient.disconnect(device.deviceId);
      setConnectedDeviceId(null);
    } catch (error) {
      console.error(`Error disconnecting from device ${device.deviceId}:`, error);
    }
  };

  const handleBeep = async (deviceId: string) => {
    try {
      await sendBeep(deviceId);
    } catch (error) {
      console.error('Error sending BEEP command:', error);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 'bold', color: '#009a9a' }}>BLE Scanner</IonTitle> {}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonCard className="ion-margin">
          <IonCardContent>
            <IonButton expand="block" onClick={handleStartScan} disabled={isScanning} style={{ backgroundColor: '#e96604' }}>
              {isScanning ? 'Scanning...' : 'Start Scan'}
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonList>
          <IonAccordionGroup>
            {devices.map((device) => (
              <IonAccordion key={device.deviceId} value={device.deviceId}>
                <IonItem slot="header" color="light">
                  <IonIcon icon={bluetooth} slot="start" />
                  <IonLabel>{formatBleDevice(device)}</IonLabel>
                  <IonBadge
                  color={rssiDescriptions[device.deviceId]?.color}
                  style={{
                    padding: '8px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: rssiDescriptions[device.deviceId]?.color 
                  }}
                >
                  <IonIcon icon={wifi} />
                  {rssiDescriptions[device.deviceId]?.description || 'Unknown'}
                </IonBadge>
                </IonItem>
                <IonCard className="ion-no-margin" slot="content">
                  <IonCardContent>
                    {connectedDeviceId === device.deviceId && batteryLevels[device.deviceId] !== undefined && (
                      <div className="ion-margin-bottom">
                        <BatteryStatus batteryLevel={batteryLevels[device.deviceId]} />
                        <IonText>
                          <p>Serial Number: {serialNumbers[device.deviceId] || 'N/A'}</p>
                        </IonText>
                      </div>
                    )}

                    {connectedDeviceId === device.deviceId ? (
                      <>
                        <IonButton expand="block" color="danger" onClick={() => handleDisconnectFromDevice(device)}>
                          Disconnect
                        </IonButton>
                        <IonButton expand="block" style={{ backgroundColor: '#e96604' }} onClick={() => handleBeep(device.deviceId)}>
                          Send BEEP
                        </IonButton>
                      </>
                    ) : (
                      <IonButton
                        expand="block"
                        onClick={() => handleConnectToDevice(device)}
                        disabled={connectingDeviceId === device.deviceId}
                        style={{ backgroundColor: '#e96604' }}
                      >
                        {connectingDeviceId === device.deviceId ? 'Connecting...' : 'Connect'}
                      </IonButton>
                    )}
                  </IonCardContent>
                </IonCard>
              </IonAccordion>
            ))}
          </IonAccordionGroup>
        </IonList>

        <IonButton
          expand="block"
          color="danger"
          fill="outline"
          onClick={handleStopScan}
          disabled={!isScanning}
          className="ion-margin"
        >
          Stop Scan
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default BleScanPage;
