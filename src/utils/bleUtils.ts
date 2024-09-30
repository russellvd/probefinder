import { BleClient, BleDevice, hexStringToDataView } from '@capacitor-community/bluetooth-le';

const PRIMARY_SERVICE = '71C47CD7-D486-4CA3-A350-8379EDFAED8C';
const HEARTBEAT = '255E7B9C-ABF8-49BF-BE78-DD03B59D31A2';
const BATTERY = '00002A19-0000-1000-8000-00805F9B34FB';
const PRB_BTN = 'DCD0C4E2-BC02-40A7-B6D7-D994B421283B';
const CMD_IN = '8C64619E-006E-4303-A8B9-9C4A9ADE5334';

interface RssiThreshold {
  max: number;
  label: string;
  color: string;
}

// Define the RSSI thresholds and corresponding descriptions
const RSSI_THRESHOLDS: RssiThreshold[] = [
  { max: -60, label: 'VERY CLOSE', color: 'green' },
  { max: -70, label: 'NEAR', color: 'lightgreen' },
  { max: -80, label: 'FAR', color: 'orange' },
  { max: -90, label: 'VERY FAR', color: 'red' }
];

/**
 * Initializes the BLE module and starts scanning for devices.
 * @param scanDuration Duration of the scan in milliseconds (default: 5000ms)
 * @returns A promise that resolves to an array of discovered BLE devices
 */
export async function scanForBleDevices(scanDuration: number = 5000): Promise<(BleDevice & { rssi: number })[]> {
  const devices: (BleDevice & { rssi: number })[] = [];
  console.log("scan start!");

  try {
    await BleClient.initialize();
    console.log("ble initialized!");
    // Request BLE permissions (for Android)
    await BleClient.requestLEScan(
      {
        services: [PRIMARY_SERVICE], // filter by unique characteristic UUID to ensure *ONLY* probes appear
      },
      (result) => {
        const { device, rssi } = result;
        if (rssi !== undefined) {
          const deviceWithRssi = { ...device, rssi }; // Add RSSI to the device object
          if (!devices.some(d => d.deviceId === deviceWithRssi.deviceId)) {
              console.log("device pushed!");
              devices.push(deviceWithRssi);
          }
        }
      }
    );

    // Stop scanning after the specified duration
    await new Promise(resolve => setTimeout(resolve, scanDuration));
    await BleClient.stopLEScan();
    return devices;
  } catch (error) {
    console.error('Error scanning for BLE devices:', error);
    throw error;
  }
}

/**
 * Formats a BLE device object into a readable string.
 * @param device The BLE device object
 * @returns A formatted string representation of the device
 */
export function formatBleDevice(device: BleDevice & { rssi: number }): string {
  console.log("formatting device!");
  console.log(`Device:`);
  return `Probe: ${device.name || 'Unnamed'} (ID: ${device.deviceId})`;
}

/**
 * Connects to a given BLE device.
 * @param device The BLE device to connect to
 * @returns A promise that resolves when the connection is established
 */
export async function connectToBleDevice(device: BleDevice & { rssi: number }): Promise<void> {
  try {
    console.log(`Attempting to connect to device: ${formatBleDevice(device)}`);
    await BleClient.connect(device.deviceId);
    console.log(`Successfully connected to device: ${formatBleDevice(device)}`);
  } catch (error) {
    console.error(`Error connecting to device ${device.deviceId}:`, error);
    throw error;
  }
}

/**
 * Gets all services for a connected BLE device.
 * @param device The BLE device to retrieve services from
 * @returns A promise that resolves to an array of service UUIDs
 */
export async function getDeviceServices(device: BleDevice): Promise<{ [serviceUuid: string]: string[] }> {
  try {
    console.log(`Retrieving services and characteristics for device: ${device.deviceId}`);
    const services = await BleClient.getServices(device.deviceId);

    // Create a dictionary where service UUIDs are the keys, and the value is an array of characteristic UUIDs
    const servicesWithCharacteristics: { [serviceUuid: string]: string[] } = {};

    for (const service of services) {
      const characteristicUuids = service.characteristics.map((char) => char.uuid);
      servicesWithCharacteristics[service.uuid] = characteristicUuids;
    }

    console.log(`Services and characteristics retrieved for device ${device.deviceId}:`, servicesWithCharacteristics);
    return servicesWithCharacteristics;
  } catch (error) {
    console.error(`Error getting services and characteristics for device ${device.deviceId}:`, error);
    throw error;
  }
}

/**
 * Translates RSSI value to a description and color.
 * @param rssi The RSSI value
 * @returns An object with RSSI description and color
 */
export function getRssiDescription(rssi: number): { description: string, color: string } {
  // Find the appropriate description and color based on RSSI value
  const rssiThreshold = RSSI_THRESHOLDS.find(threshold => rssi > threshold.max);

  if (rssiThreshold) {
    return { description: rssiThreshold.label, color: rssiThreshold.color };
  } else {
    return { description: 'Unknown', color: 'gray' };
  }
}


/**
 * Gets the battery level of a connected BLE device.
 * @param deviceId The ID of the connected device
 * @returns A promise that resolves to the battery level percentage
 */
export async function getBatteryLevel(deviceId: string): Promise<number> {
  try {
    const result = await BleClient.read(deviceId, PRIMARY_SERVICE, BATTERY);
    const batteryLevel = new DataView(result.buffer).getUint8(0);
    console.log(`Battery level for device ${deviceId}: ${batteryLevel}%`);
    return batteryLevel;
  } catch (error) {
    console.error(`Error reading battery level for device ${deviceId}:`, error);
    throw error;
  }
}


export async function sendBeep(
  deviceId: string,
): Promise<void> {
  try {

    // Write the command to the CMD_In characteristic of the device
    await BleClient.write(deviceId, PRIMARY_SERVICE, CMD_IN, hexStringToDataView('0x06'));
  } catch (error) {
    console.error(`Error writing command to CMD_In characteristic:`, error);
    throw error;
  }
}

