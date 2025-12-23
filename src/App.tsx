import { useState, useCallback } from 'react';
import { 
  Activity, 
  Zap, 
  Gauge, 
  Bluetooth, 
  BluetoothOff, 
  RotateCcw, 
  Plus, 
  Minus, 
  Info 
} from 'lucide-react';
import { useBluetooth } from './hooks/useBluetooth';


/**
 * --- UI 组件 ---
 */
type StatCardProps = {
  title: string;
  value: number | string;
  unit: string;
  icon: React.ReactNode;
  highlight?: boolean;
};
const StatCard = ({ title, value, unit, icon, highlight }: StatCardProps) => (
  <div className={`p-6 rounded-3xl border border-white/5 transition-all hover:border-white/10 ${highlight ? 'bg-gradient-to-br from-zinc-800 to-black col-span-2 md:col-span-2' : 'bg-zinc-900/50'}`}>
    <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase mb-4">
      {icon} {title}
    </div>
    <div className="flex items-baseline gap-2">
      <span className={`${highlight ? 'text-7xl' : 'text-4xl'} font-black tabular-nums tracking-tighter`}>
        {value}
      </span>
      <span className="text-zinc-600 font-bold text-sm uppercase">{unit}</span>
    </div>
  </div>
);

type ControlButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
};
const ControlButton = ({ children, onClick }: ControlButtonProps) => (
  <button 
    onClick={onClick} 
    className="flex-1 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center hover:bg-zinc-700 active:scale-95 transition-all text-white shadow-lg"
  >
    {children}
  </button>
);

/**
 * --- 主应用组件 ---
 */
export default function App() {
  const { isConnected, stats, error, connect, disconnect, setResistance } = useBluetooth();
  const [uiResistance, setUiResistance] = useState(1);

  // 设置阻力逻辑
  const updateResistance = useCallback(async (level: number) => {
    const safeLevel = Math.min(Math.max(level, 1), 24);
    const rawValue = Math.round(safeLevel * 10);
    
    try {
      await setResistance(rawValue / 10);
      setUiResistance(safeLevel);
      if ('vibrate' in navigator) navigator.vibrate(50);
    } catch (e) {
      console.error("设置阻力失败", e);
    }
  }, [setResistance]);

  const handleManualAdjust = (delta: number) => {
    updateResistance(uiResistance + delta);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 sm:p-6 font-sans">
      <header className="w-full flex justify-between items-center mb-10">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2 rounded-xl">
            <Activity className="text-black w-6 h-6" strokeWidth={3} />
          </div>
          <h1 className="font-black italic text-2xl tracking-tighter">MOBI-FREE</h1>
        </div>
        <button 
          onClick={isConnected ? disconnect : connect}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all shadow-xl ${
            isConnected ? 'bg-zinc-800 text-zinc-400' : 'bg-white text-black hover:scale-105 active:scale-95'
          }`}
        >
          {isConnected ? <BluetoothOff size={18} /> : <Bluetooth size={18} />}
          {isConnected ? "断开" : "连接椭圆机"}
        </button>
      </header>

      <main className="w-full space-y-6">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6 flex gap-4 items-start">
            <Info className="text-rose-500 w-6 h-6 shrink-0 mt-0.5" />
            <div className="text-sm text-rose-200/70 leading-relaxed">
              {error}
            </div>
          </div>
        )}
        {/* 数据面板 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard 
            title="瞬时功率" 
            value={stats.instantPower} 
            unit="W" 
            icon={<Zap className="text-amber-500 w-4 h-4" />} 
            highlight 
          />
          <StatCard 
            title="实时踏频" 
            value={stats.instantCadence} 
            unit="RPM" 
            icon={<RotateCcw className="text-blue-400 w-4 h-4" />} 
          />
          <StatCard 
            title="即时速度" 
            value={stats.instantSpeed.toFixed(1)} 
            unit="KM/H" 
            icon={<Gauge className="text-emerald-400 w-4 h-4" />} 
          />
        </div>

        {/* 阻力控制面板 */}
        <div className="bg-zinc-900 rounded-[2.5rem] p-6 sm:p-8 border border-white/5 shadow-2xl">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">阻力强度调节</h2>
              <div className="text-6xl font-black italic text-amber-500 tracking-tighter">
                L{uiResistance}
              </div>
            </div>
            <div className="text-zinc-600 text-[10px] font-bold uppercase">范围: 1.0 - 24.0</div>
          </div>
          
          <input 
            type="range" 
            min="1" 
            max="24" 
            step="1"
            value={uiResistance}
            onChange={(e) => setUiResistance(parseInt(e.target.value))}
            onMouseUp={() => updateResistance(uiResistance)}
            onTouchEnd={() => updateResistance(uiResistance)}
            className="w-full h-3 bg-zinc-800 rounded-full appearance-none accent-amber-500 mb-10 cursor-pointer"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-3">
              <ControlButton onClick={() => handleManualAdjust(-1)}><Minus /></ControlButton>
              <ControlButton onClick={() => handleManualAdjust(1)}><Plus /></ControlButton>
            </div>
            <div className="flex gap-2">
              {[5, 12, 20].map(level => (
                <button 
                  key={level} 
                  onClick={() => updateResistance(level)} 
                  className={`flex-1 rounded-2xl text-xs font-black transition-all border-2 ${
                    uiResistance === level 
                    ? 'bg-amber-500/10 border-amber-500 text-amber-500' 
                    : 'bg-zinc-800 border-transparent text-zinc-500 hover:bg-zinc-700'
                  }`}
                >
                  档位 {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 帮助信息 */}
        {!isConnected && (
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 flex gap-4 items-start">
            <Info className="text-blue-500 w-6 h-6 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200/60 leading-relaxed">
              <p className="font-bold text-blue-400 mb-1 tracking-tight">连接说明</p>
              请确保您的椭圆机处于开机状态，且未被其他 App（如官方 App 或 Zwift）连接。点击上方按钮扫描并选择您的设备即可开始。
            </div>
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="w-full mt-12 mb-8 text-center">
        <p className="text-zinc-700 text-[10px] font-bold uppercase tracking-[0.2em]">
          Powered by Web Bluetooth API & Open Source
        </p>
      </footer>
    </div>
  );
}
