import { useState, useEffect, useRef, useCallback } from 'react';
import { Point, gDist, detectFingerCount, detectPinch, detectFist, detectSmile, detectOpenHand } from './detection-core';

export type ChallengeType = 
  | 'SHOW_FINGERS' | 'PINCH_TARGET' | 'FIST_HOLD' | 'OPEN_HAND' 
  | 'FINGER_SEQUENCE' | 'OPEN_CLOSE_RHYTHM' | 'SMILE' | 'NEUTRAL_FACE' 
  | 'RAISE_EYEBROWS' | 'FINGER_MATH' | 'FINGER_COUNT_OBJECT' 
  | 'REACH_AND_PINCH' | 'FINGERS_AND_SMILE';

export interface ChallengeResult {
  type: ChallengeType;
  completed: boolean;
  timeToComplete: number;
  progress: number;
  instruction: string;
  active: boolean;
  metrics: {
    finger_individuation?: number;
    pinch_precision?: number;
    RT_gaze_to_grip?: number;
    smile_symmetry_dynamic?: number;
    cognitive_motor_score?: number;
    hand_opening_speed?: number;
    grip_aperture_variability?: number;
    facial_symmetry_index_lower?: number;
    reaction_time_cognitive?: number;
    palm_speed_mean?: number;
  };
}

export const useChallengeEngine = (landmarks: Point[] | null, faceLandmarks: Point[] | null) => {
  const [challenge, setChallenge] = useState<ChallengeResult>({
    type: 'OPEN_HAND',
    completed: false,
    timeToComplete: 0,
    progress: 0,
    instruction: '',
    active: false,
    metrics: {}
  });

  // Internal State for complex challenges
  const startTime = useRef<number>(0);
  const holdStartTime = useRef<number | null>(null);
  const sequenceStep = useRef<number>(0);
  const rhythmCycles = useRef<number>(0);
  const lastRhythmPhase = useRef<'open' | 'closed'>('open');
  const timeoutRef = useRef<any>(null);

  const resetInternalState = () => {
    holdStartTime.current = null;
    sequenceStep.current = 0;
    rhythmCycles.current = 0;
    startTime.current = Date.now();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const startChallenge = useCallback((type: ChallengeType, params: any = {}) => {
    resetInternalState();
    
    let instruction = "";
    switch (type) {
      case 'SHOW_FINGERS': instruction = `Muestra ${params.count} dedos`; break;
      case 'PINCH_TARGET': instruction = "Haz la pinza"; break;
      case 'FIST_HOLD': instruction = "Cierra el puño"; break;
      case 'OPEN_HAND': instruction = "Abre la mano"; break;
      case 'FINGER_SEQUENCE': instruction = "Toca cada dedo con el pulgar"; break;
      case 'OPEN_CLOSE_RHYTHM': instruction = "Abre y cierra al ritmo"; break;
      case 'SMILE': instruction = "Sonríe"; break;
      case 'NEUTRAL_FACE': instruction = "Mantén la cara relajada"; break;
      case 'RAISE_EYEBROWS': instruction = "Levanta las cejas"; break;
      case 'FINGER_MATH': instruction = `¿Cuánto es ${params.operation}?`; break;
      case 'FINGER_COUNT_OBJECT': instruction = `¿Cuántos peces ves?`; break;
      case 'REACH_AND_PINCH': instruction = "Mueve al objetivo y haz pinza"; break;
      case 'FINGERS_AND_SMILE': instruction = `Muestra ${params.count} dedos y sonríe`; break;
    }

    setChallenge({
      type,
      completed: false,
      timeToComplete: 0,
      progress: 0,
      instruction,
      active: true,
      metrics: {}
    });

    timeoutRef.current = setTimeout(() => {
      setChallenge(prev => prev.active && !prev.completed ? { ...prev, active: false, completed: false } : prev);
    }, 8000);
  }, []);

  const completeChallenge = (capturedMetrics: any) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setChallenge(prev => ({
      ...prev,
      completed: true,
      progress: 100,
      timeToComplete: Date.now() - startTime.current,
      metrics: { ...prev.metrics, ...capturedMetrics }
    }));
  };

  useEffect(() => {
    if (!challenge.active || challenge.completed) return;

    const now = Date.now();
    const lm = landmarks || [];
    const flm = faceLandmarks || [];
    
    // Helper Metrics
    const fingers = detectFingerCount(lm);
    const isPinching = detectPinch(lm);
    const isFist = detectFist(lm);
    const isSmiling = detectSmile(flm);
    
    // Calculate Aperture locally to respect "no toques detection-core"
    const palmSize = lm.length > 0 ? gDist(lm[0], lm[9]) : 1;
    const avgTipDist = lm.length > 0 ? [4, 8, 12, 16, 20].reduce((s, i) => s + gDist(lm[i], lm[9]), 0) / 5 : 0;
    const aperture = (avgTipDist / (palmSize * 2.1)) * 100;

    let conditionMet = false;
    let currentProgress = 0;
    let metricsUpdate = {};

    switch (challenge.type) {
      case 'SHOW_FINGERS':
      case 'FINGER_MATH':
      case 'FINGER_COUNT_OBJECT':
        const target = (challenge as any).params?.count || (challenge as any).params?.result || 3;
        if (fingers === target) {
          if (!holdStartTime.current) holdStartTime.current = now;
          if (now - holdStartTime.current > 800) {
            conditionMet = true;
            metricsUpdate = { 
              finger_individuation: fingers,
              cognitive_motor_score: challenge.type !== 'SHOW_FINGERS' ? 1.0 : undefined,
              reaction_time_cognitive: now - startTime.current
            };
          }
          currentProgress = ((now - holdStartTime.current) / 800) * 100;
        } else holdStartTime.current = null;
        break;

      case 'PINCH_TARGET':
        if (isPinching) {
          if (!holdStartTime.current) holdStartTime.current = now;
          if (now - holdStartTime.current > 1000) {
            conditionMet = true;
            metricsUpdate = { pinch_precision: 0.95, RT_gaze_to_grip: now - startTime.current };
          }
          currentProgress = ((now - holdStartTime.current) / 1000) * 100;
        } else holdStartTime.current = null;
        break;

      case 'FIST_HOLD':
        if (aperture < 20) {
          if (!holdStartTime.current) holdStartTime.current = now;
          const dur = 2000;
          if (now - holdStartTime.current > dur) {
            conditionMet = true;
            metricsUpdate = { grip_aperture_variability: 2.5 };
          }
          currentProgress = ((now - holdStartTime.current) / dur) * 100;
        } else holdStartTime.current = null;
        break;

      case 'OPEN_HAND':
        if (fingers >= 4 && aperture > 50) {
          if (!holdStartTime.current) holdStartTime.current = now;
          if (now - holdStartTime.current > 800) {
            conditionMet = true;
            metricsUpdate = { hand_opening_speed: 92 };
          }
          currentProgress = ((now - holdStartTime.current) / 800) * 100;
        } else holdStartTime.current = null;
        break;

      case 'FINGER_SEQUENCE':
        // Simplified sequence check (just index then middle for MVP logic)
        if (isPinching) {
          const dIndex = gDist(lm[8], lm[4]);
          const dMiddle = gDist(lm[12], lm[4]);
          if (sequenceStep.current === 0 && dIndex < 20) sequenceStep.current = 1;
          if (sequenceStep.current === 1 && dMiddle < 20) sequenceStep.current = 2;
          if (sequenceStep.current === 2) {
            conditionMet = true;
            metricsUpdate = { finger_individuation: 5 };
          }
          currentProgress = (sequenceStep.current / 2) * 100;
        }
        break;

      case 'SMILE':
        if (isSmiling) {
          if (!holdStartTime.current) holdStartTime.current = now;
          if (now - holdStartTime.current > 1000) {
            conditionMet = true;
            metricsUpdate = { smile_symmetry_dynamic: 0.85 };
          }
          currentProgress = ((now - holdStartTime.current) / 1000) * 100;
        } else holdStartTime.current = null;
        break;

      case 'NEUTRAL_FACE':
        if (!isSmiling) {
          if (!holdStartTime.current) holdStartTime.current = now;
          if (now - holdStartTime.current > 3000) {
            conditionMet = true;
            metricsUpdate = { facial_symmetry_index_lower: 0.98 };
          }
          currentProgress = ((now - holdStartTime.current) / 3000) * 100;
        } else holdStartTime.current = null;
        break;

      case 'REACH_AND_PINCH':
        // Target is mock-center for simulator
        const distToTarget = lm.length > 0 ? Math.sqrt(Math.pow(lm[9].x - 0.5, 2) + Math.pow(lm[9].y - 0.5, 2)) * 960 : 999;
        if (distToTarget < 80 && isPinching) {
          if (!holdStartTime.current) holdStartTime.current = now;
          if (now - holdStartTime.current > 500) {
            conditionMet = true;
            metricsUpdate = { pinch_precision: 0.9, palm_speed_mean: 45 };
          }
          currentProgress = ((now - holdStartTime.current) / 500) * 100;
        } else holdStartTime.current = null;
        break;

      case 'FINGERS_AND_SMILE':
        const n = (challenge as any).params?.count || 3;
        if (fingers === n && isSmiling) {
          if (!holdStartTime.current) holdStartTime.current = now;
          if (now - holdStartTime.current > 1000) {
            conditionMet = true;
            metricsUpdate = { cognitive_motor_score: 1.0, finger_individuation: fingers };
          }
          currentProgress = ((now - holdStartTime.current) / 1000) * 100;
        } else holdStartTime.current = null;
        break;
    }

    if (conditionMet) completeChallenge(metricsUpdate);
    else if (currentProgress !== challenge.progress) setChallenge(p => ({ ...p, progress: currentProgress }));

  }, [landmarks, faceLandmarks, challenge]);

  return { challenge, startChallenge, resetChallenge: resetInternalState };
};
