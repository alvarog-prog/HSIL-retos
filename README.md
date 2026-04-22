# SteadyArc: Clinical Biometric Dashboard (v1.2)

Advanced neuro-rehabilitation monitoring system using Computer Vision (MediaPipe) for real-time biomechanical and facial symmetry analysis.

## 🩺 Clinical Metrics (Implemented)

### Hand Biomechanics (M1-M8)
- **Active Pinch (M1/M2)**: Real-time detection and millimeter-accurate distance (Scanned vs 80mm palm ref).
- **Hand Opening % (M3)**: Normalized range of motion for finger extension.
- **Individuation (M4)**: Independent finger extension count (0-5).
- **Movement Analysis (M5/M6)**: 
  - **Palm Speed**: Instantaneous velocity in mm/s.
  - **SPARC Smoothness**: Directional inversion analysis to detect post-stroke fragmentation.
- **Wrist ROM (M7)**: Joint angle monitoring (0-180°).
- **Tremor Index (M8)**: Rest tremor detection (Standard Deviation) during static phases.

### Facial & Neuro-Symmetry (M9-M12)
- **Labial Symmetry (M9)**: Hemispheric ratio between left (LM61) and right (LM291) labial corners relative to facial center.
- **Dynamic Smile (M10)**: Detection of vertical activation vs patient baseline.
- **Eye Telemetry (M11/M12)**: 
  - **Blink Rate**: Involuntary blinks per minute window.
  - **Asymmetry**: EAR (Eye Aspect Ratio) differential for ptosis detection.

### Visual Attention (M13-M14)
- **Hemicampo Asymmetry (M13)**: Detection of visual neglect (Negligencia) using gaze-based distribution analysis.
- **Attention Score (M14)**: ROI-based fixation tracking for task commitment.

## 🚀 Tech Stack
- **Framework**: React + Vite + TypeScript.
- **CV Engine**: MediaPipe Hands & FaceMesh.
- **Styling**: Vanilla CSS (Clinical Black Design System).

## 📊 Calibration
The system uses a 3-second initialization phase to normalize patient-specific baselines (Max span, resting smile, etc.). For precise millimeter measurements, the system assumes a standard adult palm width (5-17 distance) of approximately 80mm.

---
*Professional Tool developed for Clinical Rehabilitation and Neuro-Physiotherapy Monitoring.*
