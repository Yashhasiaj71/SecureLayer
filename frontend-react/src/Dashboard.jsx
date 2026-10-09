import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { FileText, UploadCloud, Trash2, Download, AlertCircle, Loader2, Globe, Shield, Settings, Bell, BellOff } from 'lucide-react';
import api from './api';
import GlobalFiles from './GlobalFiles';
import AccessRequests from './AccessRequests';

export default function Dashboard() {
  const { user, setUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('vault'); // 'vault', 'global', 'requests'
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  
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
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      await fetchFiles(); // Refresh list after upload
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset input
      }
    }
  };

  const handleDownload = async (fileId, filename) => {
    try {
      // Securely fetch file with Auth Header as a Blob
      const res = await api.get(`/files/${fileId}`, { responseType: 'blob' });
      
      // Create a temporary object URL and trigger download
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
      console.error(err);
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
      console.error(err);
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
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px' }}>
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
            {user?.preferences?.emailNotifications !== false ? <Bell size={18} color="#10b981" /> : <BellOff size={18} color="#ef4444" />}
          </button>
          <button className="btn-outline" onClick={logout}>Sign out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <button 
          className={activeTab === 'vault' ? 'btn-primary' : 'btn-outline'}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          onClick={() => setActiveTab('vault')}
        >
          <Shield size={16} /> My Vault
        </button>
        <button 
          className={activeTab === 'global' ? 'btn-primary' : 'btn-outline'}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          onClick={() => setActiveTab('global')}
        >
          <Globe size={16} /> Global Files
        </button>
        <button 
          className={activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          onClick={() => setActiveTab('requests')}
        >
          <Bell size={16} /> Access Requests
        </button>
      </div>

      {error && activeTab === 'vault' && (
        <div className="alert alert-error animate-fade-in" style={{ marginBottom: '24px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Render Active Tab */}
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
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              cursor: 'pointer',
              transition: 'border-color 0.2s ease, background-color 0.2s ease'
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
            {uploading ? (
              <Loader2 size={48} className="animate-spin" style={{ color: 'var(--brand-primary)', marginBottom: '16px' }} />
            ) : (
              <UploadCloud size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            )}
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
                        <FileText size={20} color="var(--brand-primary)" />
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
                          {formatSize(file.size)} • {formatDate(file.createdAt)}
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                      <button 
                        onClick={() => handleDownload(file.id, file.originalFilename)}
                        style={{ 
                          background: 'none', border: 'none', padding: '8px', 
                          cursor: 'pointer', color: 'var(--text-secondary)' 
                        }}
                        title="Download decrypted file"
                      >
                        <Download size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(file.id)}
                        style={{ 
                          background: 'none', border: 'none', padding: '8px', 
                          cursor: 'pointer', color: '#ef4444' 
                        }}
                        title="Delete permanently"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
