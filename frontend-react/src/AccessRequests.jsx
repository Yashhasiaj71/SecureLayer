import React, { useState, useEffect } from 'react';
import { User, Check, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import api from './api';

export default function AccessRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/share/requests/incoming');
      if (res.data.success) {
        setRequests(res.data.data.requests);
      }
    } catch (err) {
      setError('Failed to fetch incoming requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId, action) => {
    try {
      await api.post(`/share/requests/${requestId}/${action}`);
      setRequests(requests.map(r => 
        r.id === requestId ? { ...r, status: action === 'approve' ? 'APPROVED' : 'DENIED' } : r
      ));
    } catch (err) {
      alert(`Failed to ${action} request`);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="card animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Incoming Access Requests
        </h2>
        <button 
          onClick={fetchRequests}
          disabled={loading}
          className="btn-outline"
          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span style={{ fontSize: '13px' }}>Refresh</span>
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Manage users requesting access to your encrypted files.
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
          <p>Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <User size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <p>No incoming requests.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map(req => (
            <div 
              key={req.id} 
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
                  <User size={20} color="var(--brand-primary)" />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h4 style={{ 
                    color: 'var(--text-primary)', 
                    fontWeight: '500', 
                    fontSize: '14px', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    marginBottom: '4px'
                  }}>
                    <strong style={{ color: 'var(--brand-primary)' }}>{req.requesterEmail}</strong> wants to view <strong style={{ color: '#e2e8f0' }}>{req.filename}</strong>
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Requested on {formatDate(req.createdAt)}
                  </p>
                </div>
              </div>
              
              <div style={{ marginLeft: '16px', display: 'flex', gap: '8px' }}>
                {req.status === 'PENDING' ? (
                  <>
                    <button 
                      onClick={() => handleAction(req.id, 'approve')}
                      className="btn-primary"
                      style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Approve"
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={() => handleAction(req.id, 'deny')}
                      className="btn-outline"
                      style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: '#ef4444', color: '#ef4444' }}
                      title="Deny"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    backgroundColor: req.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: req.status === 'APPROVED' ? '#10b981' : '#ef4444'
                  }}>
                    {req.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
