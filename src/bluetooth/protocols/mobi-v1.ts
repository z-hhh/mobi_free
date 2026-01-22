import type { BluetoothProtocol, WorkoutData } from './types';

export class MobiV1Protocol implements BluetoothProtocol {
  name = 'Mobi V1 (Legacy)';

  private static SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  private static DATA_CHAR_UUID = '0000ffe4-0000-1000-8000-00805f9b34fb'; 
  private static WRITE_CHAR_UUID = '0000ffe3-0000-1000-8000-00805f9b34fb';

  private dataChar: BluetoothRemoteGATTCharacteristic | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;
  
  private lastDataPacket: DataView | null = null;

  isSupported(serviceUUIDs: string[]): boolean {
    return serviceUUIDs.some(uuid => uuid.toLowerCase().includes('ffe0'));
  }

  async connect(server: BluetoothRemoteGATTServer): Promise<void> {
    const service = await server.getPrimaryService(MobiV1Protocol.SERVICE_UUID);
    
    try {
      this.dataChar = await service.getCharacteristic(MobiV1Protocol.DATA_CHAR_UUID);
      this.writeChar = await service.getCharacteristic(MobiV1Protocol.WRITE_CHAR_UUID);
      console.log('Mobi V1 connected');
    } catch (e) {
      console.warn('Mobi V1 init failed', e);
      throw e;
    }
  }

  async startNotifications(onData: (data: WorkoutData) => void): Promise<void> {
    if (!this.dataChar) return;

    await this.dataChar.startNotifications();
    this.dataChar.addEventListener('characteristicvaluechanged', (e: Event) => {
      const char = e.target as BluetoothRemoteGATTCharacteristic;
      if (char.value) {
        this.lastDataPacket = char.value;
        const data = this.parseData(char.value);
        if (data) onData(data);
      }
    });
  }

  async setResistance(level: number): Promise<void> {
    if (!this.writeChar || !this.lastDataPacket) {
      console.warn('Cannot set resistance: No write char or no data packet received yet (need to echo bytes).');
      return;
    }

    // Based on V1Handler.java: writeBleVer0x01Resistance
    // byte[] bArr2 = {InstructionCode.FRAME_HEADER, 3, 0, bArr[3], bArr[4], (byte) i4, bArr[6]};
    // FRAME_HEADER = -85 (0xAB)
    
    const data = new Uint8Array(this.lastDataPacket.buffer);
    if (data.length < 7) return;

    const cmd = new Uint8Array([
      0xAB, // Frame Header
      0x03, // Resistance OpCode (in this specific context)
      0x00, 
      data[3],
      data[4],
      level & 0xFF,
      data[6]
    ]);

    await this.writeChar.writeValue(cmd);
  }

  disconnect(): void {
    this.dataChar = null;
    this.writeChar = null;
    this.lastDataPacket = null;
  }

  private parseData(_view: DataView): WorkoutData | null {
    // Basic structure inference from V1Handler
    // Header 0xAB
    // [0]: Header
    // [1]: Type/Len?
    // [2]: ?
    // ...
    
    // Without full decompilation of the notify handler, we are guessing.
    // However, typical legacy structure might be:
    // Speed, RPM, Distance, Calories, Pulse
    
    // For now, return raw data debug info in console, user needs to test.
    return {}; 
  }
}