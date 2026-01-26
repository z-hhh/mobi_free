import type { BluetoothProtocol, WorkoutData } from './types';

export class MobiV1Protocol implements BluetoothProtocol {
  name = 'Mobi V1 (Legacy)';

  private static SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  private static DATA_CHAR_UUID = '0000ffe4-0000-1000-8000-00805f9b34fb';
  private static CONTROL_CHAR_UUID = '0000ffeb-0000-1000-8000-00805f9b34fb';
  private static WRITE_CHAR_UUID = '0000ffe3-0000-1000-8000-00805f9b34fb';

  private dataChar: BluetoothRemoteGATTCharacteristic | null = null;
  private controlChar: BluetoothRemoteGATTCharacteristic | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;

  private lastControlPacket: DataView | null = null;

  isSupported(serviceUUIDs: string[]): boolean {
    return serviceUUIDs.some(uuid => uuid.toLowerCase().includes('ffe0') || uuid.toLowerCase().includes('ffc0'));
  }

  async connect(server: BluetoothRemoteGATTServer): Promise<void> {
    const service = await server.getPrimaryService(MobiV1Protocol.SERVICE_UUID);

    try {
      this.dataChar = await service.getCharacteristic(MobiV1Protocol.DATA_CHAR_UUID);
      this.writeChar = await service.getCharacteristic(MobiV1Protocol.WRITE_CHAR_UUID);

      try {
        this.controlChar = await service.getCharacteristic(MobiV1Protocol.CONTROL_CHAR_UUID);
      } catch (e) {
        console.warn('Mobi V1: Control char (FFEB) not found, resistance control might not work', e);
      }

      console.log('Mobi V1 connected');
    } catch (e) {
      console.warn('Mobi V1 init failed', e);
      throw e;
    }
  }

  async startNotifications(onData: (data: WorkoutData) => void): Promise<void> {
    if (this.dataChar) {
      await this.dataChar.startNotifications();
      this.dataChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const char = e.target as BluetoothRemoteGATTCharacteristic;
        if (char.value) {
          const data = this.parseData(char.value);
          if (data) onData(data);
        }
      });
    }

    if (this.controlChar) {
      await this.controlChar.startNotifications();
      this.controlChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const char = e.target as BluetoothRemoteGATTCharacteristic;
        if (char.value) {
          this.lastControlPacket = char.value;
          // console.log('Mobi V1 Control Packet:', new Uint8Array(char.value.buffer));
        }
      });
    }
  }

  async setResistance(level: number): Promise<void> {
    if (!this.writeChar || !this.lastControlPacket) {
      console.warn('Cannot set resistance: No write char or no control packet received yet (need to echo bytes from FFEB).');
      return;
    }

    // Based on V1Handler.java: writeBleVer0x01Resistance
    // byte[] bArr2 = {InstructionCode.FRAME_HEADER, 3, 0, bArr[3], bArr[4], (byte) i4, bArr[6]};
    // where bArr comes from FFEB (ellipticalData)

    const data = new Uint8Array(this.lastControlPacket.buffer);
    if (data.length < 7) {
      console.warn('Control packet too short', data);
      return;
    }

    const cmd = new Uint8Array([
      0xAB, // Frame Header
      0x03, // Resistance OpCode
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
    this.controlChar = null;
    this.writeChar = null;
    this.lastControlPacket = null;
  }

  private parseData(view: DataView): WorkoutData | null {
    const buffer = new Uint8Array(view.buffer);
    // console.log('Mobi V1 Raw Data (FFE4):', buffer);

    if (buffer[0] !== 0xAB) return null; // Header check

    // Needs reverse engineering without source code.
    // Assuming a common structure for fitness equipment or based on InstructionCode hints.
    // TREADMILL_DATA_CODE = 13 (0x0D)
    // TREADMILL_SPEED_CODE = 10 (0x0A)

    const cmd = buffer[1];
    const data: WorkoutData = {};

    // Attempt basic parsing - this needs to be validated with actual device output
    if (buffer.length >= 6) {
      // Just a placeholder logic, highly dependent on actual byte layout
      // Example: [AB, Cmd, High, Low, ...]

      // If cmd is 0x0A (Speed)
      if (cmd === 0x0A && buffer.length >= 4) {
        const speedVal = (buffer[2] << 8) | buffer[3];
        data.instantSpeed = speedVal / 10.0;
      }
      // If cmd is 0x0D (Full Data)
      else if (cmd === 0x0D && buffer.length >= 10) {
        // Very hypothetical layout
        // time(2), distance(2), calories(2), speed(2), level(1)
      }
    }

    // Since we don't have the parsing logic from V1Handler (decompilation failed),
    // we return what we can or rely on logs for now to fix later.
    return data;
  }
}