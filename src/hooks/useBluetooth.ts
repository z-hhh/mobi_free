import { useState, useRef, useCallback, useEffect } from 'react';
import { BluetoothManager } from '../bluetooth/manager';
import type { WorkoutData } from '../bluetooth/protocols/types';

export const useBluetooth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const managerRef = useRef<BluetoothManager>(new BluetoothManager());

  // 记录上次收到有效运动数据的时间
  const lastActivityTimeRef = useRef<number>(0);

  const [stats, setStats] = useState<WorkoutData>({
    instantSpeed: 0,
    instantCadence: 0,
    instantPower: 0,
    resistanceLevel: 10, // Default start
    totalDistance: 0,
    kcal: 0,
    heartRate: 0,
    elapsedTime: 0
  });

  const log = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev.slice(-20), `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  // 本地计时器逻辑
  useEffect(() => {
    if (!isConnected) return;

    const timer = setInterval(() => {
      const now = Date.now();
      // 如果 5 秒内有活动数据，则增加计时
      // 参考官方 App 逻辑：有速度/踏频视为运动中，无数据超过一定时间(自动暂停时间)则暂停
      if (now - lastActivityTimeRef.current < 5000) {
        setStats(prev => ({
          ...prev,
          elapsedTime: (prev.elapsedTime || 0) + 1
        }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isConnected]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      log("Initializing Bluetooth Manager...");

      const protocolName = await managerRef.current.connect();
      log(`Connected using protocol: ${protocolName}`);

      // 重置数据
      setStats({
        instantSpeed: 0,
        instantCadence: 0,
        instantPower: 0,
        resistanceLevel: 10,
        totalDistance: 0,
        kcal: 0,
        heartRate: 0,
        elapsedTime: 0
      });
      lastActivityTimeRef.current = 0; // 重置活动时间

      setIsConnected(true);

      await managerRef.current.startNotifications((data) => {
        // 检测是否有运动
        if ((data.instantSpeed && data.instantSpeed > 0) || (data.instantCadence && data.instantCadence > 0)) {
          lastActivityTimeRef.current = Date.now();
        }

        // 过滤掉设备返回的时间，使用本地计时
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { elapsedTime, ...rest } = data;

        setStats(prev => ({ ...prev, ...rest }));
      });

      log("Data stream started.");

    } catch (err) {
      console.error("Connection failed:", err);
      let msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User cancelled")) {
        msg = "用户取消了连接";
      } else if (msg === "2" || msg.includes("error 2") || (typeof err === "number" && err === 2)) {
        msg = "连接失败 (Error 2): 请检查蓝牙是否开启，设备是否开机，或尝试重启 Bluefy 浏览器。";
      }
      setError(msg);
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    managerRef.current.disconnect();
    setIsConnected(false);
    log("Disconnected.");
  }, []);

  const setResistance = useCallback(async (level: number) => {
    try {
      await managerRef.current.setResistance(level);
    } catch (e) {
      console.error("Failed to set resistance:", e);
    }
  }, []);

  // Monitor connection state via polling or events if manager supports it,
  // but for now relying on state management here is fine.

  return { isConnected, stats, error, connect, disconnect, setResistance, logs };
};