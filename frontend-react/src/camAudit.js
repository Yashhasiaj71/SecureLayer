/**
 * camAudit.js
 * 
 * Thin client for reporting CamDetection audit events to the backend.
 * The backend validates all inputs and enforces access control independently.
 */

import api from './api';

/**
 * Report a CamDetection lifecycle event to the backend audit log.
 * Fire-and-forget — audit failure must not affect the viewer UX.
 * 
 * @param {Object} params
 * @param {string} params.eventType - One of the VALID_CAM_EVENTS
 * @param {string|null} params.fileId - MongoDB ObjectId of the file being viewed
 * @param {string} params.riskLevel - Current risk level (informational only)
 * @param {string[]} params.reasonCodes - Machine-readable reason codes
 */
export async function reportCamEvent({ eventType, fileId = null, riskLevel = 'LOW', reasonCodes = [] }) {
  try {
    await api.post('/cam/audit', {
      fileId,
      eventType,
      riskLevel,
      // SECURITY: Only send safe, structured metadata — no frames, no biometrics
      reasonCodes: reasonCodes.slice(0, 10),
    });
  } catch (err) {
    // Audit failure is non-fatal — do not disrupt the viewer
    console.warn('[CamAudit] Failed to report event:', eventType, err?.response?.status);
  }
}
