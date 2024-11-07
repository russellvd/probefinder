import { BleClient, BleDevice, hexStringToDataView, ScanResult } from '@capacitor-community/bluetooth-le';

const PRIMARY_SERVICE = '71C47CD7-D486-4CA3-A350-8379EDFAED8C';
const HEARTBEAT = '255E7B9C-ABF8-49BF-BE78-DD03B59D31A2';
const BATTERY = '00002A19-0000-1000-8000-00805F9B34FB';
const PRB_BTN = 'DCD0C4E2-BC02-40A7-B6D7-D994B421283B';
const CMD_IN = '8C64619E-006E-4303-A8B9-9C4A9ADE5334';
const CMD_OUT = 'A4676CF5-BBC4-428C-BB34-9D48906EA5A7'

interface RssiThreshold {
  max: number;
  label: string;
  color: string;
}

const RSSI_THRESHOLDS: RssiThreshold[] = [
  { max: -60, label: 'VERY CLOSE', color: 'green' },
  { max: -70, label: 'NEAR', color: 'green' },
  { max: -80, label: 'FAR', color: 'darkorange' },
  { max: -90, label: 'VERY FAR', color: 'red' }
];



/**
 * Initializes the BLE module and starts scanning for devices.
 * @param scanDuration Duration of the scan in milliseconds (default: 2 second intervals)
 * @returns A promise that resolves to an array of discovered BLE devices
 */
export async function scanForBleDevices(scanDuration: number = 2000): Promise<(BleDevice & { rssi: number, manufacturerData?: { [key: string]: DataView } })[]> {
  const devices: (BleDevice & { rssi: number, manufacturerData?: { [key: string]: DataView } })[] = [];
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
        const { device, rssi, manufacturerData } = result;
        if (rssi !== undefined) {
          const deviceWithRssiAndManufacturerData = {
            ...device,
            rssi,
            manufacturerData // Add manufacturerData to the device object
          };
          if (!devices.some(d => d.deviceId === deviceWithRssiAndManufacturerData.deviceId)) {
              console.log("device pushed!");
              devices.push(deviceWithRssiAndManufacturerData);
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
 * @param device The BLE device object with rssi and parsedManufacturerData
 * @returns A formatted string representation of the device
 */
export function formatBleDevice(device: BleDevice & { rssi: number; parsedManufacturerData: { modelId: string; probeId: string; probeSerialNumber: string; batteryStateOfCharge: number; }[] }): string {
  console.log("formatting device!");
  console.log(`Device:`, device);

  // Define the mapping of probeId to readable names
  const probeIdToNameMap: { [key: string]: string } = {
    "0x11001401": "L8-3",
    "0x11001402": "L13-5",
    "0x11001403": "C5-2",
    // Developers can add more mappings here
  };

  // Get the first parsedManufacturerData (assuming one entry for each device)
  const parsedData = device.parsedManufacturerData[0]; 

  // Extract the readable probe name
  const probeName = probeIdToNameMap[parsedData.probeId] || 'Unknown Probe';
  const serialNum = parsedData.probeSerialNumber;
  // Return the formatted string using the readable probe name
  return `Probe: ${probeName} ${serialNum}`;
}

/**
 * Connects to a given BLE device.
 * @param device The BLE device to connect to
 * @returns A promise that resolves when the connection is established
 */
export async function connectToBleDevice(device: BleDevice & { rssi: number; parsedManufacturerData: { modelId: string; probeId: string; probeSerialNumber: string; batteryStateOfCharge: number; }[] }): Promise<void> {
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


/**
 * Subscribes to notifications on a characteristic and reads the response 
 * @param deviceId The BLE device ID
 * @param serviceUUID The service UUID (e.g., PRIMARY_SERVICE)
 * @param characteristicUUID The characteristic UUID to subscribe to (e.g., CMD_IN or a separate one for notifications)
 */
export async function subscribeToNotifications(
  deviceId: string,
  serviceUUID: string,
  characteristicUUID: string
): Promise<void> {
  try {
    // Subscribe to notifications for the specified characteristic
    await BleClient.startNotifications(
      deviceId,
      serviceUUID,
      characteristicUUID,
      (value) => {
        const dataView = new DataView(value.buffer);

        // Extract relevant fields from the acknowledgment format
        const commandType = String.fromCharCode(dataView.getUint8(2)); // Command type
        const commandCode = dataView.getUint8(3); // Command Code
        const seqCommandNumber = (
          (dataView.getUint8(4) << 0) |
          (dataView.getUint8(5) << 8) |
          (dataView.getUint8(6) << 16) |
          (dataView.getUint8(7) << 24)
        ); // Sequential Command Number

        const dataByteCount = (
          (dataView.getUint8(8) << 0) |
          (dataView.getUint8(9) << 8)
        ); // Data byte count

        const dataChecksum = (
          (dataView.getUint8(10) << 0) |
          (dataView.getUint8(11) << 8)
        ); // Data checksum

        const headerChecksum = (
          (dataView.getUint8(12) << 0) |
          (dataView.getUint8(13) << 8)
        ); // Header checksum

        const commandStatus = (
          (dataView.getUint8(14) << 0) |
          (dataView.getUint8(15) << 8)
        ); // Command Status

        console.log(`Command Type: ${commandType}`);
        console.log(`Command Code: ${commandCode}`);
        console.log(`Sequential Command Number: ${seqCommandNumber}`);
        console.log(`Data Byte Count: ${dataByteCount}`);
        console.log(`Data Checksum: ${dataChecksum}`);
        console.log(`Header Checksum: ${headerChecksum}`);
        console.log(`Command Status: ${commandStatus}`);
      }
    );
    console.log(`Subscribed to notifications for characteristic: ${characteristicUUID}`);
  } catch (error) {
    console.error(`Error subscribing to notifications:`, error);
    throw error;
  }
}



/**
 * Reads the serial number of the BLE device.
 * @param deviceId The BLE device ID\
 * UNDER DEVELOPMENT...
 */
export async function readSerialNumber(deviceId: string): Promise<void> {
  try {
    // Send the command to CMD_IN to request the serial number
    const command = hexStringToDataView('0x21'); 

    // Subscribe to notifications to receive the serial number
    await subscribeToNotifications(deviceId, PRIMARY_SERVICE, CMD_OUT);
    await BleClient.write(deviceId, PRIMARY_SERVICE, CMD_IN, command);

  } catch (error) {
    console.error(`Error reading serial number:`, error);
    throw error;
  }
}




/**
 * Starts scanning for BLE devices with the specified service and provides results through a callback.
 * The result includes the device, RSSI, and manufacturer data.
 * 
 * @param {function} callback - A function that is called when a BLE device is found. 
 * It receives an object containing the device, RSSI, and manufacturer data.
 * @returns {Promise<void>} - A promise that resolves when the scan starts successfully.
 * @throws {Error} - If there is an issue starting the BLE scan.
 */
export async function startScan(callback: (result: { device: BleDevice; rssi: number; manufacturerData: { [key: string]: DataView } }) => void): Promise<void> {
  try {
    await BleClient.initialize();
    await BleClient.requestLEScan(
      {
        services: [PRIMARY_SERVICE],
      },
      (result) => {
        const { device, rssi, manufacturerData } = result;
        if (rssi !== undefined && manufacturerData !== undefined) {
          callback({ device, rssi, manufacturerData });
        }
      }
    );
  } catch (error) {
    console.error('Error scanning for BLE devices:', error);
    throw error;
  }
}

/**
 * Stops the ongoing BLE device scan.
 * 
 * @returns {Promise<void>} - A promise that resolves when the scan is stopped successfully.
 * @throws {Error} - If there is an issue stopping the BLE scan.
 */
export async function stopScan(): Promise<void> {
  try {
    await BleClient.stopLEScan();
  } catch (error) {
    console.error('Error stopping BLE scan:', error);
    throw error;
  }
}

/**
 * Logs the raw manufacturer data from BLE devices in hexadecimal format.
 * 
 * @param {Object} manufacturerData - An object where each key corresponds to a device,
 * and the value is a DataView containing the raw manufacturer data.
 */
export const logManufacturerData = (manufacturerData: { [key: string]: DataView }) => {
  Object.keys(manufacturerData).forEach((key) => {
    const dataView = manufacturerData[key];

    let hexString = '';
    for (let i = 0; i < dataView.byteLength; i++) {
      const byte = dataView.getUint8(i);
      hexString += byte.toString(16).padStart(2, '0') + ' ';
    }

    console.log(`Manufacturer Data for key ${key}:`, hexString.trim());
  });
}

/**
 * Parses the manufacturer data from BLE devices, extracting the model ID, probe ID,
 * probe serial number (without the "0x" prefix), and battery state of charge.
 * 
 * @param {Object} manufacturerData - An object where each key corresponds to a device,
 * and the value is a DataView containing the raw manufacturer data.
 * @returns {Array<{ modelId: string, probeId: string, probeSerialNumber: string, batteryStateOfCharge: number }>} 
 * An array of objects, each containing the parsed model ID, probe ID, probe serial number, and battery state of charge.
 */
export const parseManufacturerData = (manufacturerData: { [key: string]: DataView }): Array<{ modelId: string, probeId: string, probeSerialNumber: string, batteryStateOfCharge: number }> => {
  const parsedDataArray: Array<{ modelId: string, probeId: string, probeSerialNumber: string, batteryStateOfCharge: number }> = [];

  // Loop through each key in the manufacturerData
  Object.keys(manufacturerData).forEach((key) => {
    const dataView = manufacturerData[key];

    // Function to read 4 bytes in little-endian order and return hex string
    const readLittleEndianUint32 = (offset: number, omitPrefix: boolean = false) => {
      const hexString = `${dataView.getUint8(offset + 3).toString(16).padStart(2, '0')}${dataView.getUint8(offset + 2).toString(16).padStart(2, '0')}${dataView.getUint8(offset + 1).toString(16).padStart(2, '0')}${dataView.getUint8(offset).toString(16).padStart(2, '0')}`;
      return omitPrefix ? hexString : `0x${hexString}`;
    };

    // Parse the manufacturer data as little-endian
    const modelId = readLittleEndianUint32(0);  // 00 23 00 11 -> 0x11002300
    const probeId = readLittleEndianUint32(4);  // 01 14 00 11 -> 0x11001401
    const probeSerialNumber = readLittleEndianUint32(8, true); // 50 16 00 11 -> 11001650 (no 0x prefix)

    // Battery state of charge is at position 19 (last byte)
    const batteryStateOfCharge = dataView.getUint8(19);  // 5A -> 90%

    // Log the parsed data
    console.log(`Manufacturer Data for key ${key}:`);
    console.log(`Model ID: ${modelId}`);
    console.log(`Probe ID: ${probeId}`);
    console.log(`Probe Serial Number: ${probeSerialNumber}`);
    console.log(`Battery State of Charge: ${batteryStateOfCharge}%`);

    // Push the parsed data to the array
    parsedDataArray.push({
      modelId,
      probeId,
      probeSerialNumber,
      batteryStateOfCharge
    });
  });

  return parsedDataArray;
}
