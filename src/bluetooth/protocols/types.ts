export interface WorkoutData {
  instantSpeed?: number;
  instantCadence?: number;
  instantPower?: number;
  resistanceLevel?: number;
  totalDistance?: number;
  kcal?: number;
  heartRate?: number;
  elapsedTime?: number;
}

export interface BluetoothProtocol {
  name: string;
  /**
   * 判断该协议是否支持给定的服务列表
   */
  isSupported(serviceUUIDs: string[]): boolean;
  
  /**
   * 连接并初始化设备（包括握手、获取特征值等）
   */
  connect(server: BluetoothRemoteGATTServer): Promise<void>;
  
  /**
   * 启动数据监听
   */
  startNotifications(onData: (data: WorkoutData) => void): Promise<void>;
  
  /**
   * 设置阻力
   */
  setResistance(level: number): Promise<void>;
  
  /**
   * 断开连接时的清理
   */
  disconnect(): void;
}
