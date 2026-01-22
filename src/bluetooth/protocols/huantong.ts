import type { BluetoothProtocol, WorkoutData } from './types';

export class HuanTongProtocol implements BluetoothProtocol {
  name = 'HuanTong (MOBI-E)';

  private static SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
  private static NOTIFY_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
  private static WRITE_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';

  private dataChar: BluetoothRemoteGATTCharacteristic | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;

  isSupported(serviceUUIDs: string[]): boolean {
    return serviceUUIDs.some(uuid => uuid.toLowerCase().includes('fff0'));
  }

  async connect(server: BluetoothRemoteGATTServer): Promise<void> {
    const service = await server.getPrimaryService(HuanTongProtocol.SERVICE_UUID);
    this.dataChar = await service.getCharacteristic(HuanTongProtocol.NOTIFY_UUID);
    this.writeChar = await service.getCharacteristic(HuanTongProtocol.WRITE_UUID);
  }

  async startNotifications(onData: (data: WorkoutData) => void): Promise<void> {
    if (!this.dataChar) return;

    await this.dataChar.startNotifications();
    this.dataChar.addEventListener('characteristicvaluechanged', (e: Event) => {
      const char = e.target as BluetoothRemoteGATTCharacteristic;
      if (char.value) {
        const data = this.parseData(char.value);
        if (data) onData(data);
      }
    });
  }

  async setResistance(level: number): Promise<void> {
    if (!this.writeChar) return;
    
    // Logic from HuanTongHandler & d.java lambda
    // byte[] bArr = {b10, b11, (byte) i4, 0, (byte) (((b10 + b11) + i4) % 256)};
    // b10 = 32 (0x20)
    // b11 = -63 (0xC1)
    
    const b1 = 0x20;
    const b2 = 0xC1;
    const res = level & 0xFF;
    const checksum = (b1 + b2 + res) & 0xFF;
    
    const cmd = new Uint8Array([b1, b2, res, 0x00, checksum]);
    
    try {
      await this.writeChar.writeValue(cmd);
    } catch (e) {
      console.error('HuanTong resistance write failed', e);
    }
  }

  disconnect(): void {
    this.dataChar = null;
    this.writeChar = null;
  }

  private parseData(view: DataView): WorkoutData | null {
    // Logic from connectHuanTong in BluetoothLeService.java
    // if (data.length == 12 && data[1] != 0)
    // String strG = String.format("%X%02X", data[2], data[3])
    // Double rpm = Double.parseDouble(strG)
    
    if (view.byteLength === 12) {
      try {
        const byte2 = view.getUint8(2);
        const byte3 = view.getUint8(3);
        
        // This hex string parsing is weird but follows the decompiled code logic
        // "String.format("%X%02X", ...)" -> e.g. "1" + "0A" = "10A" -> 266 RPM
        const hexStr = byte2.toString(16).toUpperCase() + byte3.toString(16).toUpperCase().padStart(2, '0');
        const rpm = parseFloat(hexStr);
        
        return {
          instantCadence: rpm,
          // Placeholder for other data if reverse engineered later
        };
      } catch (e) {
        console.error('Error parsing HuanTong data', e);
      }
    }
    return null;
  }
}