/**
 * 莫比椭圆机 FTMS 协议数据解析器
 */

export interface WorkoutStats {
  instantSpeed: number;
  instantCadence: number;
  instantPower: number;
  resistanceLevel: number;
  totalDistance: number;
  kcal: number;
}

/**
 * 解析 Cross Trainer Data (0x2ACE)
 */
export const parseCrossTrainerData = (value: DataView): Partial<WorkoutStats> => {
  const flags = value.getUint16(0, true);
  let offset = 2;
  const result: Partial<WorkoutStats> = {};

  // 位 0: 瞬时速度 (0.01 km/h)
  if (!(flags & (1 << 0))) {
    result.instantSpeed = value.getUint16(offset, true) / 100;
    offset += 2;
  }

  // 位 2: 瞬时踏频 (0.5 RPM)
  if (flags & (1 << 2)) {
    result.instantCadence = value.getUint16(offset, true) / 2;
    offset += 2;
  }

  // 位 6: 瞬时功率 (1 Watt)
  if (flags & (1 << 6)) {
    result.instantPower = value.getInt16(offset, true);
    offset += 2;
  }

  // 位 7: 阻力等级 (0.1 Unit)
  if (flags & (1 << 7)) {
    result.resistanceLevel = value.getInt16(offset, true) / 10;
    offset += 2;
  }

  return result;
};