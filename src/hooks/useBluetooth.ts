import { useState, useRef, useCallback } from 'react';
import { BluetoothManager } from '../bluetooth/manager';
import type { WorkoutData } from '../bluetooth/protocols/types';

export const useBluetooth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const managerRef = useRef<BluetoothManager>(new BluetoothManager());

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

  const connect = useCallback(async () => {
    try {
      setError(null);
      log("Initializing Bluetooth Manager...");
      
      const protocolName = await managerRef.current.connect();
      log(`Connected using protocol: ${protocolName}`);
      
      setIsConnected(true);
      
      await managerRef.current.startNotifications((data) => {
        setStats(prev => ({ ...prev, ...data }));
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