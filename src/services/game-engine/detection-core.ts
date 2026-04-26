// src/services/game-engine/detection-core.ts

export interface Point {
  x: number;
  y: number;
  z?: number;
}

const VW = 960;
const VH = 540;

export const gDist = (p1: Point, p2: Point) => 
  Math.sqrt(Math.pow((p1.x - p2.x) * VW, 2) + Math.pow((p1.y - p2.y) * VH, 2));

export const detectFingerCount = (lm: Point[]) => {
  if (!lm || lm.length < 21) return 0;
  let extended = 0;
  
  // Fingers (Index to Pinky)
  [8, 12, 16, 20].forEach((tip, i) => {
    const joint = [6, 10, 14, 18][i];
    // If tip is further from wrist than the joint
    if (gDist(lm[tip], lm[0]) > gDist(lm[joint], lm[0])) extended++;
  });
  
  // Thumb (Simplified check against palm base)
  if (gDist(lm[4], lm[5]) > gDist(lm[3], lm[5])) extended++;
  
  return extended;
};

export const detectPinch = (lm: Point[]) => {
  if (!lm || lm.length < 21) return false;
  const hSize = gDist(lm[0], lm[9]);
  const dPinchPx = gDist(lm[4], lm[8]);
  return (dPinchPx / hSize) < 0.15;
};

export const detectFist = (lm: Point[]) => {
  if (!lm || lm.length < 21) return false;
  return detectFingerCount(lm) === 0;
};

export const detectSmile = (flm: Point[]) => {
  if (!flm || flm.length < 468) return false;
  const dSmile = Math.abs(flm[61].x - flm[291].x);
  const dFace = Math.abs(flm[234].x - flm[454].x);
  // Threshold adjusted for common clinical smile detection
  return (dSmile / dFace) > 0.42; 
};

export const detectOpenHand = (lm: Point[]) => {
  if (!lm || lm.length < 21) return false;
  const fingers = detectFingerCount(lm);
  
  // Apertura: Distancia media de puntas al centro de la palma (LM 9)
  const palmSize = gDist(lm[0], lm[9]);
  const tips = [4, 8, 12, 16, 20];
  const avgTipDist = tips.reduce((sum, idx) => sum + gDist(lm[idx], lm[9]), 0) / 5;
  
  // Normalización simplificada: 2.1x el tamaño de la palma se considera 100%
  const aperture = (avgTipDist / (palmSize * 2.1)) * 100;
  
  return fingers >= 4 && aperture > 50;
};
