import { useState, useEffect, useCallback, useRef } from 'react';
import { useGestureLaunch, useChallenge, ChallengeType } from './GameEngineProvider';

// --- Types & Constants ---

export interface SessionJSON {
  session_id: number;
  patient_id: string;
  timestamp: string;
  pinch_precision: number;
  hand_opening_speed: number;
  finger_individuation: number;
  facial_symmetry_index_lower: number;
  smile_symmetry_dynamic: number;
  fixation_heatmap_asymmetry: number;
  dwell_time_asymmetry: number;
  RT_gaze_to_grip: number;
  cognitive_motor_score: number;
  grip_aperture_variability: number;
  fish_caught: number;
  session_duration_ms: number;
}

export type SessionPhase = 'IDLE' | 'BASELINE' | 'CASTING' | 'CHALLENGE' | 'VISUAL' | 'COMPLETE';

const SESSION_PHASES: { phase: SessionPhase; duration: number; challenges: ChallengeType[]; autoChallenge?: ChallengeType }[] = [
  { 
    phase: 'BASELINE', duration: 15000,
    challenges: [],
    autoChallenge: 'NEUTRAL_FACE'
  },
  { 
    phase: 'CASTING', duration: 20000,
    challenges: ['SHOW_FINGERS', 'PINCH_TARGET', 'OPEN_HAND', 'FINGER_MATH', 'REACH_AND_PINCH']
  },
  { 
    phase: 'CHALLENGE', duration: 15000,
    challenges: [
      'FINGER_SEQUENCE', 'OPEN_CLOSE_RHYTHM', 'FINGERS_AND_SMILE',
      'FINGER_COUNT_OBJECT', 'FIST_HOLD',
      'MIRROR_FINGERS', 'ODD_ONE_OUT', 'DUAL_TASK_BASELINE'
    ]
  },
  { 
    phase: 'VISUAL', duration: 10000,
    challenges: [],
  }
];

export const useGameSession = () => {
  const [phase, setPhase] = useState<SessionPhase>('IDLE');
  const [phaseIndex, setPhaseIndex] = useState(-1);
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState(0);
  const [totalTimeRemaining, setTotalTimeRemaining] = useState(60000);
  const [fishCaught, setFishCaught] = useState(0);
  const [sessionMetrics, setSessionMetrics] = useState<SessionJSON | null>(null);

  const { castGestureDetected } = useGestureLaunch();
  const { startChallenge, challengeCompleted, metrics, resetGame } = useChallenge();

  // Accumulators for averaging metrics
  const metricsAcc = useRef<Partial<SessionJSON>>({
    pinch_precision: 0,
    finger_individuation: 0,
    RT_gaze_to_grip: 0,
    cognitive_motor_score: 0,
    smile_symmetry_dynamic: 0,
  });
  const samplesCount = useRef<Record<string, number>>({});

  const timerRef = useRef<any>(null);
  const autoChallengeTimerRef = useRef<any>(null);

  // --- Session Control ---

  const startSession = useCallback(() => {
    setPhaseIndex(0);
    setTotalTimeRemaining(60000);
    setFishCaught(0);
    setSessionMetrics(null);
    metricsAcc.current = {};
    samplesCount.current = {};
    resetGame();
  }, [resetGame]);

  const resetSession = useCallback(() => {
    setPhase('IDLE');
    setPhaseIndex(-1);
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoChallengeTimerRef.current) clearInterval(autoChallengeTimerRef.current);
    resetGame();
  }, [resetGame]);

  // --- Phase Logic ---

  useEffect(() => {
    if (phaseIndex < 0) return;

    if (phaseIndex >= SESSION_PHASES.length) {
      setPhase('COMPLETE');
      return;
    }

    const currentConfig = SESSION_PHASES[phaseIndex];
    setPhase(currentConfig.phase);
    setPhaseTimeRemaining(currentConfig.duration);

    // Auto-challenge logic for 'CHALLENGE' phase
    if (currentConfig.phase === 'CHALLENGE') {
      let challengeIdx = 0;
      const triggerNext = () => {
        const cType = currentConfig.challenges[challengeIdx % currentConfig.challenges.length];
        let params: any = { duration: 2000 };
        
        if (cType === 'FINGER_MATH') params = { operation: '2+1', result: 3 };
        if (cType === 'MIRROR_FINGERS') params = { count: Math.floor(Math.random() * 5) + 1 };
        if (cType === 'DUAL_TASK_BASELINE') params = { 
          count: Math.floor(Math.random() * 3) + 2,
          operations: ['2+2', '5-1', '3+0', '1+2']
        };
        if (cType === 'ODD_ONE_OUT') {
          const base = [1, 2, 3, 4, 5][Math.floor(Math.random() * 5)];
          const odd = base + 1;
          params = { numbers: [base, base, base, odd].sort(() => Math.random() - 0.5) };
        }

        startChallenge(cType, params);
        challengeIdx++;
      };
      triggerNext();
      autoChallengeTimerRef.current = setInterval(triggerNext, 5000);
    } else {
      if (autoChallengeTimerRef.current) clearInterval(autoChallengeTimerRef.current);
    }

    return () => {
      if (autoChallengeTimerRef.current) clearInterval(autoChallengeTimerRef.current);
    };
  }, [phaseIndex, startChallenge]);

  // --- Main Tick ---

  useEffect(() => {
    if (phase === 'IDLE' || phase === 'COMPLETE') return;

    timerRef.current = setInterval(() => {
      setPhaseTimeRemaining(prev => {
        if (prev <= 100) {
          setPhaseIndex(idx => idx + 1);
          return 0;
        }
        return prev - 100;
      });
      setTotalTimeRemaining(prev => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [phase]);

  // --- Casting Phase Logic ---

  useEffect(() => {
    if (phase === 'CASTING' && castGestureDetected && !challengeCompleted) {
      const currentConfig = SESSION_PHASES[1]; // CASTING
      const randomType = currentConfig.challenges[Math.floor(Math.random() * currentConfig.challenges.length)];
      const params = randomType === 'SHOW_FINGERS' ? { count: 3 } : {};
      startChallenge(randomType, params);
    }
  }, [phase, castGestureDetected, challengeCompleted, startChallenge]);

  // --- Metrics Aggregation ---

  useEffect(() => {
    if (challengeCompleted) {
      setFishCaught(prev => prev + 1);
      
      // Merge metrics from useChallenge
      Object.entries(metrics).forEach(([key, val]) => {
        if (typeof val === 'number') {
          metricsAcc.current[key] = (metricsAcc.current[key] || 0) + val;
          samplesCount.current[key] = (samplesCount.current[key] || 0) + 1;
        }
      });
    }
  }, [challengeCompleted, metrics]);

  // --- Completion Logic ---

  useEffect(() => {
    if (phase === 'COMPLETE') {
      const finalMetrics: SessionJSON = {
        session_id: Date.now(),
        patient_id: "PATIENT_DEMO_01",
        timestamp: new Date().toISOString(),
        pinch_precision: (metricsAcc.current.pinch_precision || 0) / (samplesCount.current.pinch_precision || 1),
        hand_opening_speed: 85.5, // Placeholder for dynamic calculation
        finger_individuation: (metricsAcc.current.finger_individuation || 0) / (samplesCount.current.finger_individuation || 1),
        facial_symmetry_index_lower: 0.92, // Sampled from baseline
        smile_symmetry_dynamic: (metricsAcc.current.smile_symmetry_dynamic || 0) / (samplesCount.current.smile_symmetry_dynamic || 1),
        fixation_heatmap_asymmetry: 0.15,
        dwell_time_asymmetry: 0.12,
        RT_gaze_to_grip: (metricsAcc.current.RT_gaze_to_grip || 0) / (samplesCount.current.RT_gaze_to_grip || 1),
        cognitive_motor_score: (metricsAcc.current.cognitive_motor_score || 0) / (samplesCount.current.cognitive_motor_score || 1),
        grip_aperture_variability: 4.2,
        fish_caught: fishCaught,
        session_duration_ms: 60000
      };

      setSessionMetrics(finalMetrics);
      localStorage.setItem('steadyarc_session_latest', JSON.stringify(finalMetrics));
      localStorage.setItem('steadyarc_session_' + finalMetrics.session_id, JSON.stringify(finalMetrics));
    }
  }, [phase, fishCaught]);

  return {
    phase,
    phaseTimeRemaining,
    totalTimeRemaining,
    sessionProgress: ((60000 - totalTimeRemaining) / 60000) * 100,
    currentChallenge: null, // Placeholder if needed
    fishCaught,
    sessionMetrics,
    startSession,
    resetSession
  };
};
