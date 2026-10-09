import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import api from './api';
import { useAuth } from './AuthContext';

export default function Otp() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const email = state?.email;
  const isRegistration = state?.isRegistration || false;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRefs = useRef([]);

  const [successMessage, setSuccessMessage] = useState('Mail has been sent successfully!');

  if (!email) {
    navigate('/login');
    return null;
  }

  // Clear success message after a few seconds
  React.useEffect(() => {
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) return setError('Please enter all 6 digits');

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const endpoint = isRegistration ? '/auth/register/verify-otp' : '/auth/login/verify';
      const res = await api.post(endpoint, { email, otp: code });
      
      if (res.data.success) {
        login(res.data.data.user, res.data.data.accessToken);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box animate-fade-in">
        <div className="logo-container">
          <div className="logo-icon">
            <KeyRound size={32} color="white" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Verify your identity
          </h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '8px' }}>
            We sent a 6-digit code to<br/>
            <strong style={{ color: 'var(--brand-primary)' }}>{email}</strong>
          </p>
        </div>

        <div className="card">
          {successMessage && (
            <div className="alert alert-success animate-fade-in" style={{ marginBottom: '24px' }}>
              <ShieldCheck size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="otp-container">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength={1}
                className="otp-input"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
              />
            ))}
          </div>

          {error && (
            <div className="alert alert-error animate-fade-in" style={{ marginBottom: '24px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button 
            className="btn-primary w-full"
            onClick={verifyOtp}
            disabled={loading || otp.join('').length < 6}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Verify Code'}
          </button>

          <div style={{ marginTop: '24px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ShieldCheck size={16} color="var(--brand-primary)" />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              This code expires in 5 minutes and can only be used once.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
