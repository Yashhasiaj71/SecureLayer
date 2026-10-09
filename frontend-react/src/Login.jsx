import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, AlertCircle, Loader2 } from 'lucide-react';
import api from './api';

export default function Login({ isRegistration = false }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) return setError('Please enter your email');
    
    setLoading(true);
    setError(null);
    try {
      const endpoint = isRegistration ? '/auth/register/request-otp' : '/auth/login';
      const res = await api.post(endpoint, { email });
      if (res.data.success) {
        navigate('/verify', { state: { email, isRegistration } });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to request code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box animate-fade-in">
        <div className="logo-container">
          <div className="logo-icon">
            <Shield size={32} color="white" />
          </div>
          <h1 className="logo-text">SecureLayer</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            Encrypted. Authenticated. Protected.
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
            {isRegistration ? 'Create an account' : 'Sign in'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            Enter your email to receive a secure one-time code
          </p>

          <form onSubmit={handleRequestOtp}>
            <div className="input-group">
              <label className="input-label">Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  className="input-field"
                  style={{ paddingLeft: '44px' }}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="alert alert-error animate-fade-in">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button 
              type="submit" 
              className="btn-primary w-full mt-4"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Continue with Email'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              {isRegistration ? 'Already have an account?' : 'New to SecureLayer?'}
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          </div>

          <button 
            type="button" 
            className="btn-outline w-full"
            onClick={() => navigate(isRegistration ? '/login' : '/register')}
          >
            {isRegistration ? 'Sign in instead' : 'Create an account'}
          </button>
        </div>
      </div>
    </div>
  );
}
