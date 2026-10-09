import React, { useState, useEffect } from 'react';
import { FileText, Lock, Unlock, Clock, AlertCircle, Loader2, Eye, X, RefreshCw } from 'lucide-react';
import { useAuth } from './AuthContext';
import api from './api';

// --- react-pdf integration for secure canvas rendering ---
import { Document, Page, pdfjs } from 'react-pdf';
// Set up the PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const WatermarkOverlay = ({ email }) => {
  const [timestamp] = useState(() => new Date().toLocaleString());
  const watermarkText = `${email} • ${timestamp}`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="350" height="250">
      <text x="50%" y="50%" transform="rotate(-30 175 125)" text-anchor="middle" fill="rgba(255, 255, 255, 0.4)" stroke="rgba(0, 0, 0, 0.3)" stroke-width="1" font-size="15" font-family="sans-serif" font-weight="bold">
        ${watermarkText}
      </text>
      <text x="50%" y="60%" transform="rotate(-30 175 125)" text-anchor="middle" fill="rgba(255, 255, 255, 0.3)" stroke="rgba(0, 0, 0, 0.2)" stroke-width="1" font-size="11" font-family="sans-serif" font-weight="bold">
        SECURELAYER CONFIDENTIAL
      </text>
    </svg>
  `;
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      backgroundImage: `url("${dataUrl}")`,
      backgroundRepeat: 'repeat',
      zIndex: 100000,
    }} />
  );
};

export default function GlobalFiles() {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Secure Viewer State
  const [viewingFileUrl, setViewingFileUrl] = useState(null);
  const [viewingMime, setViewingMime] = useState(null);
  const [numPages, setNumPages] = useState(null);

  useEffect(() => {
    fetchGlobalFiles();
  }, []);

  // Global Keydown Blocker when viewing file
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!viewingFileUrl) return;
      
      // Block Ctrl+P (Print) and Ctrl+S (Save)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        alert('SECURITY ALERT: Saving and printing are strictly disabled for this file.');
      }
      
      // Block F12 (DevTools) and Ctrl+Shift+I (DevTools)
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I'))) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingFileUrl]);

  const fetchGlobalFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/share/global');
      if (res.data.success) {
        setFiles(res.data.data.files);
      }
    } catch (err) {
      setError('Failed to fetch global files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (fileId) => {
    try {
      await api.post(`/share/request/${fileId}`);
      // Optimistically update the UI
      setFiles(files.map(f => f.id === fileId ? { ...f, accessStatus: 'PENDING' } : f));
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to request access');
    }
  };

  const handleViewShared = async (fileId, mimeType) => {
    try {
      // Securely fetch file with Auth Header as a Blob
      const res = await api.get(`/files/${fileId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mimeType }));
      
      setViewingMime(mimeType);
      setViewingFileUrl(url);
      setNumPages(null);

      // Optimistically mark as EXPIRED so they can't click it again
      setFiles(files.map(f => f.id === fileId ? { ...f, accessStatus: 'EXPIRED' } : f));
    } catch (err) {
      alert('Failed to view file. Access may have been revoked or already consumed.');
    }
  };

  const closeViewer = () => {
    if (viewingFileUrl) {
      window.URL.revokeObjectURL(viewingFileUrl);
    }
    setViewingFileUrl(null);
    setViewingMime(null);
    setNumPages(null);
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <>
      <div className="card animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Global Shared Directory
          </h2>
          <button 
            onClick={fetchGlobalFiles}
            disabled={loading}
            className="btn-outline"
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span style={{ fontSize: '13px' }}>Refresh</span>
          </button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Request access to view encrypted files. <br/>
          <strong>Security Note:</strong> Approved access is for <em>one-time viewing only</em>.
        </p>

        {error && (
          <div className="alert alert-error animate-fade-in" style={{ marginBottom: '24px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 16px' }} />
            <p>Loading global directory...</p>
          </div>
        ) : files.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Lock size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <p>No files found from other users.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {files.map(file => (
              <div 
                key={file.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    {file.accessStatus === 'APPROVED' ? (
                      <Unlock size={20} color="#10b981" />
                    ) : file.accessStatus === 'EXPIRED' ? (
                      <Lock size={20} color="#ef4444" />
                    ) : (
                      <Lock size={20} color="var(--text-muted)" />
                    )}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <h4 style={{ 
                      color: 'var(--text-primary)', 
                      fontWeight: '500', 
                      fontSize: '15px', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      marginBottom: '4px'
                    }}>
                      {file.originalFilename}
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      Owned by {file.ownerEmail} • {formatSize(file.size)}
                    </p>
                  </div>
                </div>
                
                <div style={{ marginLeft: '16px' }}>
                  {file.accessStatus === 'APPROVED' ? (
                    <button 
                      onClick={() => handleViewShared(file.id, file.mimeType)}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Eye size={14} /> View 1-Time
                    </button>
                  ) : file.accessStatus === 'PENDING' ? (
                    <button 
                      className="btn-outline"
                      disabled
                      style={{ padding: '8px 16px', fontSize: '13px', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Clock size={14} /> Request Pending
                    </button>
                  ) : file.accessStatus === 'DENIED' ? (
                    <button 
                      onClick={() => handleRequestAccess(file.id)}
                      className="btn-outline"
                      style={{ padding: '8px 16px', fontSize: '13px', borderColor: '#ef4444', color: '#ef4444' }}
                    >
                      Request Again (Denied)
                    </button>
                  ) : file.accessStatus === 'EXPIRED' ? (
                    <button 
                      onClick={() => handleRequestAccess(file.id)}
                      className="btn-outline"
                      style={{ padding: '8px 16px', fontSize: '13px', borderColor: '#ef4444', color: '#ef4444' }}
                    >
                      Request Again (Consumed)
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleRequestAccess(file.id)}
                      className="btn-outline"
                      style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                      Request Access
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECURE VIEWER OVERLAY */}
      {viewingFileUrl && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 9999, display: 'flex', flexDirection: 'column',
            backdropFilter: 'blur(10px)'
          }}
          // Prevent right-click to save
          onContextMenu={(e) => e.preventDefault()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
            <div style={{ color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Lock size={18} color="#10b981" />
              <span style={{ fontWeight: '600' }}>Secure Abstract Viewer — One-Time Access</span>
            </div>
            <button 
              onClick={closeViewer}
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <X size={20} /> Close Window
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '24px', position: 'relative' }}>
            <WatermarkOverlay email={user?.email} />
            {viewingMime?.startsWith('image/') ? (
              <img 
                src={viewingFileUrl} 
                alt="Secure Decrypted content" 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }} 
              />
            ) : (
              <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Document 
                  file={viewingFileUrl} 
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={<Loader2 size={32} className="animate-spin" color="#10b981" />}
                  error={<div style={{ color: '#ef4444' }}>Failed to securely render PDF.</div>}
                >
                  {Array.from(new Array(numPages || 0), (el, index) => (
                    <div key={`page_${index + 1}`} style={{ marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                      <Page 
                        pageNumber={index + 1} 
                        renderTextLayer={false} 
                        renderAnnotationLayer={false}
                        width={Math.min(window.innerWidth - 80, 1000)}
                      />
                    </div>
                  ))}
                </Document>
              </div>
            )}
          </div>
          <div style={{ padding: '12px', textAlign: 'center', color: '#ef4444', fontSize: '12px', backgroundColor: '#0f172a' }}>
            DO NOT CLOSE THIS WINDOW. ONCE CLOSED, YOUR ACCESS WILL BE PERMANENTLY REVOKED.
          </div>
        </div>
      )}
    </>
  );
}
