/**
 * SecureFileViewer.jsx
 * 
 * Full-screen secure file viewer with CamDetection integration.
 * 
 * Flow:
 * - NORMAL/CONFIDENTIAL files: direct PDF/image render with watermark
 * - HIGHLY_CONFIDENTIAL files:
 *   1. Show CamConsentDialog
 *   2. On consent → call startCam() → MediaPipe + COCO-SSD init
 *   3. On successful init → show document with WatermarkOverlay + CamStatusBadge
 *   4. Risk engine drives SecurityOverlay:
 *      - LOW: transparent — document fully visible
 *      - ELEVATED: warning strip (non-blocking)
 *      - HIGH: opaque SecurityOverlay covers document
 *      - DETECTOR_UNAVAILABLE: opaque SecurityOverlay, cannot resume
 *   5. On close → stopCam() → all tracks released
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Lock, X, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useAuth } from './AuthContext';
import { useCamDetection } from './useCamDetection';
import { reportCamEvent } from './camAudit';
import CamConsentDialog from './CamConsentDialog';
import SecurityOverlay from './SecurityOverlay';
import CamStatusBadge from './CamStatusBadge';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Watermark ─────────────────────────────────────────────────────────────────
function WatermarkOverlay({ email }) {
  const timestamp = useRef(new Date().toLocaleString()).current;
  const text = `${email} \u2022 ${timestamp}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="260">
    <text x="50%" y="50%" transform="rotate(-30 180 130)" text-anchor="middle"
      fill="rgba(255,255,255,0.38)" stroke="rgba(0,0,0,0.28)" stroke-width="1"
      font-size="14" font-family="sans-serif" font-weight="bold">${text}</text>
    <text x="50%" y="62%" transform="rotate(-30 180 130)" text-anchor="middle"
      fill="rgba(255,255,255,0.28)" stroke="rgba(0,0,0,0.2)" stroke-width="1"
      font-size="10" font-family="sans-serif">SECURELAYER CONFIDENTIAL</text>
  </svg>`;
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: `url("${dataUrl}")`,
      backgroundRepeat: 'repeat', zIndex: 100000,
    }} />
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SecureFileViewer({ fileId, filename, mimeType, confidentialityLevel, blobUrl, onClose }) {
  const { user } = useAuth();
  const isHighlyConfidential = confidentialityLevel === 'HIGHLY_CONFIDENTIAL';

  const { camStatus, riskAssessment, videoRef, startCam, stopCam, diagnostics } = useCamDetection(fileId);

  // Viewer phase for HIGHLY_CONFIDENTIAL: 'consent' | 'viewing'
  const [phase, setPhase] = useState(isHighlyConfidential ? 'consent' : 'viewing');
  const [numPages, setNumPages] = useState(null);
  const [elevatedDismissed, setElevatedDismissed] = useState(false);

  const riskLevel = riskAssessment.riskLevel;
  const showOverlay = isHighlyConfidential && (
    riskLevel === 'HIGH' ||
    riskLevel === 'DETECTOR_UNAVAILABLE' ||
    camStatus === 'ERROR' ||
    camStatus === 'UNAVAILABLE'
  );
  const showElevatedWarning = isHighlyConfidential && riskLevel === 'ELEVATED' && !elevatedDismissed;

  // ─── Keyboard blocker ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 'P', 's', 'S'].includes(e.key)) {
        e.preventDefault();
        alert('SECURITY: Saving and printing are disabled for this file.');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── Cleanup camera on close ────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (isHighlyConfidential && camStatus === 'RUNNING') {
      reportCamEvent({
        eventType: 'CAMDETECTION_SESSION_ENDED',
        fileId,
        riskLevel: riskAssessment.riskLevel,
        reasonCodes: riskAssessment.reasonCodes,
      });
      stopCam();
    }
    onClose();
  }, [isHighlyConfidential, camStatus, fileId, riskAssessment, stopCam, onClose]);

  // ─── Consent granted: start camera ─────────────────────────────────────────
  const handleConsent = useCallback(async () => {
    await startCam();
    // Phase transitions to 'viewing' once camStatus becomes 'RUNNING'
  }, [startCam]);

  // Watch camStatus → transition to viewing phase once running
  useEffect(() => {
    if (camStatus === 'RUNNING' && phase === 'consent') {
      setPhase('viewing');
    }
  }, [camStatus, phase]);

  // ─── Resume from HIGH risk ──────────────────────────────────────────────────
  const handleResume = useCallback(() => {
    reportCamEvent({
      eventType: 'CAMDETECTION_RESUMED',
      fileId,
      riskLevel: riskAssessment.riskLevel,
      reasonCodes: [],
    });
    setElevatedDismissed(false);
  }, [fileId, riskAssessment.riskLevel]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Consent dialog phase (HIGHLY_CONFIDENTIAL only)
  if (phase === 'consent') {
    return (
      <CamConsentDialog
        filename={filename}
        camStatus={camStatus}
        onConsent={handleConsent}
        onCancel={onClose}
      />
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.96)',
        display: 'flex', flexDirection: 'column',
        backdropFilter: 'blur(10px)',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 24px',
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #1e293b',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Lock size={16} color="#10b981" />
          <span style={{ color: '#f1f5f9', fontWeight: '600', fontSize: '14px' }}>
            Secure Abstract Viewer
            {confidentialityLevel && (
              <span style={{
                marginLeft: '10px', fontSize: '11px', fontWeight: '600',
                padding: '3px 8px', borderRadius: '999px',
                backgroundColor: isHighlyConfidential ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                color: isHighlyConfidential ? '#f87171' : '#fbbf24',
                border: `1px solid ${isHighlyConfidential ? '#f87171' : '#fbbf24'}44`,
              }}>
                {confidentialityLevel.replace('_', ' ')}
              </span>
            )}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isHighlyConfidential && camStatus === 'RUNNING' && (
            <CamStatusBadge riskAssessment={riskAssessment} diagnostics={diagnostics} />
          )}
          <button onClick={handleClose} style={{
            background: 'none', border: 'none', color: '#f87171',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
          }}>
            <X size={18} /> Close
          </button>
        </div>
      </div>

      {/* Elevated warning strip (non-blocking) */}
      {showElevatedWarning && (
        <div style={{
          backgroundColor: 'rgba(245,158,11,0.15)',
          borderBottom: '1px solid rgba(245,158,11,0.3)',
          padding: '10px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: '#fbbf24', fontSize: '13px', fontWeight: '600' }}>
            ⚠ Potential risk indicator detected — stay aware of your surroundings.
          </span>
          <button onClick={() => setElevatedDismissed(true)} style={{
            background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: '12px',
          }}>
            Understood
          </button>
        </div>
      )}

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Hidden camera feed (required by MediaPipe) */}
        {isHighlyConfidential && (
          <video ref={videoRef} style={{ position: 'absolute', opacity: 0.001, top: 0, left: 0, width: '640px', height: '480px', pointerEvents: 'none', zIndex: -100 }}
            playsInline muted />
        )}

        {/* Security Overlay (HIGH / DETECTOR_UNAVAILABLE) */}
        {showOverlay && (
          <SecurityOverlay
            riskLevel={riskLevel === 'HIGH' ? 'HIGH' : 'DETECTOR_UNAVAILABLE'}
            reasonCodes={riskAssessment.reasonCodes}
            onResume={riskLevel === 'HIGH' ? handleResume : null}
            onClose={handleClose}
          />
        )}

        {/* Watermark */}
        <WatermarkOverlay email={user?.email} />

        {/* Document Renderer */}
        <div style={{
          width: '100%', height: '100%',
          overflow: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '24px',
        }}>
          {mimeType?.startsWith('image/') ? (
            <img
              src={blobUrl}
              alt="Secure document"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }}
            />
          ) : (
            <Document
              file={blobUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<Loader2 size={32} color="#10b981" className="animate-spin" />}
              error={<div style={{ color: '#ef4444' }}>Failed to render document securely.</div>}
            >
              {Array.from({ length: numPages || 0 }, (_, i) => (
                <div key={i + 1} style={{ marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  <Page
                    pageNumber={i + 1}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    width={Math.min(window.innerWidth - 80, 1000)}
                  />
                </div>
              ))}
            </Document>
          )}
        </div>

        {/* DEV DEBUG PANEL */}
        {import.meta.env.DEV && isHighlyConfidential && camStatus === 'RUNNING' && (
          <div style={{
            position: 'absolute', bottom: '20px', right: '20px', zIndex: 100000,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', color: '#10b981', border: '1px solid #10b981',
            padding: '12px 16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '11px',
            pointerEvents: 'none', width: '260px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', fontSize: '12px' }}>
              CamDetection Debug
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Risk Score:</span>
              <span style={{ color: riskAssessment.riskScore > 0 ? '#fbbf24' : '#10b981', fontWeight: 'bold' }}>
                {riskAssessment.riskScore} / 100
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Risk Level:</span>
              <span>{riskAssessment.riskLevel}</span>
            </div>
            
            <div style={{ marginTop: '8px', marginBottom: '4px', color: '#cbd5e1' }}>
              Active Triggers:
            </div>
            <div style={{ color: '#ef4444', marginBottom: '8px', minHeight: '14px' }}>
              {riskAssessment.reasonCodes.length > 0 ? riskAssessment.reasonCodes.join(', ') : <span style={{ color: '#64748b' }}>None</span>}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Face Model:</span>
                <span>{diagnostics.faceLatencyMs ? `${diagnostics.faceLatencyMs}ms` : 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Object Model:</span>
                <span>{diagnostics.objLatencyMs ? `${diagnostics.objLatencyMs}ms` : 'N/A'}</span>
              </div>
              {diagnostics.lastClasses && diagnostics.lastClasses.length > 0 && (
                <div style={{ color: '#8b5cf6', marginTop: '4px', fontSize: '10px', wordWrap: 'break-word' }}>
                  Seeing: {diagnostics.lastClasses.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer warning */}
      <div style={{
        padding: '10px', textAlign: 'center',
        color: '#ef4444', fontSize: '11px',
        backgroundColor: '#0f172a',
        borderTop: '1px solid #1e293b',
        flexShrink: 0,
      }}>
        One-time viewing session active • Do not screenshot or photograph this screen
      </div>
    </div>
  );
}
