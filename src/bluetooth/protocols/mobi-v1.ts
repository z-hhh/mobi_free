import type { BluetoothProtocol, WorkoutData } from './types';

export class MobiV1Protocol implements BluetoothProtocol {
  name = 'Mobi V1 (Legacy)';


  private static DATA_CHAR_UUID = '0000ffe4-0000-1000-8000-00805f9b34fb';
  private static CONTROL_CHAR_UUID = '0000ffeb-0000-1000-8000-00805f9b34fb';
  private static WRITE_CHAR_UUID = '0000ffe3-0000-1000-8000-00805f9b34fb';

  private static AUX_DATA_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

  private dataChar: BluetoothRemoteGATTCharacteristic | null = null;
  private auxDataChar: BluetoothRemoteGATTCharacteristic | null = null;
  private controlChar: BluetoothRemoteGATTCharacteristic | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;

  private lastControlPacket: DataView | null = null;

  isSupported(serviceUUIDs: string[]): boolean {
    return serviceUUIDs.some(uuid => uuid.toLowerCase().includes('ffe0') || uuid.toLowerCase().includes('ffc0'));
  }

  async connect(server: BluetoothRemoteGATTServer): Promise<void> {
    const services = await server.getPrimaryServices();
    const service = services.find(s =>
      s.uuid.toLowerCase().includes('ffe0') || s.uuid.toLowerCase().includes('ffc0')
    );

    if (!service) {
      throw new Error('Mobi V1 Service (FFE0/FFC0) not found on device');
    }

    // console.log(`Mobi V1 using service: ${service.uuid}`);

    try {
      this.dataChar = await service.getCharacteristic(MobiV1Protocol.DATA_CHAR_UUID);
      this.writeChar = await service.getCharacteristic(MobiV1Protocol.WRITE_CHAR_UUID);

      try {
        this.controlChar = await service.getCharacteristic(MobiV1Protocol.CONTROL_CHAR_UUID);
      } catch (e) {
        console.warn('Mobi V1: Control char (FFEB) not found, resistance control might not work', e);
      }

      try {
        this.auxDataChar = await service.getCharacteristic(MobiV1Protocol.AUX_DATA_CHAR_UUID);
      } catch (e) {
        console.warn('Mobi V1: Aux Data char (FFE1) not found', e);
      }

      console.log('Mobi V1 connected');
    } catch (e) {
      console.warn('Mobi V1 init failed', e);
      throw e;
    }
  }

  async startNotifications(onData: (data: WorkoutData) => void): Promise<void> {
    const handleCharValue = (e: Event) => {
      const char = e.target as BluetoothRemoteGATTCharacteristic;
      if (char.value) {
        const data = this.parseData(char.value);
        if (data) onData(data);
      }
    };

    if (this.dataChar) {
      await this.dataChar.startNotifications();
      this.dataChar.addEventListener('characteristicvaluechanged', handleCharValue);
    }

    if (this.auxDataChar) {
      await this.auxDataChar.startNotifications();
      this.auxDataChar.addEventListener('characteristicvaluechanged', handleCharValue);
    }

    if (this.controlChar) {
      await this.controlChar.startNotifications();
      this.controlChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const char = e.target as BluetoothRemoteGATTCharacteristic;
        if (char.value) {
          this.lastControlPacket = char.value;
          // Also parse data from control packet as it likely contains status/speed
          const data = this.parseData(char.value);
          if (data) onData(data);
        }
      });
    }
  }

  async setResistance(level: number): Promise<void> {
    if (!this.writeChar || !this.lastControlPacket) {
      console.warn('Cannot set resistance: No write char or no control packet received yet (need to echo bytes from FFEB).');
      return;
    }

    // Clamp level to 1-24 range as per official app
    const safeLevel = Math.min(Math.max(level, 1), 24);

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
      safeLevel & 0xFF,
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
    // Attempt basic parsing - this needs to be validated with actual device output
    if (buffer.length >= 6) {
      // If cmd is 0x0A (Speed) - Based on InstructionCode.TREADMILL_SPEED_CODE = 10
      // Official app: lowSpeed (byte 1) / 10, highSpeed (byte 2) / 10
      // V1 Protocol typically uses bytes at specific offsets
      if (cmd === 0x0A && buffer.length >= 4) {
        // Hypothethical: [AB, 0A, High, Low, ...]
        const speedVal = (buffer[2] << 8) | buffer[3];
        data.instantSpeed = speedVal / 10.0;
      }
      // If cmd is 0x03 (Resistance feedback?) - InstructionCode.FRAME_HEADER (AB) with cmd 03 is used for WRITE resistance
      // But maybe device echoes it back?

      // General feedback often contains resistance level
      // V1Handler writes resistance using bytes from FFEB packet.
      // Let's extract what we can from FFEB packets which might map to resistance

      // Known: writeBleVer0x01Resistance uses index 5 for level: 
      // cmd = [AB, 03, 00, d3, d4, LEVEL, d6]
      // where d3,d4,d6 come from FFEB packet.
      // So if this is a FFEB packet, maybe index 5 IS the current level?
      if (view.byteLength >= 7) {
        // Just a guess: if we are parsing the FFEB packet, it might contain current level at index 5
        // V1Handler.java uses ellipticalData[5] as the 'i4' (level) when writing? NO.
        // It writes `(byte) i4` (new level) at index 5.
        // It PRESERVES `bArr[3]`, `bArr[4]`, `bArr[6]` from the FFEB packet.
        // It does NOT use bArr[5].
        // This strongly implies bArr[5] is the current resistance reported by device.
        const currentLevel = view.getUint8(5);
        if (currentLevel >= 1 && currentLevel <= 24) {
          data.resistanceLevel = currentLevel;
        }
      }
    }

    return data;
  }
}