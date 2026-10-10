import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { FileText, UploadCloud, Trash2, Download, AlertCircle, Loader2, Globe, Shield, Settings, Bell, BellOff, Eye, ShieldAlert } from 'lucide-react';
import api from './api';
import GlobalFiles from './GlobalFiles';
import AccessRequests from './AccessRequests';
import SecureFileViewer from './SecureFileViewer';

const CONFIDENTIALITY_LABELS = {
  NORMAL: { label: 'Normal', color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
  CONFIDENTIAL: { label: 'Confidential', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  HIGHLY_CONFIDENTIAL: { label: 'Highly Confidential', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

export default function Dashboard() {
  const { user, setUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('vault');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Secure viewer state
  const [viewerFile, setViewerFile] = useState(null); // { id, filename, mimeType, confidentialityLevel, blobUrl }
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'vault') {
      fetchFiles();
    }
  }, [activeTab]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/files');
      if (res.data.success) {
        setFiles(res.data.data.files);
      }
    } catch (err) {
      setError('Failed to fetch files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File must be smaller than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      setError(null);
      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchFiles();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open the SecureFileViewer — fetches the decrypted blob first
  const handleView = async (file) => {
    try {
      const res = await api.get(`/files/${file.id}`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: file.mimeType }));
      setViewerFile({ ...file, blobUrl });
    } catch (err) {
      setError('Failed to securely load file');
    }
  };

  const handleCloseViewer = () => {
    if (viewerFile?.blobUrl) {
      window.URL.revokeObjectURL(viewerFile.blobUrl);
    }
    setViewerFile(null);
  };

  const handleDownload = async (fileId, filename) => {
    try {
      const res = await api.get(`/files/${fileId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download file securely');
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Are you sure you want to permanently delete this encrypted file?')) return;
    try {
      setError(null);
      await api.delete(`/files/${fileId}`);
      setFiles(files.filter(f => f.id !== fileId));
    } catch (err) {
      setError('Failed to delete file');
    }
  };

  const handleConfidentialityChange = async (fileId, level) => {
    try {
      const res = await api.patch(`/files/${fileId}/confidentiality`, { level });
      if (res.data.success) {
        setFiles(files.map(f => f.id === fileId
          ? { ...f, confidentialityLevel: res.data.data.confidentialityLevel }
          : f
        ));
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update classification');
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const toggleNotifications = async () => {
    try {
      const currentState = user?.preferences?.emailNotifications ?? true;
      const res = await api.put('/auth/me/preferences', { emailNotifications: !currentState });
      if (res.data.success) {
        setUser({ ...user, preferences: res.data.data.preferences });
      }
    } catch (err) {
      alert('Failed to update preferences');
    }
  };

  return (
    <>
      {/* Secure File Viewer Modal */}
      {viewerFile && (
        <SecureFileViewer
          fileId={viewerFile.id}
          filename={viewerFile.originalFilename}
          mimeType={viewerFile.mimeType}
          confidentialityLevel={viewerFile.confidentialityLevel || 'NORMAL'}
          blobUrl={viewerFile.blobUrl}
          onClose={handleCloseViewer}
        />
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
              SecureLayer Dashboard
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>Welcome, {user?.email}</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button
              className="btn-outline"
              onClick={toggleNotifications}
              title={user?.preferences?.emailNotifications !== false ? 'Email Notifications: ON' : 'Email Notifications: OFF'}
              style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {user?.preferences?.emailNotifications !== false
                ? <Bell size={18} color="#10b981" />
                : <BellOff size={18} color="#ef4444" />}
            </button>
            <button className="btn-outline" onClick={logout}>Sign out</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          {[
            { key: 'vault', icon: Shield, label: 'My Vault' },
            { key: 'global', icon: Globe, label: 'Global Files' },
            { key: 'requests', icon: Bell, label: 'Access Requests' },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              className={activeTab === key ? 'btn-primary' : 'btn-outline'}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {error && activeTab === 'vault' && (
          <div className="alert alert-error animate-fade-in" style={{ marginBottom: '24px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'global' && <GlobalFiles />}
        {activeTab === 'requests' && <AccessRequests />}

        {activeTab === 'vault' && (
          <>
            {/* Upload Zone */}
            <div
              className="card animate-fade-in"
              style={{
                marginBottom: '32px',
                border: '2px dashed var(--border-color)',
                backgroundColor: 'transparent',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '48px 24px', cursor: 'pointer',
                transition: 'border-color 0.2s ease',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                accept=".pdf,.png,.jpg,.jpeg"
              />
              {uploading
                ? <Loader2 size={48} className="animate-spin" style={{ color: 'var(--brand-primary)', marginBottom: '16px' }} />
                : <UploadCloud size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />}
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                {uploading ? 'Encrypting & Uploading...' : 'Click to Upload Secure File'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Supports PDF, PNG, JPG up to 10MB
              </p>
            </div>

            {/* File List */}
            <div className="card animate-fade-in">
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '24px' }}>
                Your Encrypted Files
              </h2>

              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 16px' }} />
                  <p>Decrypting vault metadata...</p>
                </div>
              ) : files.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                  <p>Your vault is empty</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {files.map(file => {
                    const cl = file.confidentialityLevel || 'NORMAL';
                    const clCfg = CONFIDENTIALITY_LABELS[cl];
                    return (
                      <div
                        key={file.id}
                        style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px',
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                        }}
                      >
                        {/* File info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden', flex: 1 }}>
                          <div style={{
                            padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', flexShrink: 0,
                          }}>
                            {cl === 'HIGHLY_CONFIDENTIAL'
                              ? <ShieldAlert size={20} color="#ef4444" />
                              : <FileText size={20} color="var(--brand-primary)" />}
                          </div>
                          <div style={{ overflow: 'hidden', flex: 1 }}>
                            <h4 style={{
                              color: 'var(--text-primary)', fontWeight: '500', fontSize: '15px',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              marginBottom: '6px',
                            }}>
                              {file.originalFilename}
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                {formatSize(file.size)} • {formatDate(file.createdAt)}
                              </span>
                              {/* Confidentiality badge */}
                              <span style={{
                                fontSize: '11px', fontWeight: '600',
                                padding: '2px 8px', borderRadius: '999px',
                                backgroundColor: clCfg.bg, color: clCfg.color,
                                border: `1px solid ${clCfg.color}44`,
                              }}>
                                {clCfg.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '4px', marginLeft: '16px', alignItems: 'center', flexShrink: 0 }}>
                          {/* Confidentiality selector */}
                          <select
                            value={cl}
                            onChange={(e) => handleConfidentialityChange(file.id, e.target.value)}
                            style={{
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-color)',
                              color: clCfg.color,
                              borderRadius: '6px',
                              padding: '6px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                            title="Set confidentiality level"
                          >
                            <option value="NORMAL">Normal</option>
                            <option value="CONFIDENTIAL">Confidential</option>
                            <option value="HIGHLY_CONFIDENTIAL">Highly Confidential</option>
                          </select>

                          {/* View button */}
                          <button
                            onClick={() => handleView(file)}
                            style={{
                              background: 'none', border: 'none', padding: '8px',
                              cursor: 'pointer', color: 'var(--brand-primary)',
                            }}
                            title={cl === 'HIGHLY_CONFIDENTIAL' ? 'View (CamDetection required)' : 'View securely'}
                          >
                            {cl === 'HIGHLY_CONFIDENTIAL' ? <ShieldAlert size={18} /> : <Eye size={18} />}
                          </button>

                          {/* Download */}
                          <button
                            onClick={() => handleDownload(file.id, file.originalFilename)}
                            style={{
                              background: 'none', border: 'none', padding: '8px',
                              cursor: 'pointer', color: 'var(--text-secondary)',
                            }}
                            title="Download decrypted file"
                          >
                            <Download size={18} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(file.id)}
                            style={{
                              background: 'none', border: 'none', padding: '8px',
                              cursor: 'pointer', color: '#ef4444',
                            }}
                            title="Delete permanently"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
