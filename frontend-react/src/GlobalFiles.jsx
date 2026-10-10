import React, { useState, useEffect } from 'react';
import { FileText, Lock, Unlock, Clock, AlertCircle, Loader2, Eye, X, RefreshCw } from 'lucide-react';
import { useAuth } from './AuthContext';
import api from './api';

import SecureFileViewer from './SecureFileViewer';

export default function GlobalFiles() {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Secure Viewer State
  const [viewingFileUrl, setViewingFileUrl] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);

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

  const handleViewShared = async (file) => {
    try {
      // Securely fetch file with Auth Header as a Blob
      const res = await api.get(`/files/${file.id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: file.mimeType }));
      
      setViewingFile(file);
      setViewingFileUrl(url);

      // Optimistically mark as EXPIRED so they can't click it again
      setFiles(files.map(f => f.id === file.id ? { ...f, accessStatus: 'EXPIRED' } : f));
    } catch (err) {
      alert('Failed to view file. Access may have been revoked or already consumed.');
    }
  };

  const closeViewer = () => {
    if (viewingFileUrl) {
      window.URL.revokeObjectURL(viewingFileUrl);
    }
    setViewingFileUrl(null);
    setViewingFile(null);
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
                      onClick={() => handleViewShared(file)}
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
      {viewingFileUrl && viewingFile && (
        <SecureFileViewer
          fileId={viewingFile.id}
          filename={viewingFile.originalFilename}
          mimeType={viewingFile.mimeType}
          confidentialityLevel={viewingFile.confidentialityLevel || 'NORMAL'}
          blobUrl={viewingFileUrl}
          onClose={closeViewer}
        />
      )}
    </>
  );
}
