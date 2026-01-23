import type { BluetoothProtocol, WorkoutData } from './protocols/types';
import { FtmsProtocol } from './protocols/ftms';
import { MobiV2Protocol } from './protocols/mobi-v2';
import { MobiV1Protocol } from './protocols/mobi-v1';
import { HuanTongProtocol } from './protocols/huantong';

import { logEvent } from '../services/analytics';

export class BluetoothManager {
  private protocols: BluetoothProtocol[] = [
    new FtmsProtocol(),
    new MobiV2Protocol(),
    new MobiV1Protocol(),
    new HuanTongProtocol()
  ];

  private device: BluetoothDevice | null = null;
  private activeProtocol: BluetoothProtocol | null = null;

  constructor() { }

  async connect(): Promise<string> { // returns protocol name
    const isBluefy = /bluefy/i.test(navigator.userAgent);
    logEvent('CONNECT_ATTEMPT', { userAgent: navigator.userAgent, isBluefy });

    if (!navigator.bluetooth) {
      logEvent('CONNECT_ERROR', { errorDetails: 'Web Bluetooth not supported' });
      throw new Error('您的浏览器不支持蓝牙功能。安卓请使用 Chrome/Edge，iOS 请使用 Bluefy APP。');
    }
    const ftmsUUID = '00001826-0000-1000-8000-00805f9b34fb';
    const mobiV2UUID = '00008800-0000-1000-8000-00805f9b34fb';
    const mobiV1UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
    const huantongUUID = '0000fff0-0000-1000-8000-00805f9b34fb';

    const allServiceUUIDs = [ftmsUUID, mobiV2UUID, mobiV1UUID, huantongUUID];

    const options: RequestDeviceOptions = {
      filters: [
        { services: [ftmsUUID] },
        { services: [mobiV2UUID] },
        { services: [mobiV1UUID] },
        { services: [huantongUUID] }
      ],
      optionalServices: allServiceUUIDs
    };

    // Bluefy handling (simplified)
    if (isBluefy) {
      // Bluefy has issues with optionalServices in some versions or specific contexts
      delete options.optionalServices;
    }

    try {
      this.device = await navigator.bluetooth.requestDevice(options);

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error('GATT Server connection failed');

      // Protocol Detection
      const services = await server.getPrimaryServices();
      const serviceUUIDs = services.map(s => s.uuid);

      console.log('Discovered services:', serviceUUIDs);

      this.activeProtocol = this.protocols.find(p => p.isSupported(serviceUUIDs)) || null;

      if (!this.activeProtocol) {
        throw new Error('No supported protocol found on this device');
      }

      console.log(`Selected Protocol: ${this.activeProtocol.name}`);
      await this.activeProtocol.connect(server);

      logEvent('CONNECT_SUCCESS', {
        deviceName: this.device.name,
        protocol: this.activeProtocol.name
      });

      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      return this.activeProtocol.name;
    } catch (e) {
      console.error(e);
      logEvent('CONNECT_ERROR', { errorDetails: (e as Error).message });
      throw e;
    }
  }

  async startNotifications(onData: (data: WorkoutData) => void) {
    if (!this.activeProtocol) return;
    await this.activeProtocol.startNotifications(onData);
  }

  async setResistance(level: number) {
    if (!this.activeProtocol) return;
    await this.activeProtocol.setResistance(level);
  }

  disconnect() {
    if (this.activeProtocol) {
      this.activeProtocol.disconnect();
      this.activeProtocol = null;
    }
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    logEvent('DISCONNECT_MANUAL');
  }

  private onDisconnected() {
    logEvent('DISCONNECT_PASSIVE');
    this.activeProtocol?.disconnect();
    this.activeProtocol = null;
    // Dispatch event or callback if needed
  }

  isConnected(): boolean {
    return !!(this.device?.gatt?.connected && this.activeProtocol);
  }
}
