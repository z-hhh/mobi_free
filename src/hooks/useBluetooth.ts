import { useState, useRef, useCallback } from 'react';
import { parseCrossTrainerData } from '../utils/ftms-parser';
import type { WorkoutStats } from '../utils/ftms-parser';

interface DeviceProtocol {
  name: string;
  serviceUUID: number | string;
  dataUUID: number | string;
  controlUUID: number | string;
}

const PROTOCOLS: DeviceProtocol[] = [
  {
    name: 'Standard FTMS',
    serviceUUID: 0x1826,
    dataUUID: 0x2ACE,
    controlUUID: 0x2AD9
  },
  {
    name: 'Legacy/Custom',
    serviceUUID: 0xFFE0,
    dataUUID: 0xFFE4,
    controlUUID: 0xFFE3
  }
];

/**
 * Web Bluetooth API 封装 Hook
 */
export const useBluetooth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const activeProtocolRef = useRef<DeviceProtocol | null>(null);

  const log = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()} - ${msg}`]);
  };
  const [stats, setStats] = useState<WorkoutStats>({
    instantSpeed: 0,
    instantCadence: 0,
    instantPower: 0,
    resistanceLevel: 1,
    totalDistance: 0,
    kcal: 0,
    heartRate: 0,
    elapsedTime: 0
  });

  const controlCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  // 连接设备
  const connect = useCallback(async () => {
    try {
      setError(null);
      log("Checking Bluetooth API...");
      const api = navigator.bluetooth;
      if (!window.isSecureContext || !api?.requestDevice) {
        throw new Error("Web Bluetooth API 不可用。请使用支持的浏览器（Chrome、Edge、Opera）访问，iOS 用户请使用 Bluefy 浏览器。");
      }

      let device: BluetoothDevice;
      try {
        // 收集所有协议的服务 UUID 用于过滤
        const allServiceUUIDs = PROTOCOLS.map(p => p.serviceUUID);
        log(`Requesting device (Filters: ${allServiceUUIDs.map(u => u.toString(16)).join(', ')})...`);

        // Bluefy 特殊处理：如果服务已经在 filters 中，不要在 optionalServices 重复添加
        const isBluefy = 'setScreenDimEnabled' in navigator.bluetooth;

        // 构建 filters：为每个协议创建一个 filter entry
        // 这样可以扫描到支持任意一种协议的设备
        const filters = PROTOCOLS.map(p => ({ services: [p.serviceUUID] }));

        const options: RequestDeviceOptions = {
          filters: filters,
        };

        if (!isBluefy) {
          // 在非 Bluefy 环境下，显式列出所有可选服务，确保我们能访问它们
          // 注意：acceptAllDevices 模式下必须要有 optionalServices，这里虽然是 filter 模式，
          // 但列出 optionalServices 是个好习惯，尤其是当我们以后可能需要访问非 filter 中的服务时。
          // 不过在 filter 模式下，filter 中的服务自动有访问权限。
          // 为了兼容性，我们可以不传 optionalServices 如果它们都在 filter 里。
          // 但为了保险（比如某些特定浏览器行为），可以加上。
          // 然而，为简洁和避免这是非 Bluefy 的重复逻辑，我们只在 acceptAllDevices 时强调 optionalServices。
          // 实际上，如果 filters 涵盖了所有我们需要的服务，就不需要 optionalServices。
          options.optionalServices = allServiceUUIDs;
        } else {
          log("Bluefy detected: skipping optionalServices to avoid duplication bug");
        }

        device = await api.requestDevice(options);
      } catch (e) {
        log(`Standard request failed: ${e}`);
        const isNotFound = e instanceof Error && e.name === 'NotFoundError';
        if (!isNotFound) throw e;

        log("Trying acceptAllDevices...");
        const allServiceUUIDs = PROTOCOLS.map(p => p.serviceUUID);
        // acceptAllDevices 必须要有 optionalServices 才能访问对应服务
        device = await api.requestDevice({
          acceptAllDevices: true,
          optionalServices: allServiceUUIDs
        });
      }

      log(`Device selected: ${device.name} (${device.id})`);
      log("Connecting to GATT Server...");
      const server = await device.gatt?.connect();
      if (!server) throw new Error("无法连接到 GATT Server");

      // 协议发现：尝试匹配已定义的协议
      log("Detecting Protocol...");
      let service: BluetoothRemoteGATTService | undefined;
      let matchedProtocol: DeviceProtocol | null = null;

      for (const protocol of PROTOCOLS) {
        try {
          service = await server.getPrimaryService(protocol.serviceUUID);
          if (service) {
            matchedProtocol = protocol;
            log(`Protocol detected: ${protocol.name} (${protocol.serviceUUID.toString(16)})`);
            break;
          }
        } catch (e) {
          // 忽略单个服务的查找失败，继续尝试下一个
        }
      }

      if (!service || !matchedProtocol) {
        throw new Error("未发现支持的服务 (FTMS 或 Legacy)");
      }

      activeProtocolRef.current = matchedProtocol;

      // 1. 运动数据监听
      log(`Getting Data Characteristic (${matchedProtocol.dataUUID.toString(16)})...`);
      const dataChar = await service.getCharacteristic(matchedProtocol.dataUUID);
      await dataChar?.startNotifications();
      dataChar?.addEventListener('characteristicvaluechanged', (e: Event) => {
        const char = e.target as BluetoothRemoteGATTCharacteristic;
        const dv = char.value;
        if (!dv) return;

        // 假设不同协议的数据格式兼容（基于当前需求）
        // 如果未来有很大差异，可以在 DeviceProtocol 中增加 parser 方法
        const newData = parseCrossTrainerData(dv);

        setStats(prev => {
          return { ...prev, ...newData };
        });
      });

      // 2. 控制点特征值
      log(`Getting Control Characteristic (${matchedProtocol.controlUUID.toString(16)})...`);
      const ctrlChar = await service.getCharacteristic(matchedProtocol.controlUUID);
      await ctrlChar?.startNotifications();
      ctrlChar?.addEventListener('characteristicvaluechanged', (e: Event) => {
        const char = e.target as BluetoothRemoteGATTCharacteristic;
        const dv = char.value;
        if (!dv) return;
        // 控制点反馈处理（如果需要）
      });
      controlCharRef.current = ctrlChar || null;

      // 3. 自动请求控制权 (OpCode: 0x00)
      log("Requesting Control...");
      await ctrlChar?.writeValue(new Uint8Array([0x00]));

      // 4. 启动训练 (OpCode: 0x07 - Start or Resume)
      await new Promise(resolve => setTimeout(resolve, 100)); // 等待控制权确认
      log("Starting Session...");
      await ctrlChar?.writeValue(new Uint8Array([0x07]));

      deviceRef.current = device;
      setIsConnected(true);
      log("Connection successful!");

      // 处理意外断连
      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        controlCharRef.current = null;
        log("Disconnected");
      });
    } catch (err) {
      console.error("蓝牙连接失败:", err, JSON.stringify(err));

      let msg = err instanceof Error ? err.message : String(err);

      // Bluefy 特有的模糊错误码 "2" (通常意味着连接失败或被取消)
      if (msg === "2" || msg.includes("error 2") || (typeof err === "number" && err === 2)) {
        msg = "连接失败 (Error 2): 请检查蓝牙是否开启，设备是否开机，或尝试重启 Bluefy 浏览器。";
      }

      setError(msg);
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    deviceRef.current?.gatt?.disconnect();
  }, []);

  // 设置阻力 (0.1 步进处理)
  const setResistance = useCallback(async (level: number) => {
    if (!controlCharRef.current) return;

    // 限制阻力范围：10-24 档（机器不接受 9 及以下的值）
    const clampedLevel = Math.max(10, Math.min(24, Math.round(level)));

    // 直接发送档位值（不乘以 10）
    // 机器的非标准实现：读取时返回 value*10，写入时直接发送档位
    const rawValue = clampedLevel;
    const command = new Uint8Array([0x04, rawValue & 0xFF, (rawValue >> 8) & 0xFF]);

    try {
      await controlCharRef.current.writeValue(command);
      if ('vibrate' in navigator) navigator.vibrate(50);
    } catch (e) {
      console.error("阻力设置失败:", e);
    }
  }, []);

  return { isConnected, stats, error, connect, disconnect, setResistance, logs };
};
