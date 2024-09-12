import { BleClient, BleDevice } from '@capacitor-community/bluetooth-le';

/**
 * Initializes the BLE module and starts scanning for devices.
 * @param scanDuration Duration of the scan in milliseconds (default: 5000ms)
 * @returns A promise that resolves to an array of discovered BLE devices
 */
export async function scanForBleDevices(scanDuration: number = 5000): Promise<BleDevice[]> {
  const devices: BleDevice[] = [];
  console.log("scan start!")

  try {
    await BleClient.initialize();
    console.log("ble initialized!")
    // Request BLE permissions (for Android)
    await BleClient.requestLEScan(
      {
        services: ['71C47CD7-D486-4CA3-A350-8379EDFAED8C'], // filter by unique characteristic UUID to ensure *ONLY* probes appear
      },
      (result) => {
        // This callback will be used for each discovered device
        const { device } = result;
        if (!devices.some(d => d.deviceId === device.deviceId)) {
            console.log("device pushed!")
            devices.push(device);
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
export function formatBleDevice(device: BleDevice): string {
  console.log("formatting device!")
  console.log(`Device:`)
  return `Probe: ${device.name || 'Unnamed'} (ID: ${device.deviceId})`;
  
}