import { useState, useCallback, useEffect } from 'react';
import {
  Activity,
  Zap,
  Gauge,
  Bluetooth,
  BluetoothOff,
  RotateCcw,
  Plus,
  Minus,
  Info,
  Timer,
  Flame,
  MapPin,
  Github,
  Heart,
  X,
  MessageCircle
} from 'lucide-react';
import { useBluetooth } from './hooks/useBluetooth';
import { useWakeLock } from './hooks/useWakeLock';
import { logEvent } from './services/analytics';
import alipayQR from './assets/alipay.jpg';


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

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * --- 主应用组件 ---
 */
export default function App() {
  const { isConnected, stats, error, connect, disconnect, setResistance, logs } = useBluetooth();
  useWakeLock(isConnected); // 仅在连接设备时保持屏幕常亮
  const [uiResistance, setUiResistance] = useState(10);
  const [ignoreRemoteUpdatesUntil, setIgnoreRemoteUpdatesUntil] = useState(0);
  const [showDonation, setShowDonation] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    logEvent('APP_OPEN');
  }, []);

  // 初始连接时同步机器阻力值
  useEffect(() => {
    const now = Date.now();
    // 只在以下情况更新 UI：
    // 1. 机器返回了有效值
    // 2. 当前不在「忽略远程更新」的时间窗口内
    // 3. 值确实不同
    // 4. 用户不在拖拽滑块中
    if (!isDragging &&
      stats.resistanceLevel &&
      now > ignoreRemoteUpdatesUntil &&
      stats.resistanceLevel !== uiResistance) {
      setUiResistance(Math.round(stats.resistanceLevel));
    }
  }, [stats.resistanceLevel, uiResistance, ignoreRemoteUpdatesUntil, isDragging]);

  const updateResistance = useCallback(async (level: number) => {
    const safeLevel = Math.min(Math.max(level, 1), 24);

    try {
      // 立即更新 UI（乐观更新）
      setUiResistance(safeLevel);
      // 忽略接下来 1 秒内的机器返回值，避免因延迟导致的闪烁
      setIgnoreRemoteUpdatesUntil(Date.now() + 1000);

      await setResistance(safeLevel);
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
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all shadow-xl ${isConnected ? 'bg-zinc-800 text-zinc-400' : 'bg-white text-black hover:scale-105 active:scale-95'
            }`}
        >
          {isConnected ? <BluetoothOff size={18} /> : <Bluetooth size={18} />}
          {isConnected ? "断开" : "连接椭圆机"}
        </button>
      </header>

      <main className="w-full space-y-6">
        {/* 开源部署提示 */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-3xl p-4 flex gap-3 items-center">
          <Info className="text-blue-400 w-5 h-5 shrink-0" />
          <div className="text-sm text-blue-200/80 leading-relaxed flex-1">
            <span className="font-bold text-blue-300">代码开源</span>，推荐部署自己的版本
          </div>
          <a
            href="https://github.com/z-hhh/mobi_free?tab=readme-ov-file#-%E9%83%A8%E7%BD%B2%E5%88%B0-github-pages"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-full text-xs font-bold text-blue-300 hover:text-blue-200 transition-all whitespace-nowrap"
          >
            查看教程
          </a>
        </div>
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6 flex gap-4 items-start">
            <Info className="text-rose-500 w-6 h-6 shrink-0 mt-0.5" />
            <div className="text-sm text-rose-200/70 leading-relaxed">
              {error}
            </div>
          </div>
        )}
        {/* 数据面板 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="瞬时功率"
            value={stats.instantPower ?? 0}
            unit="W"
            icon={<Zap className="text-amber-500 w-4 h-4" />}
            highlight
          />
          <StatCard
            title="实时踏频"
            value={stats.instantCadence ?? 0}
            unit="RPM"
            icon={<RotateCcw className="text-blue-400 w-4 h-4" />}
          />
          <StatCard
            title="即时速度"
            value={(stats.instantSpeed ?? 0).toFixed(1)}
            unit="KM/H"
            icon={<Gauge className="text-emerald-400 w-4 h-4" />}
          />

          <StatCard
            title="运动时长"
            value={formatTime(stats.elapsedTime ?? 0)}
            unit=""
            icon={<Timer className="text-purple-400 w-4 h-4" />}
          />
          <StatCard
            title="消耗热量"
            value={(stats.kcal ?? 0).toFixed(0)}
            unit="KCAL"
            icon={<Flame className="text-orange-500 w-4 h-4" />}
          />
          <StatCard
            title="骑行距离"
            value={((stats.totalDistance ?? 0) / 1000).toFixed(2)}
            unit="KM"
            icon={<MapPin className="text-pink-400 w-4 h-4" />}
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
            <div className="text-zinc-600 text-[10px] font-bold uppercase">范围: 1 - 24</div>
          </div>

          <input
            type="range"
            min="1"
            max="24"
            step="1"
            value={uiResistance}
            onChange={(e) => setUiResistance(parseInt(e.target.value))}
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
            onMouseUp={() => { setIsDragging(false); updateResistance(uiResistance); }}
            onTouchEnd={() => { setIsDragging(false); updateResistance(uiResistance); }}
            className="w-full h-3 bg-zinc-800 rounded-full appearance-none accent-amber-500 mb-10 cursor-pointer"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-3">
              <ControlButton onClick={() => handleManualAdjust(-1)}><Minus /></ControlButton>
              <ControlButton onClick={() => handleManualAdjust(1)}><Plus /></ControlButton>
            </div>
            <div className="flex gap-2">
              {[1, 12, 24].map(level => (
                <button
                  key={level}
                  onClick={() => updateResistance(level)}
                  className={`flex-1 rounded-2xl text-xs font-black transition-all border-2 ${uiResistance === level
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
        {
          !isConnected && (
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 flex gap-4 items-start">
              <Info className="text-blue-500 w-6 h-6 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200/60 leading-relaxed">
                <p className="font-bold text-blue-400 mb-1 tracking-tight">连接说明</p>
                请确保您的椭圆机处于开机状态，且未被其他 App（如官方 App）连接。点击上方按钮扫描并选择您的设备即可开始（需要同意蓝牙权限）。
              </div>
            </div>
          )
        }

        {/* 调试日志 (仅在非连接状态或有错误时显示，或者始终显示以帮助调试) */}
        {!isConnected && (
          <div className="mt-8 p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-xs font-mono text-zinc-500 overflow-hidden">
            <div className="mb-2 font-bold uppercase tracking-wider text-zinc-600 flex justify-between">
              <span>Debug Log</span>
              <span className="text-zinc-700">{logs.length} events</span>
            </div>
            <div className="h-32 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-zinc-700 italic">No logs yet...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="break-all border-b border-zinc-800/50 pb-0.5 mb-0.5 last:border-0">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main >

      {/* 页脚 */}
      <footer className="w-full mt-12 mb-8">
        <div className="flex justify-center items-center gap-4 mb-4">
          <a
            href="https://github.com/z-hhh/mobi_free"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all text-sm font-bold text-zinc-300 hover:text-white"
          >
            <Github size={16} />
            GitHub
          </a>
          <button
            onClick={() => setShowFeedback(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all text-sm font-bold text-zinc-300 hover:text-white"
          >
            <MessageCircle size={16} />
            问题反馈
          </button>
          <button
            onClick={() => setShowDonation(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 rounded-full transition-all text-sm font-bold text-white shadow-lg hover:shadow-xl"
          >
            <Heart size={16} fill="currentColor" />
            捐助本项目
          </button>
        </div>
        <p className="text-zinc-700 text-[10px] font-bold uppercase tracking-[0.2em] text-center">
          Powered by Web Bluetooth API & Open Source
        </p>
        <p className="text-zinc-800 text-[9px] font-mono text-center mt-2 opacity-50">
          v{__APP_VERSION__} | Build: {__BUILD_TIME__} | Commit: {__COMMIT_HASH__}
        </p>
      </footer>

      {/* 捐助弹窗 */}
      {showDonation && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowDonation(false)}
        >
          <div
            className="bg-zinc-900 rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowDonation(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <h3 className="text-2xl font-black mb-2 text-center">感谢支持 ❤️</h3>
            <p className="text-zinc-500 text-sm text-center mb-6">
              您的支持是我持续开发的动力
            </p>
            <div className="bg-white p-4 rounded-2xl">
              <img
                src={alipayQR}
                alt="支付宝收款码"
                className="w-full h-auto rounded-lg"
              />
            </div>
            <p className="text-zinc-600 text-xs text-center mt-4">
              使用支付宝扫码赞助
            </p>
          </div>
        </div>
      )}

      {/* 反馈弹窗 */}
      {showFeedback && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowFeedback(false)}
        >
          <div
            className="bg-zinc-900 rounded-3xl p-8 max-w-sm w-full border border-white/10 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowFeedback(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <h3 className="text-2xl font-black mb-2 text-center">问题反馈</h3>
            <p className="text-zinc-500 text-sm text-center mb-6">
              加入 QQ 群反馈问题或交流
            </p>
            <div className="bg-zinc-800 p-6 rounded-2xl text-center">
              <div className="text-zinc-400 text-sm mb-2">QQ 群号</div>
              <div className="text-3xl font-black text-white tracking-widest select-all">
                1073767295
              </div>
            </div>
            <p className="text-zinc-600 text-xs text-center mt-4">
              点击群号可复制
            </p>
          </div>
        </div>
      )}
    </div >
  );
}
