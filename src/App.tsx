import { useRef, useState, useCallback, useEffect } from "react";
import useGestureRecognition from "./components/hands-capture/hooks";

// --- Clinical Card Components ---

const FmaGauge = ({ value, color }) => {
  const radius = 70;
  const circumference = Math.PI * radius; // Semi-circle
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: '100%', height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', marginBottom: '20px' }}>
      <svg width="200" height="120" style={{ transform: 'rotate(0deg)' }}>
        <path
          d="M 30 110 A 70 70 0 0 1 170 110"
          fill="none"
          stroke="#2D333B"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 30 110 A 70 70 0 0 1 170 110"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', bottom: '0', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', fontWeight: 900, color: '#FFF', lineHeight: 1 }}>{Math.round(value)}</div>
        <div style={{ fontSize: '0.65rem', color: '#8B949E', fontWeight: 800, letterSpacing: '0.1em', marginTop: '4px' }}>FMA-UE PROXY</div>
      </div>
    </div>
  );
};

const MetricCard = ({ name, subtitle, value, unit, color, isShort = false }) => (
  <div style={{
    background: '#1C2128',
    borderRadius: '10px',
    padding: '14px',
    borderLeft: `3px solid ${color}`,
    transition: 'border-color 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: isShort ? '80px' : '100px'
  }}>
    <div>
      <div style={{ color: '#8B949E', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em' }}>{name}</div>
      <div style={{ color: '#484F58', fontSize: '0.6rem', marginTop: '2px' }}>{subtitle}</div>
    </div>
    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline' }}>
      <span style={{ color: '#FFFFFF', fontSize: '1.4rem', fontWeight: 700, fontFamily: 'monospace' }}>{Math.round(value)}</span>
      <span style={{ color: '#8B949E', fontSize: '0.7rem', marginLeft: '4px' }}>{unit}</span>
    </div>
  </div>
);

function App() {
  const videoElement = useRef<HTMLVideoElement>(null);
  const canvasEl = useRef<HTMLCanvasElement>(null);

  // --- Buffers & Refs ---
  const lastUpdateTimeRef = useRef<number>(0);
  const speedBuffer = useRef<number[]>([]);
  const calibrationRef = useRef({ maxSpan: 300, maxPinch: 200 });
  const sessionRef = useRef({ peakFma: 0, bestPinch: 999, maxExtension: 0 });
  const prevLm0Ref = useRef<any>(null);

  // --- State ---
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationTimer, setCalibrationTimer] = useState(0);
  const [metrics, setMetrics] = useState({
    detected: false,
    pinchIndex: 0,
    extensionScore: 0,
    fluidity: 0,
    wristControl: 0,
    wristAngle: 0,
    individuation: 0,
    fmaProxy: 0
  });

  const onResultsCallback = useCallback((results) => {
    const now = Date.now();
    const detected = !!(results.multiHandLandmarks && results.multiHandLandmarks.length > 0);
    
    if (detected) {
      const lm = results.multiHandLandmarks[0];
      const vw = 960;
      const vh = 540;
      const getDist = (p1, p2) => Math.sqrt(Math.pow((p1.x - p2.x) * vw, 2) + Math.pow((p1.y - p2.y) * vh, 2));

      // Hand Size Reference (Wrist to Palm Center)
      const handSize = getDist(lm[0], lm[9]);

      // 1. PINCH INDEX
      const dPinch = getDist(lm[4], lm[8]);
      const pinchIndex = Math.max(0, Math.min(100, 100 - (dPinch / calibrationRef.current.maxPinch * 100)));

      // 2. EXTENSION SCORE (Normalized by Hand Size)
      const rawSpan = getDist(lm[4], lm[20]); // Thumb to Pinky
      const normalizedSpan = rawSpan / (handSize * 2.5);
      const extensionScore = Math.min(100, Math.max(0, normalizedSpan * 100));

      // 3. MOVEMENT FLUIDITY (SPARC proxy)
      let currentSpeed = 0;
      if (prevLm0Ref.current) {
        currentSpeed = getDist(lm[0], prevLm0Ref.current) * 30;
      }
      prevLm0Ref.current = { x: lm[0].x, y: lm[0].y };
      speedBuffer.current.push(currentSpeed);
      if (speedBuffer.current.length > 30) speedBuffer.current.shift();
      
      const meanSpeed = speedBuffer.current.reduce((a, b) => a + b, 0) / speedBuffer.current.length;
      const variance = speedBuffer.current.reduce((a, b) => a + Math.pow(b - meanSpeed, 2), 0) / speedBuffer.current.length;
      const cv = Math.sqrt(variance) / (meanSpeed + 0.001);
      const fluidity = Math.max(0, Math.min(100, 100 - (cv * 100)));

      // 4. WRIST CONTROL (Articular Angle 0-09-12)
      const v1x = (lm[9].x - lm[0].x);
      const v1y = (lm[9].y - lm[0].y);
      const v2x = (lm[12].x - lm[9].x);
      const v2y = (lm[12].y - lm[9].y);
      const dot = v1x*v2x + v1y*v2y;
      const mag1 = Math.sqrt(v1x*v1x + v1y*v1y);
      const mag2 = Math.sqrt(v2x*v2x + v2y*v2y);
      const cosAngle = dot / (mag1 * mag2 + 0.001);
      const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
      const angleDeg = angleRad * 180 / Math.PI;
      const wristControl = Math.min(100, Math.max(0, (angleDeg / 180) * 100));

      // 5. FINGER INDIVIDUATION (Relative movement range)
      const fingerExtensions = [
        getDist(lm[4], lm[2]) / handSize,
        getDist(lm[8], lm[5]) / handSize,
        getDist(lm[12], lm[9]) / handSize,
        getDist(lm[16], lm[13]) / handSize,
        getDist(lm[20], lm[17]) / handSize,
      ];
      const maxExt = Math.max(...fingerExtensions);
      const minExt = Math.min(...fingerExtensions);
      const individuation = Math.min(100, Math.max(0, ((maxExt - minExt) / 0.5) * 100));

      // 6. FMA PROXY
      const fmaProxy = (pinchIndex * 0.25 + extensionScore * 0.25 + fluidity * 0.20 + wristControl * 0.15 + individuation * 0.15);

      // --- CALIBRATION LOGIC ---
      if (isCalibrating) {
        calibrationRef.current.maxPinch = Math.max(calibrationRef.current.maxPinch, dPinch);
      }

      // Session Updates
      sessionRef.current.peakFma = Math.max(sessionRef.current.peakFma, fmaProxy);
      sessionRef.current.bestPinch = Math.min(sessionRef.current.bestPinch, dPinch);
      sessionRef.current.maxExtension = Math.max(sessionRef.current.maxExtension, rawSpan);

      if (now - lastUpdateTimeRef.current > 50) {
        setMetrics({
          detected: true,
          pinchIndex,
          extensionScore,
          fluidity,
          wristControl,
          wristAngle: Math.round(angleDeg),
          individuation,
          fmaProxy
        });
        lastUpdateTimeRef.current = now;
      }
    } else {
      if (now - lastUpdateTimeRef.current > 50) {
        setMetrics(m => ({ ...m, detected: false }));
        lastUpdateTimeRef.current = now;
      }
    }
  }, [isCalibrating]);

  const { maxVideoWidth, maxVideoHeight } = useGestureRecognition({
    videoElement,
    canvasEl,
    onResultsCallback
  });

  const handleCalibrate = () => {
    setIsCalibrating(true);
    setCalibrationTimer(3);
    const interval = setInterval(() => {
      setCalibrationTimer(t => {
        if (t <= 1) {
          clearInterval(interval);
          setIsCalibrating(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const getStatusColor = (val) => val > 70 ? '#22C55E' : val > 35 ? '#F97316' : '#EF4444';

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#0D1117', color: '#c9d1d9' }}>
      
      {/* --- LEFT PANEL (60%) --- */}
      <div style={{ flex: '0 0 60%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <video style={{ display: 'none' }} playsInline ref={videoElement} />
        <canvas ref={canvasEl} width={maxVideoWidth} height={maxVideoHeight} style={{ display: 'block', maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />

        <div style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: '8px', backdropFilter: 'blur(4px)' }}>
          <span className="pulse-dot" style={{ background: metrics.detected ? '#22C55E' : '#EF4444' }}></span>
          <span style={{ color: metrics.detected ? '#22C55E' : '#EF4444', fontSize: '0.75rem', fontWeight: 800 }}>
            {metrics.detected ? 'TRACKING ACTIVE' : 'NO HAND DETECTED'}
          </span>
        </div>

        {isCalibrating && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', color: '#00D4FF', letterSpacing: '0.2em', fontWeight: 800 }}>CALIBRATING...</div>
              <div style={{ fontSize: '5rem', fontWeight: 900, color: '#FFF' }}>{calibrationTimer}</div>
              <div style={{ fontSize: '0.8rem', color: '#8B949E' }}>OPEN AND CLOSE HAND TO MAX RANGE</div>
            </div>
          </div>
        )}
      </div>

      {/* --- RIGHT PANEL (40%) --- */}
      <div style={{ flex: '0 0 40%', background: '#161B22', padding: '24px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #30363D', overflowY: 'auto' }}>
        
        <div style={{ background: '#1C2128', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid #30363D', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <FmaGauge value={metrics.fmaProxy} color={getStatusColor(metrics.fmaProxy)} />
          <div style={{ textAlign: 'center', color: '#484F58', fontSize: '0.7rem' }}>
            DIGITAL FUGL-MEYER SCORE (PROXY) · AI-ASSESSED
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: 'auto' }}>
          <MetricCard name="PINCH INDEX" subtitle="9-Hole Peg Test" value={metrics.pinchIndex} unit="%" color={getStatusColor(metrics.pinchIndex)} />
          <MetricCard name="EXTENSION" subtitle="Max span aperture" value={metrics.extensionScore} unit="%" color={getStatusColor(metrics.extensionScore)} />
          <MetricCard name="FLUIDITY" subtitle="Vibe & Jitter SPARC" value={metrics.fluidity} unit="pts" color={getStatusColor(metrics.fluidity)} />
          <MetricCard name="WRIST CTRL" subtitle="Articular Angle" value={metrics.wristAngle} unit="°" color={getStatusColor(metrics.wristControl)} />
          <MetricCard name="INDIVIDUATION" subtitle="Finger synergy" value={metrics.individuation} unit="idx" color={getStatusColor(metrics.individuation)} />
          
          <button 
            onClick={handleCalibrate}
            style={{ 
              background: isCalibrating ? '#30363D' : '#238636', 
              color: '#FFF', border: 'none', borderRadius: '10px', 
              fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.1em', cursor: 'pointer' 
            }}
          >
            {isCalibrating ? 'RECORDING...' : 'CALIBRATE'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid #30363D', paddingTop: '20px', marginTop: '24px' }}>
          <div style={{ color: '#6B7280', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '16px' }}>SESSION SNAPSHOT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.55rem' }}>FMA PEAK</div>
              <div style={{ color: '#FFF', fontSize: '1rem', fontWeight: 700 }}>{Math.round(sessionRef.current.peakFma)}</div>
            </div>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.55rem' }}>BEST PINCH</div>
              <div style={{ color: '#FFF', fontSize: '1rem', fontWeight: 700 }}>{Math.round(sessionRef.current.bestPinch)}px</div>
            </div>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.55rem' }}>MAX EXT</div>
              <div style={{ color: '#FFF', fontSize: '1rem', fontWeight: 700 }}>{Math.round(sessionRef.current.maxExtension)}px</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;