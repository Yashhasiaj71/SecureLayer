/**
 * SecurityOverlay.jsx
 * 
 * Protective overlay that covers the document during HIGH risk states,
 * camera failures, or when the detector session has ended.
 * 
 * IMPORTANT: This component does NOT merely visually blur the document.
 * When active, it prevents rendering of the document canvas below it by
 * using pointer-events blocking and an opaque background — the document
 * content is still mounted (to preserve the viewer state) but is completely
 * obscured and non-interactive.
 */

import React from 'react';
import { ShieldX, Eye, Loader2, CameraOff, AlertTriangle } from 'lucide-react';

const OVERLAY_CONFIGS = {
  HIGH: {
    title: 'Potential visual exposure detected',
    subtitle: 'Document viewing has been paused to protect confidential content.',
    color: '#ef4444',
    bg: 'rgba(30, 0, 0, 0.97)',
    icon: ShieldX,
    actions: ['resume'],
  },
  ELEVATED: {
    title: 'Potential risk indicator detected',
    subtitle: 'You may continue viewing. Stay aware of your surroundings.',
    color: '#f59e0b',
    bg: 'rgba(30, 20, 0, 0.85)',
    icon: AlertTriangle,
    actions: ['dismiss'],
  },
  DETECTOR_UNAVAILABLE: {
    title: 'Security monitor unavailable',
    subtitle: 'The camera monitor has become unavailable. Document access is paused.',
    color: '#6366f1',
    bg: 'rgba(5, 0, 30, 0.97)',
    icon: CameraOff,
    actions: ['close'],
  },
};

export default function SecurityOverlay({ riskLevel, reasonCodes = [], onResume, onClose }) {
  const config = OVERLAY_CONFIGS[riskLevel] || OVERLAY_CONFIGS['DETECTOR_UNAVAILABLE'];
  const IconComponent = config.icon;

  const reasonLabels = {
    FACE_ABSENT: 'Primary user undetected',
    MULTIPLE_FACES: 'Additional person in view',
    PHONE_DETECTED: 'Phone/camera object detected',
    DETECTOR_UNHEALTHY: 'Detection system error',
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 99998,
        backgroundColor: config.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        backdropFilter: 'blur(20px)',
        userSelect: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: `1px solid ${config.color}44`,
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '440px',
        width: '100%',
        textAlign: 'center',
        boxShadow: `0 0 60px ${config.color}22`,
      }}>
        <div style={{
          width: '72px', height: '72px',
          backgroundColor: `${config.color}20`,
          border: `2px solid ${config.color}55`,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <IconComponent size={36} color={config.color} />
        </div>

        <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>
          {config.title}
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
          {config.subtitle}
        </p>

        {/* Reason Codes */}
        {reasonCodes.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            {reasonCodes.map((code) => (
              <div key={code} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                backgroundColor: `${config.color}15`,
                border: `1px solid ${config.color}33`,
                borderRadius: '6px',
                padding: '4px 10px',
                margin: '4px',
                fontSize: '12px',
                color: config.color,
              }}>
                {reasonLabels[code] || code}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(config.actions.includes('resume') || config.actions.includes('dismiss')) && onResume && (
            <button
              onClick={onResume}
              className="btn-primary"
              style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Eye size={16} />
              {config.actions.includes('dismiss') ? 'Understood, continue viewing' : 'I am alone — resume viewing'}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="btn-outline"
              style={{ padding: '12px' }}
            >
              Close document
            </button>
          )}
        </div>

        {/* Anti-accusation note */}
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '20px', lineHeight: '1.5' }}>
          These signals are risk indicators only. No assumption of malicious intent is made.
        </p>
      </div>
    </div>
  );
}
