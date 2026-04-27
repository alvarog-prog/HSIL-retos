import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  detectFingerCount, 
  detectPinch, 
  Point,
  gDist,
  detectOpenHand
} from './detection-core';
import { useChallengeEngine, ChallengeType } from './useChallenge';

// --- Types ---

interface GameContextType {
  landmarks: Point[] | null;
  faceLandmarks: Point[] | null;
  castGestureDetected: boolean;
  challengeReady: boolean;
  challengeCompleted: boolean;
  challengeProgress: number;
  challengeInstruction: string;
  challengeParams: any;
  challengeMetrics: Record<string, any>;
  startChallenge: (type: ChallengeType, params?: any) => void;
  resetGame: () => void;
}

const GameEngineContext = createContext<GameContextType | undefined>(undefined);

// --- Provider ---

export const GameEngineProvider: React.FC<{ children: React.ReactNode, results: any }> = ({ children, results }) => {
  const [landmarks, setLandmarks] = useState<Point[] | null>(null);
  const [faceLandmarks, setFaceLandmarks] = useState<Point[] | null>(null);
  const [castGestureDetected, setCastGestureDetected] = useState(false);
  
  // Use the new decoupled challenge engine
  const { challenge, startChallenge, resetChallenge } = useChallengeEngine(landmarks, faceLandmarks);

  // Sync with MediaPipe
  useEffect(() => {
    if (results?.multiHandLandmarks?.[0]) setLandmarks(results.multiHandLandmarks[0]);
    else setLandmarks(null);
    
    if (results?.latestFaceResults?.multiFaceLandmarks?.[0]) setFaceLandmarks(results.latestFaceResults.multiFaceLandmarks[0]);
    else setFaceLandmarks(null);
  }, [results]);

  // Launch Gesture Logic with Confirmation Timer (600ms)
  const launchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (landmarks && detectOpenHand(landmarks) && !challenge.active) {
      if (!launchTimerRef.current) launchTimerRef.current = Date.now();
      
      const elapsed = Date.now() - launchTimerRef.current;
      if (elapsed > 600) {
        setCastGestureDetected(true);
      }
    } else {
      setCastGestureDetected(false);
      launchTimerRef.current = null;
    }
  }, [landmarks, challenge.active]);

  const resetGame = () => {
    setCastGestureDetected(false);
    resetChallenge();
  };

  return (
    <GameEngineContext.Provider value={{
      landmarks,
      faceLandmarks,
      castGestureDetected,
      challengeReady: challenge.active && !challenge.completed,
      challengeCompleted: challenge.completed,
      challengeProgress: challenge.progress,
      challengeInstruction: challenge.instruction,
      challengeParams: challenge.params,
      challengeMetrics: challenge.metrics,
      startChallenge,
      resetGame
    }}>
      {children}
    </GameEngineContext.Provider>
  );
};

// --- Hooks for Luis ---

export const useGestureLaunch = () => {
  const context = useContext(GameEngineContext);
  if (!context) throw new Error('useGestureLaunch must be used within GameEngineProvider');
  return { castGestureDetected: context.castGestureDetected };
};

export const useChallenge = () => {
  const context = useContext(GameEngineContext);
  if (!context) throw new Error('useChallenge must be used within GameEngineProvider');
  
  return {
    challengeReady: context.challengeReady,
    challengeCompleted: context.challengeCompleted,
    progress: context.challengeProgress,
    instruction: context.challengeInstruction,
    params: context.challengeParams,
    metrics: context.challengeMetrics,
    startChallenge: context.startChallenge,
    resetGame: context.resetGame
  };
};

export const useDetectionMetrics = () => {
  const context = useContext(GameEngineContext);
  if (!context) throw new Error('useDetectionMetrics must be used within GameEngineProvider');
  return {
    fingerCount: detectFingerCount(context.landmarks || []),
    isPinching: detectPinch(context.landmarks || [])
  };
};
