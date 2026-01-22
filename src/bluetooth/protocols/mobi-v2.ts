import type { BluetoothProtocol, WorkoutData } from './types';

export class MobiV2Protocol implements BluetoothProtocol {
  name = 'Mobi V2 (Classic)';

  private static SERVICE_UUID = '00008800-0000-1000-8000-00805f9b34fb';
  private static UNLOCK_UUID = '000088ff-0000-1000-8000-00805f9b34fb';
  private static DATA_UUID = '00008813-0000-1000-8000-00805f9b34fb';
  private static RESISTANCE_UUID = '00008812-0000-1000-8000-00805f9b34fb';

  private resistanceChar: BluetoothRemoteGATTCharacteristic | null = null;
  private unlockChar: BluetoothRemoteGATTCharacteristic | null = null;
  private dataChar: BluetoothRemoteGATTCharacteristic | null = null;

  isSupported(serviceUUIDs: string[]): boolean {
    return serviceUUIDs.some(uuid => uuid.toLowerCase().includes('8800'));
  }

  async connect(server: BluetoothRemoteGATTServer): Promise<void> {
    const service = await server.getPrimaryService(MobiV2Protocol.SERVICE_UUID);

    try {
      this.unlockChar = await service.getCharacteristic(MobiV2Protocol.UNLOCK_UUID);
      this.dataChar = await service.getCharacteristic(MobiV2Protocol.DATA_UUID);
      this.resistanceChar = await service.getCharacteristic(MobiV2Protocol.RESISTANCE_UUID);

      // Unlock Handshake
      // 17, -126, 7 => 0x11, 0x82, 0x07
      const unlockCode = new Uint8Array([0x11, 0x82, 0x07]);
      await this.unlockChar.writeValue(unlockCode);
      console.log('Mobi V2 Unlocked');

    } catch (e) {
      console.error('Mobi V2 init failed', e);
      throw e;
    }
  }

  async startNotifications(onData: (data: WorkoutData) => void): Promise<void> {
    if (!this.dataChar) return;

    await this.dataChar.startNotifications();
    this.dataChar.addEventListener('characteristicvaluechanged', (e: Event) => {
      const char = e.target as BluetoothRemoteGATTCharacteristic;
      if (char.value) {
        const data = this.parseData(char.value);
        onData(data);
      }
    });
  }

  async setResistance(level: number): Promise<void> {
    if (!this.resistanceChar) return;

    // V2: Write single byte
    const clamped = Math.max(1, Math.min(32, Math.round(level))); // Range check? Mobi usually 1-32 or 1-24
    await this.resistanceChar.writeValue(new Uint8Array([clamped]));
  }

  disconnect(): void {
    this.unlockChar = null;
    this.dataChar = null;
    this.resistanceChar = null;
  }

  private parseData(view: DataView): WorkoutData {
    // 8813 Data Structure (Big Endian based on analysis)
    // Byte 0: Speed (0.1 km/h)
    // Byte 1: Incline
    // Byte 2: Cadence
    // Byte 3-4: Duration (s)
    // Byte 5-6: Distance (m)
    // Byte 7-8: Calories (0.1 kcal or 1 kcal? Code says /10)
    // Byte 9-10: Power (W)
    
    if (view.byteLength < 9) return {};

    const speed = view.getUint8(0) / 10.0;
    // const incline = view.getInt8(1);
    const cadence = view.getUint8(2);
    
    const duration = (view.getUint8(3) << 8) | view.getUint8(4);
    const distance = (view.getUint8(5) << 8) | view.getUint8(6);
    const kcal = ((view.getUint8(7) << 8) | view.getUint8(8)) / 10.0; // Based on V2Handler analysis
    
    let power = 0;
    if (view.byteLength >= 11) {
       power = (view.getUint8(9) << 8) | view.getUint8(10);
    }

    return {
      instantSpeed: speed,
      instantCadence: cadence,
      instantPower: power,
      elapsedTime: duration,
      totalDistance: distance,
      kcal: kcal,
      // resistanceLevel is not in this packet, usually read from 8812 notification if needed
    };
  }
}
