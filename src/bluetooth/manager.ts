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
  private logger: ((msg: string) => void) | null = null;

  constructor() { }

  setLogger(logger: (msg: string) => void) {
    this.logger = logger;
  }

  private log(msg: string) {
    console.log(msg);
    if (this.logger) {
      this.logger(msg);
    }
  }

  private logError(msg: string, error?: any) {
    console.error(msg, error);
    if (this.logger) {
      this.logger(`[Error] ${msg} ${error ? (error instanceof Error ? error.message : String(error)) : ''}`);
    }
  }

  async connect(): Promise<string> { // returns protocol name
    const isBluefy = /bluefy/i.test(navigator.userAgent);
    logEvent('CONNECT_ATTEMPT', { userAgent: navigator.userAgent, isBluefy });
    this.log(`Starting connection... (Bluefy: ${isBluefy})`);

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
      this.log('Requesting Bluetooth device...');
      this.device = await navigator.bluetooth.requestDevice(options);
      this.log(`Device selected: ${this.device.name}`);

      this.log('Connecting to GATT Server...');
      const server = await this.device.gatt?.connect();
      if (!server) throw new Error('GATT Server connection failed');
      this.log('GATT Server connected.');

      // Protocol Detection
      this.log('Discovering services...');
      const services = await server.getPrimaryServices();
      const serviceUUIDs = services.map(s => s.uuid);

      this.log(`Discovered services: ${serviceUUIDs.join(', ')}`);

      this.activeProtocol = this.protocols.find(p => p.isSupported(serviceUUIDs)) || null;

      if (!this.activeProtocol) {
        throw new Error('No supported protocol found on this device');
      }

      this.log(`Selected Protocol: ${this.activeProtocol.name}`);
      await this.activeProtocol.connect(server);

      logEvent('CONNECT_SUCCESS', {
        deviceName: this.device.name,
        protocol: this.activeProtocol.name
      });

      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      return this.activeProtocol.name;
    } catch (e) {
      this.logError('Connection failed', e);
      logEvent('CONNECT_ERROR', { errorDetails: (e as Error).message });
      throw e;
    }
  }

  async startNotifications(onData: (data: WorkoutData) => void) {
    if (!this.activeProtocol) return;
    this.log('Starting notifications...');
    await this.activeProtocol.startNotifications(onData);
  }

  async setResistance(level: number) {
    if (!this.activeProtocol) return;
    // this.log(`Setting resistance to ${level}`); // Optional: might be too spammy
    await this.activeProtocol.setResistance(level);
  }

  disconnect() {
    if (this.activeProtocol) {
      this.log('Disconnecting protocol...');
      this.activeProtocol.disconnect();
      this.activeProtocol = null;
    }
    if (this.device && this.device.gatt?.connected) {
      this.log('Disconnecting GATT...');
      this.device.gatt.disconnect();
    }
    logEvent('DISCONNECT_MANUAL');
    this.log('Disconnected manually.');
  }

  private onDisconnected() {
    logEvent('DISCONNECT_PASSIVE');
    this.log('Device disconnected (passive).');
    this.activeProtocol?.disconnect();
    this.activeProtocol = null;
    // Dispatch event or callback if needed
  }

  isConnected(): boolean {
    return !!(this.device?.gatt?.connected && this.activeProtocol);
  }
}
