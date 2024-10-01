import React, { useState, useEffect, useRef } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonItem, IonLabel, IonAccordionGroup, IonAccordion, IonText } from '@ionic/react';
import { BleDevice, BleClient, ScanResult } from '@capacitor-community/bluetooth-le';
import { formatBleDevice, connectToBleDevice, getRssiDescription, getDeviceServices, getBatteryLevel, sendBeep } from '../utils/bleUtils';
import BatteryStatus from '../components/BatteryStatus';

const BleScanPage: React.FC = () => {
  const [devices, setDevices] = useState<(BleDevice & { rssi: number })[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [deviceServicesWithCharacteristics, setDeviceServicesWithCharacteristics] = useState<{ [key: string]: { [serviceUuid: string]: string[] } }>({});
  const [rssiDescriptions, setRssiDescriptions] = useState<{ [deviceId: string]: { description: string, color: string } }>({});
  const [batteryLevels, setBatteryLevels] = useState<{ [deviceId: string]: number }>({});
  const rssiUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startScan = async () => {
    setIsScanning(true);
    console.log('Scan started...');
    try {
      await BleClient.initialize();
      await BleClient.requestLEScan(
        {
          services: ['71C47CD7-D486-4CA3-A350-8379EDFAED8C'], // PRIMARY_SERVICE UUID
        },
        (result) => handleScanResult(result)
      );
      
      // Start periodic RSSI updates
      rssiUpdateIntervalRef.current = setInterval(updateRssiForAllDevices, 2000);
    } catch (error) {
      console.error('Error during BLE scan:', error);
      setIsScanning(false);
    }
  };

  const handleScanResult = (result: ScanResult) => {
    const { device, rssi } = result;
    if (rssi !== undefined) {
      setDevices((prevDevices) => {
        const existingDeviceIndex = prevDevices.findIndex(d => d.deviceId === device.deviceId);
        if (existingDeviceIndex !== -1) {
          const updatedDevices = [...prevDevices];
          updatedDevices[existingDeviceIndex] = { ...updatedDevices[existingDeviceIndex], rssi };
          return updatedDevices;
        } else {
          return [...prevDevices, { ...device, rssi }];
        }
      });
      updateRssiDescription(device.deviceId, rssi);
    }
  };

  const stopScan = async () => {
    console.log('Stopping scan...');
    try {
      await BleClient.stopLEScan();
      setIsScanning(false);
      // Stop periodic RSSI updates
      if (rssiUpdateIntervalRef.current) {
        clearInterval(rssiUpdateIntervalRef.current);
        rssiUpdateIntervalRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping BLE scan:', error);
    }
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
      await BleClient.initialize();
      await BleClient.requestLEScan(
        {
          services: ['71C47CD7-D486-4CA3-A350-8379EDFAED8C'], // PRIMARY_SERVICE UUID
        },
        (result) => handleScanResult(result)
      );
    } catch (error) {
      console.error('Error during BLE scan:', error);
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (isScanning) {
        stopScan();
      }
    };
  }, []);

  const handleConnectToDevice = async (device: BleDevice & { rssi: number }) => {
    setConnectingDeviceId(device.deviceId);
    console.log(`Connecting to device: ${device.deviceId}`);
    try {
      await connectToBleDevice(device);
      console.log(`Successfully connected to ${device.deviceId}`);

      const servicesWithCharacteristics = await getDeviceServices(device);
      setDeviceServicesWithCharacteristics((prevServices) => ({
        ...prevServices,
        [device.deviceId]: servicesWithCharacteristics,
      }));

      // Get battery level
      const batteryLevel = await getBatteryLevel(device.deviceId);
      setBatteryLevels((prevLevels) => ({
        ...prevLevels,
        [device.deviceId]: batteryLevel,
      }));

      setConnectedDeviceId(device.deviceId);
      console.log(`Services and characteristics for device ${device.deviceId}:`, servicesWithCharacteristics);
    } catch (error) {
      console.error(`Error connecting to or retrieving services for device ${device.deviceId}:`, error);
    }
    setConnectingDeviceId(null);
  };

  const handleDisconnectFromDevice = async (device: BleDevice) => {
    console.log(`Disconnecting from device: ${device.deviceId}`);
    try {
      await BleClient.disconnect(device.deviceId);
      console.log(`Successfully disconnected from ${device.deviceId}`);
      setConnectedDeviceId(null);
    } catch (error) {
      console.error(`Error disconnecting from device ${device.deviceId}:`, error);
    }
  };

  const handleBeep = async (deviceId: string) => {
    console.log(`Sending BEEP to device: ${deviceId}`);
    try {
      await sendBeep(deviceId);
      console.log('BEEP command sent successfully');
    } catch (error) {
      console.error('Error sending BEEP command:', error);
    }
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
          <IonAccordionGroup>
            {devices.map((device) => (
              <IonAccordion key={device.deviceId} value={device.deviceId}>
                <IonItem slot="header">
                  <IonLabel>
                    {formatBleDevice(device)}
                  </IonLabel>
                  <IonText
                    style={{
                      color: rssiDescriptions[device.deviceId]?.color,
                      fontWeight: 'bold'
                    }}
                  >
                    {rssiDescriptions[device.deviceId]?.description || 'Description not available'} ({device.rssi} dBm)
                  </IonText>
                </IonItem>

                <div className="ion-padding" slot="content">
                  {connectedDeviceId === device.deviceId && batteryLevels[device.deviceId] !== undefined ? (
                    <BatteryStatus batteryLevel={batteryLevels[device.deviceId]} />
                  ) : null}

                  {connectedDeviceId === device.deviceId ? (
                    <>
                      <IonButton
                        expand="block"
                        color="danger"
                        onClick={() => handleDisconnectFromDevice(device)}
                      >
                        Disconnect
                      </IonButton>

                      <IonButton
                        expand="block"
                        color="tertiary"
                        onClick={() => handleBeep(device.deviceId)}
                      >
                        Send BEEP
                      </IonButton>
                    </>
                  ) : (
                    <IonButton
                      expand="block"
                      onClick={() => handleConnectToDevice(device)}
                      disabled={connectingDeviceId === device.deviceId}
                    >
                      {connectingDeviceId === device.deviceId ? 'Connecting...' : 'Connect'}
                    </IonButton>
                  )}
                </div>
              </IonAccordion>
            ))}
          </IonAccordionGroup>
        </IonList>

        <IonButton
          expand="block"
          color="danger"
          fill="outline"
          onClick={stopScan}
          disabled={!isScanning}
          style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '90%' }}
        >
          Stop Scan
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default BleScanPage;