import { useState, useRef, useCallback } from 'react';
import { parseCrossTrainerData } from '../utils/ftms-parser';
import type { WorkoutStats } from '../utils/ftms-parser';

const FTMS_SERVICE_UUID = 0x1826;
const CROSS_TRAINER_DATA_UUID = 0x2ACE;
const CONTROL_POINT_UUID = 0x2AD9;

/**
 * Web Bluetooth API 封装 Hook
 */
export const useBluetooth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<WorkoutStats>({
    instantSpeed: 0,
    instantCadence: 0,
    instantPower: 0,
    resistanceLevel: 1,
    totalDistance: 0,
    kcal: 0
  });

  const controlCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  // 连接设备
  const connect = useCallback(async () => {
    try {
      setError(null);
      const api = navigator.bluetooth;
      if (!window.isSecureContext || !api?.requestDevice) {
        throw new Error("Web Bluetooth 不可用，请使用 HTTPS/localhost 且浏览器支持该 API。");
      }

      let device: BluetoothDevice;
      try {
        device = await api.requestDevice({
          filters: [{ services: [FTMS_SERVICE_UUID] }],
          optionalServices: [FTMS_SERVICE_UUID]
        });
      } catch (e) {
        const isNotFound = e instanceof Error && e.name === 'NotFoundError';
        if (!isNotFound) throw e;
        device = await api.requestDevice({
          acceptAllDevices: true,
          optionalServices: [FTMS_SERVICE_UUID]
        });
      }

      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService(FTMS_SERVICE_UUID);
      if (!service) throw new Error("未发现 FTMS 服务");

      // 1. 运动数据监听
      const dataChar = await service?.getCharacteristic(CROSS_TRAINER_DATA_UUID);
      await dataChar?.startNotifications();
      dataChar?.addEventListener('characteristicvaluechanged', (e: Event) => {
        const char = e.target as BluetoothRemoteGATTCharacteristic;
        const dv = char.value;
        if (!dv) return;
        const newData = parseCrossTrainerData(dv);
        setStats(prev => ({ ...prev, ...newData }));
      });

      // 2. 控制点特征值
      const ctrlChar = await service?.getCharacteristic(CONTROL_POINT_UUID);
      await ctrlChar?.startNotifications();
      controlCharRef.current = ctrlChar || null;

      // 3. 自动请求控制权 (OpCode: 0x00)
      await ctrlChar?.writeValue(new Uint8Array([0x00]));

      deviceRef.current = device;
      setIsConnected(true);

      // 处理意外断连
      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        controlCharRef.current = null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("蓝牙连接失败:", err);
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    deviceRef.current?.gatt?.disconnect();
  }, []);

  // 设置阻力 (0.1 步进处理)
  const setResistance = useCallback(async (level: number) => {
    if (!controlCharRef.current) return;
    
    // 转换为协议要求的原始值 (Level * 10)
    const rawValue = Math.round(level * 10);
    const command = new Uint8Array([0x04, rawValue & 0xFF, (rawValue >> 8) & 0xFF]);
    
    try {
      await controlCharRef.current.writeValue(command);
      if ('vibrate' in navigator) navigator.vibrate(50);
    } catch (e) {
      console.error("阻力设置失败:", e);
    }
  }, []);

  return { isConnected, stats, error, connect, disconnect, setResistance };
};
