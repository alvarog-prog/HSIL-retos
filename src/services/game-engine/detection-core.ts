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
  
  // Thumb: OR of three independent checks to cover all palm orientations
  // A: 3D wrist distance — captures when thumb extends toward/away from camera (Z axis)
  const d4 = Math.hypot((lm[4].x-lm[0].x)*VW, (lm[4].y-lm[0].y)*VH, ((lm[4].z??0)-(lm[0].z??0))*VW);
  const d2 = Math.hypot((lm[2].x-lm[0].x)*VW, (lm[2].y-lm[0].y)*VH, ((lm[2].z??0)-(lm[0].z??0))*VW);
  const thumbA = d4 > d2;
  // B: index-MCP reference — tip farther from index base than thumb base is (lateral extension)
  const thumbB = gDist(lm[4], lm[5]) > gDist(lm[2], lm[5]);
  // C: lenient 2D wrist — same formula but 15% tolerance for borderline palmar poses
  const thumbC = gDist(lm[4], lm[0]) > gDist(lm[2], lm[0]) * 0.85;
  if (thumbA || thumbB || thumbC) extended++;
  
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
