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
    kcal: 0,
    heartRate: 0,
    elapsedTime: 0
  });

  const controlCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const timerRef = useRef<number | null>(null);

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

        setStats(prev => {
          // 本地计时逻辑：如果有速度且未开始计时，则启动；如果无速度，则暂停？
          // 简单方案：只要收到数据且有速度 > 0，就认为是运动中。
          // 实际上 FTMS 数据频率很高，我们最好只依赖每秒更新一次 UI 或者在这里累加。
          // 更好的体验是：当检测到 speed > 0 时，如果不计时则开始。

          // 这里我们简单做一个 hack: 
          // 如果 stats.elapsedTime 没动 (即 device report 0), 我们自己加。
          // 但由于 rerender 问题，最好用 useEffect 独立计时。
          // 下面只更新 device 数据，把 time 字段留给 local 覆盖。
          // 修正速度显示：设备报告的速度值不稳定 (如 51RPM 报 21.4km/h，而 33RPM 报 4.4km/h)。
          // 我们基于用户认为"正常"的 33RPM -> 4.4km/h (系数 ~0.133) 进行本地重算。
          // 这样能保证速度与踏频线性对应，体验更平滑。
          if (newData.instantCadence !== undefined) {
            newData.instantSpeed = newData.instantCadence * 0.13;
          }

          // 关键修复：始终忽略设备上报的时间，完全依赖本地计时器。
          // 否则设备不断发的 0 会覆盖本地累加的值，导致时间在 0 和 1 之间跳变。
          delete newData.elapsedTime;

          return { ...prev, ...newData };
        });
      });

      // 2. 控制点特征值
      const ctrlChar = await service?.getCharacteristic(CONTROL_POINT_UUID);
      await ctrlChar?.startNotifications();
      controlCharRef.current = ctrlChar || null;

      // 3. 自动请求控制权 (OpCode: 0x00)
      await ctrlChar?.writeValue(new Uint8Array([0x00]));

      deviceRef.current = device;
      setIsConnected(true);

      // 启动本地计时器 (当状态 connected 时)
      if (!timerRef.current) {
        timerRef.current = window.setInterval(() => {
          setStats(s => {
            // 只有当速度 > 0 时才计时和累积数据
            if (s.instantSpeed > 0) {
              // 1. 距离累积 (米): Speed (km/h) * 1000 / 3600 (s)
              const distInc = (s.instantSpeed * 1000) / 3600;

              // 2. 卡路里累积 (kcal): Power (W) -> Work (J) -> Kcal
              // 1 W = 1 J/s. 
              // 1 kcal = 4184 J.
              // Human Efficiency ~24%. 
              // Kcal/s ~= Power / 0.24 / 4184 ~= Power * 0.001
              // Example: 100W -> 0.1 kcal/s -> 360 kcal/h. Reasonable.
              const kcalInc = s.instantPower * 0.001;

              return {
                ...s,
                elapsedTime: s.elapsedTime + 1,
                totalDistance: s.totalDistance + distInc,
                kcal: s.kcal + kcalInc
              };
            }
            return s;
          });
        }, 1000);
      }

      // 处理意外断连
      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        controlCharRef.current = null;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("蓝牙连接失败:", err);
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    deviceRef.current?.gatt?.disconnect();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
