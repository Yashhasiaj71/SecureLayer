/**
 * CamConsentDialog.jsx
 * 
 * Explains CamDetection to the user and requests explicit consent
 * before any camera access is attempted.
 * 
 * Only shown for HIGHLY_CONFIDENTIAL files.
 * No camera is initialized until "Enable camera and continue" is clicked.
 */

import React from 'react';
import { ShieldAlert, Camera, X, AlertTriangle, Eye, Users, Smartphone, ShieldCheck } from 'lucide-react';

export default function CamConsentDialog({ filename, onConsent, onCancel, camStatus, camError }) {
  const isRequesting = camStatus === 'REQUESTING_PERMISSION' || camStatus === 'INITIALIZING';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      backgroundColor: 'rgba(2, 6, 23, 0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      backdropFilter: 'blur(12px)',
      fontFamily: "'Inter', sans-serif",
    }}>
      <style>{`
        @keyframes dialogIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulseAlert {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .dialog-container {
          animation: dialogIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          background: linear-gradient(145deg, rgba(30,41,59,0.95), rgba(15,23,42,0.98));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 40px rgba(239, 68, 68, 0.1);
        }
        .icon-pulse {
          animation: pulseAlert 2s infinite;
        }
        .action-btn-primary {
          background: linear-gradient(135deg, #10b981, #059669);
          border: none;
          color: white;
          transition: all 0.3s ease;
        }
        .action-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -6px rgba(16,185,129,0.6);
        }
        .action-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }
        .action-btn-primary:disabled {
          background: #334155;
          color: #94a3b8;
          cursor: not-allowed;
        }
        .action-btn-secondary {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: #cbd5e1;
          transition: all 0.3s ease;
        }
        .action-btn-secondary:hover:not(:disabled) {
          background: rgba(255,255,255,0.05);
          color: white;
        }
      `}</style>
      
      <div className="dialog-container" style={{
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '520px',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle top glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
          background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
          opacity: 0.8
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '30px' }}>
          <div className="icon-pulse" style={{
            padding: '14px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))',
            borderRadius: '16px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            flexShrink: 0,
          }}>
            <ShieldAlert size={32} color="#f87171" />
          </div>
          <div style={{ paddingTop: '2px' }}>
            <h2 style={{ color: '#ffffff', fontSize: '24px', fontWeight: '800', marginBottom: '6px', letterSpacing: '-0.5px' }}>
              Restricted Document
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5' }}>
              <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{filename}</span> is marked as Highly Confidential.
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '14px',
          padding: '24px',
          marginBottom: '32px',
        }}>
          <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px 0' }}>
            To view this document, you must enable <strong>CamDetection</strong>. SecureLayer will use your camera to monitor for visual-exposure risks locally.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Users size={16} color="#60a5fa" />
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Detects additional people in frame</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Smartphone size={16} color="#60a5fa" />
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Detects phones or cameras</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Eye size={16} color="#60a5fa" />
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Detects prolonged absence from screen</span>
            </div>
          </div>
        </div>

        {/* Privacy Note */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', alignItems: 'flex-start', padding: '0 8px' }}>
          <ShieldCheck size={20} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <p style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: '600', margin: '0 0 4px 0' }}>
              100% Private & Local
            </p>
            <p style={{ color: '#64748b', fontSize: '12px', lineHeight: '1.5', margin: 0 }}>
              Frames are analyzed on-device. No video is ever recorded, stored, or sent to any server.
            </p>
          </div>
        </div>

        {/* Error state */}
        {(camStatus === 'PERMISSION_DENIED' || camStatus === 'UNAVAILABLE' || camStatus === 'ERROR') && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '24px',
            display: 'flex', gap: '10px', alignItems: 'flex-start'
          }}>
            <AlertTriangle size={18} color="#f87171" style={{ flexShrink: 0 }} />
            <p style={{ color: '#f87171', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
              {camStatus === 'PERMISSION_DENIED'
                ? 'Camera permission was denied. Please allow access in your browser settings.'
                : camStatus === 'UNAVAILABLE'
                ? 'No camera found. A camera is required for this document.'
                : 'CamDetection failed to initialize. Please try again.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
          <button
            onClick={onConsent}
            disabled={isRequesting}
            className="action-btn-primary"
            style={{ 
              width: '100%', padding: '16px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              fontWeight: '600', fontSize: '15px', cursor: isRequesting ? 'not-allowed' : 'pointer'
            }}
          >
            <Camera size={18} />
            {isRequesting
              ? (camStatus === 'REQUESTING_PERMISSION' ? 'Requesting Camera...' : 'Starting Detectors...')
              : (camStatus === 'PERMISSION_DENIED' || camStatus === 'ERROR' || camStatus === 'UNAVAILABLE')
              ? 'Retry Camera Access'
              : 'Enable Camera & Continue'}
          </button>
          <button
            onClick={onCancel}
            disabled={isRequesting}
            className="action-btn-secondary"
            style={{ 
              width: '100%', padding: '14px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              fontWeight: '500', fontSize: '14px', cursor: isRequesting ? 'not-allowed' : 'pointer'
            }}
          >
            <X size={18} /> Cancel and Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
