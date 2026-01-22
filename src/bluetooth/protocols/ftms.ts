import type { BluetoothProtocol, WorkoutData } from './types';
import { parseCrossTrainerData } from '../../utils/ftms-parser';

export class FtmsProtocol implements BluetoothProtocol {
  name = 'Standard FTMS';
  
  private static SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';
  private static DATA_UUID = '00002ace-0000-1000-8000-00805f9b34fb';
  private static CONTROL_UUID = '00002ad9-0000-1000-8000-00805f9b34fb';

  private controlChar: BluetoothRemoteGATTCharacteristic | null = null;
  private dataChar: BluetoothRemoteGATTCharacteristic | null = null;

  isSupported(serviceUUIDs: string[]): boolean {
    return serviceUUIDs.some(uuid => uuid.toLowerCase().includes('1826'));
  }

  async connect(server: BluetoothRemoteGATTServer): Promise<void> {
    const service = await server.getPrimaryService(FtmsProtocol.SERVICE_UUID);
    
    try {
      this.controlChar = await service.getCharacteristic(FtmsProtocol.CONTROL_UUID);
      this.dataChar = await service.getCharacteristic(FtmsProtocol.DATA_UUID);
      
      // Request Control
      await this.controlChar.writeValue(new Uint8Array([0x00]));
      
      // Start Session (Wait a bit for control to be granted)
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.controlChar.writeValue(new Uint8Array([0x07]));
    } catch (e) {
      console.warn('FTMS Control point setup failed (might be read-only device)', e);
    }
  }

  async startNotifications(onData: (data: WorkoutData) => void): Promise<void> {
    if (!this.dataChar) return;
    
    await this.dataChar.startNotifications();
    this.dataChar.addEventListener('characteristicvaluechanged', (e: Event) => {
      const char = e.target as BluetoothRemoteGATTCharacteristic;
      if (char.value) {
        const data = parseCrossTrainerData(char.value);
        onData(data);
      }
    });
  }

  async setResistance(level: number): Promise<void> {
    if (!this.controlChar) return;
    
    // FTMS set target resistance level (OpCode 0x04)
    // Mobi's implementation: read value / 10, write value directly
    const clamped = Math.max(10, Math.min(24, Math.round(level)));
    const command = new Uint8Array([0x04, clamped & 0xFF, (clamped >> 8) & 0xFF]);
    await this.controlChar.writeValue(command);
  }

  disconnect(): void {
    this.controlChar = null;
    this.dataChar = null;
  }
}
