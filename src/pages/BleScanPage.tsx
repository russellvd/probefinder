import React, { useState, useEffect } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonItem, IonLabel, IonAccordionGroup, IonAccordion, IonText } from '@ionic/react';
import { BleDevice, BleClient } from '@capacitor-community/bluetooth-le';
import { scanForBleDevices, formatBleDevice, connectToBleDevice, getRssiDescription, getDeviceServices, getBatteryLevel, sendBeep } from '../utils/bleUtils';
import BatteryStatus from '../components/BatteryStatus';

const BleScanPage: React.FC = () => {
  const [devices, setDevices] = useState<(BleDevice & { rssi: number })[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [deviceServicesWithCharacteristics, setDeviceServicesWithCharacteristics] = useState<{ [key: string]: { [serviceUuid: string]: string[] } }>({});
  const [rssiDescriptions, setRssiDescriptions] = useState<{ [deviceId: string]: { description: string, color: string } }>({});
  const [batteryLevels, setBatteryLevels] = useState<{ [deviceId: string]: number }>({});

  const startScan = async () => {
    setIsScanning(true);
    console.log('Scan started...');
    try {
      const discoveredDevices = await scanForBleDevices();
      console.log('Discovered Devices:', discoveredDevices);
      setDevices(discoveredDevices);

      const newRssiDescriptions = discoveredDevices.reduce((acc, device) => {
        const rssiDescription = getRssiDescription(device.rssi);
        acc[device.deviceId] = rssiDescription;
        return acc;
      }, {} as { [deviceId: string]: { description: string, color: string } });

      setRssiDescriptions(newRssiDescriptions);
    } catch (error) {
      console.error('Error during BLE scan:', error);
    }
    setIsScanning(false);
  };

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
      const serviceUUID = Object.keys(deviceServicesWithCharacteristics[deviceId])[0]; // Get the first service UUID
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
                    {rssiDescriptions[device.deviceId]?.description || 'Description not available'}
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

                      {/* Red Button for Sending BEEP */}
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
      </IonContent>
    </IonPage>
  );
};

export default BleScanPage;