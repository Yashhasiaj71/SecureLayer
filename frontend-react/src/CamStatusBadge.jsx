/**
 * CamStatusBadge.jsx
 * 
 * A small, ambient status indicator shown in the secure viewer header
 * when CamDetection is active. Shows current risk level and detector health.
 */

import React from 'react';
import { Camera, AlertTriangle, ShieldCheck, ShieldX } from 'lucide-react';

const LEVEL_CONFIG = {
  LOW: { color: '#10b981', label: 'Monitoring: Secure', icon: ShieldCheck },
  ELEVATED: { color: '#f59e0b', label: 'Elevated Risk Detected', icon: AlertTriangle },
  HIGH: { color: '#ef4444', label: 'High Risk — Paused', icon: ShieldX },
  DETECTOR_UNAVAILABLE: { color: '#6366f1', label: 'Monitor Unavailable', icon: ShieldX },
};

export default function CamStatusBadge({ riskAssessment, diagnostics }) {
  const level = riskAssessment?.riskLevel || 'LOW';
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG['LOW'];
  const Icon = cfg.icon;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      backgroundColor: `${cfg.color}15`,
      border: `1px solid ${cfg.color}44`,
      borderRadius: '999px',
      fontSize: '12px',
      color: cfg.color,
      fontWeight: '600',
    }}>
      <Icon size={13} />
      <span>{cfg.label}</span>
      {diagnostics?.faceLatencyMs && (
        <span style={{ color: `${cfg.color}99`, fontWeight: '400', fontSize: '11px' }}>
          ({diagnostics.faceLatencyMs}ms)
        </span>
      )}
    </div>
  );
}
