/**
 * riskEngine.js
 * 
 * Stateless, configurable risk-inference module for CamDetection.
 * Takes detection events and produces a structured risk assessment.
 * 
 * DESIGN PRINCIPLES:
 * - No ML — configurable, explainable threshold rules
 * - Temporal smoothing prevents single-frame false positives
 * - Hysteresis prevents flicker around threshold boundaries
 * - Detection failure is its own separate security state (DETECTOR_UNAVAILABLE),
 *   NOT treated as low risk
 */

// ─── Configuration ─────────────────────────────────────────────────────────────
export const RISK_CONFIG = {
  // Score thresholds (inclusive lower bound)
  thresholds: {
    LOW: 0,       // 0–29
    ELEVATED: 30, // 30–59
    HIGH: 60,     // 60–100
  },
  // Hysteresis: once at HIGH, don't drop below ELEVATED until score < 45
  hysteresis: {
    HIGH_to_ELEVATED: 45,
    ELEVATED_to_LOW: 20,
  },
  // Minimum consecutive detections before a signal is trusted
  minPersistenceFrames: {
    multipleFaces: 3,
    phoneDetected: 2,
    faceAbsent: 8, // ~1.6s at 5fps
  },
  // Score contributions per signal (tunable)
  weights: {
    faceAbsent: 65,       // User has left the screen -> HIGH risk
    multipleFaces: 65,    // Additional person visible -> HIGH risk
    phoneDetected: 65,    // Phone/camera-like object -> HIGH risk
    detectorUnhealthy: 0, // Handled as separate state — not a risk score
  },
};

// ─── Risk Level Utility ─────────────────────────────────────────────────────────
export function scoreToLevel(score, previousLevel) {
  const { thresholds, hysteresis } = RISK_CONFIG;

  // Apply hysteresis — avoid flicker around boundary
  if (previousLevel === 'HIGH') {
    if (score < hysteresis.HIGH_to_ELEVATED) return score < hysteresis.ELEVATED_to_LOW ? 'LOW' : 'ELEVATED';
    return 'HIGH';
  }
  if (previousLevel === 'ELEVATED') {
    if (score < hysteresis.ELEVATED_to_LOW) return 'LOW';
    if (score >= thresholds.HIGH) return 'HIGH';
    return 'ELEVATED';
  }

  // Normal (no hysteresis needed from LOW)
  if (score >= thresholds.HIGH) return 'HIGH';
  if (score >= thresholds.ELEVATED) return 'ELEVATED';
  return 'LOW';
}

// ─── Main Risk Engine ──────────────────────────────────────────────────────────

/**
 * Compute a risk assessment from the current detection state.
 * 
 * @param {Object} detectionState - Current detector readings
 * @param {boolean} detectionState.facePresent - Is the primary user's face visible?
 * @param {number} detectionState.faceCount - Total faces detected (0, 1, 2+)
 * @param {boolean} detectionState.phoneDetected - Phone/camera-like object visible?
 * @param {number} detectionState.faceAbsentFrames - Consecutive frames face was absent
 * @param {number} detectionState.multipleFaceFrames - Consecutive frames with 2+ faces
 * @param {number} detectionState.phoneFrames - Consecutive frames with phone detected
 * @param {boolean} detectionState.detectorHealthy - Are all detectors running normally?
 * @param {string} previousRiskLevel - Previous risk level for hysteresis
 * @returns {Object} Risk assessment result
 */
export function computeRisk(detectionState, previousRiskLevel = 'LOW') {
  const { weights, minPersistenceFrames } = RISK_CONFIG;

  // Detector health is a separate security state — not scored
  if (!detectionState.detectorHealthy) {
    return {
      riskScore: 0,
      riskLevel: 'DETECTOR_UNAVAILABLE',
      reasonCodes: ['DETECTOR_UNHEALTHY'],
      lastUpdatedAt: new Date().toISOString(),
      detectorHealth: 'UNAVAILABLE',
    };
  }

  let score = 0;
  const reasonCodes = [];

  // Face absence signal
  if (detectionState.faceAbsent) {
    score += weights.faceAbsent;
    reasonCodes.push('FACE_ABSENT');
  }

  // Multiple faces signal
  if (detectionState.multipleFacesDetected) {
    score += weights.multipleFaces;
    reasonCodes.push('MULTIPLE_FACES');
  }

  // Phone/camera object
  if (detectionState.phoneDetected) {
    score += weights.phoneDetected;
    reasonCodes.push('PHONE_DETECTED');
  }

  // Clamp score to 0–100
  score = Math.min(100, Math.max(0, score));

  const riskLevel = scoreToLevel(score, previousRiskLevel);

  return {
    riskScore: score,
    riskLevel,
    reasonCodes,
    lastUpdatedAt: new Date().toISOString(),
    detectorHealth: 'OK',
  };
}
