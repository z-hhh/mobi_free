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
// 解析器改为兼容 Indoor Bike Data (0x2AD2) 结构
// 即使 UUID 是 Cross Trainer (0x2ACE)，许多厂商 (如 Mobi) 实际上发送的是 Bike 数据结构
const getUint16BE = (value: DataView, offset: number) => {
  return (value.getUint8(offset) << 8) | value.getUint8(offset + 1);
};

const getUint24BE = (value: DataView, offset: number) => {
  return (value.getUint8(offset) << 16) | (value.getUint8(offset + 1) << 8) | value.getUint8(offset + 2);
};

export const parseCrossTrainerData = (value: DataView): Partial<WorkoutStats> => {
  // DEBUG log
  const hex = Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
  console.log('FTMS Raw:', hex);

  const flags = value.getUint16(0, true); // Flags are LE
  let offset = 2;
  const result: Partial<WorkoutStats> = {};

  // 1. Instant Speed (Always present, Big Endian)
  // Value 00 C8 -> 200 -> 2.00 km/h
  const rawSpeed = getUint16BE(value, offset);
  result.instantSpeed = rawSpeed / 100;
  offset += 2;

  // 2. Avg Speed (Bit 1) - Skip
  if (flags & (1 << 1)) offset += 2;

  // 3. Total Distance (Bit 2) - 3 Bytes BE
  if (flags & (1 << 2)) {
    // const dist = getUint24BE(value, offset);
    // result.totalDistance = dist; 
    offset += 3;
  }

  // 4. Step Count (Bit 3) -> Map to Cadence (RPM)
  if (flags & (1 << 3)) {
    const val = getUint16BE(value, offset);
    result.instantCadence = val; // 22, 23, 24... reasonable start RPM
    offset += 2;
  }

  // 5. Stride Count (Bit 4) - Skip
  if (flags & (1 << 4)) offset += 2;

  // 6. Elevation (Bit 5) - Skip
  if (flags & (1 << 5)) offset += 2;

  // 7. Inclination (Bit 6) - Skip
  if (flags & (1 << 6)) offset += 2;

  // 8. Resistance Level (Bit 7) -> Map to Power!
  // Observation: changing 1E..28 (30..40). Represents Watts?
  if (flags & (1 << 7)) {
    const rawVal = getUint16BE(value, offset);
    result.instantPower = rawVal;
    offset += 2;
  }

  // 9. Instant Power (Bit 8) -> Ignore (Constant F0/240)
  if (flags & (1 << 8)) {
    offset += 2;
  }

  // 10. Avg Power (Bit 9) -> Ignore or Log
  // if (flags & (1 << 9)) ...

  return result;
};