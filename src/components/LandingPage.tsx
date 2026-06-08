import React, { useState, useEffect, useRef } from 'react';
import '../styles/premium-landing.css';
import { SuspendedAccountModal, parseSuspensionReason } from './SuspendedAccountModal';

interface LandingPageProps {
  apiBase: string;
  onLoginSuccess: (token: string, userData: any) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ apiBase, onLoginSuccess, showToast }) => {
  const [hasEntered, setHasEntered] = useState(false);
  const [isModalActive, setIsModalActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'reset'>('login');
  const [infoModalContent, setInfoModalContent] = useState<{title: string, body: string} | null>(null);
  const [successDialogContent, setSuccessDialogContent] = useState<{title: string, message: string} | null>(null);
  const [suspendedDialog, setSuspendedDialog] = useState<{ reason: string } | null>(null);
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginStatus, setLoginStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regStatus, setRegStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [isRegistering, setIsRegistering] = useState(false);

  // Reset password states
  const [resetStep, setResetStep] = useState<number>(1);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailStatus, setResetEmailStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resetOtpSentEmail, setResetOtpSentEmail] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [isResendDisabled, setIsResendDisabled] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);


  // OTP inputs state
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resetOtpStatus, setResetOtpStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // New Password states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ pct: '0%', color: 'transparent', text: 'Password strength' });
  const [registerPasswordStrength, setRegisterPasswordStrength] = useState({ pct: '0%', color: 'transparent', text: 'Password strength' });
  const [resetPassStatus, setResetPassStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Advanced features state
  const [statsVisible, setStatsVisible] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const statsRef = useRef<HTMLDivElement>(null);

  // Count-up animation state
  const [countUsers, setCountUsers] = useState(0);
  const [countItems, setCountItems] = useState(0);
  const [countRate, setCountRate] = useState(0);

  // Data for advanced features
  const defaultTestimonials = [
    {
      name: 'john doe',
      role: 'Student',
      text: 'Found my lost wallet in 2 hours. The location feature is really useful.',
    },
    {
      name: 'josh',
      role: 'Business Owner',
      text: 'Got my laptop back through community help. This platform is very reliable.',
    },
    {
      name: 'Sita Rai',
      role: 'Teacher',
      text: 'The verification system gave me a lot of confidence to safely return items.',
    },
  ];

  const [platformReviews, setPlatformReviews] = useState<any[]>([]);

  useEffect(() => {
    const fetchPlatformReviews = async () => {
      try {
        const res = await fetch(`${apiBase}/reviews/platform`);
        if (res.ok) {
          const data = await res.json();
          const topReviews = data.filter((r: any) => r.rating >= 4);
          if (topReviews.length > 0) {
            setPlatformReviews(topReviews);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch platform reviews');
      }
    };
    fetchPlatformReviews();
  }, [apiBase]);

  const testimonials = platformReviews.length > 0
    ? platformReviews.map(r => ({
        name: r.reviewer?.name || 'Anonymous',
        role: `⭐ ${r.rating}/5 User Rating`,
        text: r.comment,
        adminResponse: r.adminResponse || null,
      }))
    : defaultTestimonials;



  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            if (entry.target === statsRef.current) {
              setStatsVisible(true);
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  // Count-up animation when stats section is visible
  useEffect(() => {
    if (!statsVisible) return;
    const duration = 800; // ms
    const targets = [{ setter: setCountUsers, target: 100 }, { setter: setCountItems, target: 5 }, { setter: setCountRate, target: 98 }];
    const intervals = targets.map(({ setter, target }) => {
      const steps = 40;
      const increment = target / steps;
      const delay = duration / steps;
      let current = 0;
      const id = setInterval(() => {
        current += increment;
        if (current >= target) {
          setter(target);
          clearInterval(id);
        } else {
          setter(Math.floor(current));
        }
      }, delay);
      return id;
    });
    return () => intervals.forEach(clearInterval);
  }, [statsVisible]);



  const validateGmail = (email: string) => {
    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email.trim());
  };

  const showStatus = (
    setter: React.Dispatch<React.SetStateAction<{ text: string; type: 'success' | 'error' | '' }>>,
    msg: string,
    type: 'success' | 'error'
  ) => {
    setter({ text: msg, type });
    if (type === 'success') return;
    setTimeout(() => {
      setter(prev => (prev.text === msg ? { text: '', type: '' } : prev));
    }, 4500);
  };

  const showSuspendedDialog = (message: string) => {
    const reason = parseSuspensionReason(message) || 'Your account has been suspended by an administrator.';
    setLoginStatus({ text: '', type: '' });
    setSuspendedDialog({ reason });
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const email = loginEmail.trim();
    const password = loginPassword;
    if (!email || !password) return showStatus(setLoginStatus, '❌ Please fill email and password', 'error');
    if (!validateGmail(email)) return showStatus(setLoginStatus, '❌ Must use a valid Gmail address', 'error');

    setIsLoggingIn(true);
    setLoginStatus({ text: 'Logging in...', type: 'success' });
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        setSuccessDialogContent({ title: 'Welcome Back!', message: 'Login successful. Redirecting to your dashboard...' });
        setTimeout(() => {
          onLoginSuccess(data.access_token, data.user);
        }, 1500);
      } else {
        const message = data.message || 'Login failed. Check credentials.';
        if (res.status === 403 || parseSuspensionReason(message)) {
          showSuspendedDialog(message);
        } else {
          showStatus(setLoginStatus, message, 'error');
        }
      }
    } catch {
      showStatus(setLoginStatus, '⚠️ Backend not reachable on port 3000', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = regName.trim();
    const address = regAddress.trim();
    const email = regEmail.trim();
    const password = regPassword;
    const confirm = regConfirm;

    if (!name || !email || !password || !confirm) {
      return showStatus(setRegStatus, '❌ Name, email and password required', 'error');
    }
    if (name.length < 2) {
      return showStatus(setRegStatus, '❌ Name must be at least 2 characters', 'error');
    }
    if (!validateGmail(email)) {
      return showStatus(setRegStatus, '❌ Please enter a valid Gmail address', 'error');
    }
    if (password.length < 6) {
      return showStatus(setRegStatus, '❌ Password must be at least 6 characters', 'error');
    }
    if (password !== confirm) {
      return showStatus(setRegStatus, '❌ Passwords do not match', 'error');
    }

    setIsRegistering(true);
    setRegStatus({ text: 'Creating...', type: 'success' });
    try {
      const payload: any = { name, email, password };
      if (address) payload.address = address;

      const res = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        setSuccessDialogContent({ title: 'Account Created', message: 'Your account has been created successfully! Redirecting...' });
        setTimeout(() => {
          onLoginSuccess(data.access_token, data.user);
        }, 1500);
      } else {
        showStatus(setRegStatus, data.message || 'Registration failed. Email might exist.', 'error');
      }
    } catch {
      showStatus(setRegStatus, '⚠️ Cannot connect to backend on port 3000', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const initiateGoogleLogin = () => {
    if (googleLoading) return;
    const base = apiBase.replace(/\/$/, '');
    if (!base) {
      showToast('API URL is not configured. Check VITE_API_BASE in .env', 'error');
      return;
    }
    setGoogleLoading(true);
    window.location.assign(`${base}/auth/google`);
  };

  const startResendTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendTimer(60);
    setIsResendDisabled(true);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const email = resetEmail.trim();
    if (!email) return showStatus(setResetEmailStatus, '❌ Please enter your email', 'error');
    if (!validateGmail(email)) return showStatus(setResetEmailStatus, '❌ Please enter a valid Gmail address', 'error');

    setIsSendingOtp(true);
    setResetEmailStatus({ text: 'Sending...', type: 'success' });
    try {
      const res = await fetch(`${apiBase}/reset-password/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetOtpSentEmail(email);
        setOtpValues(['', '', '', '', '', '']);
        setResetStep(2);
        startResendTimer();
        setSuccessDialogContent({ title: 'OTP Sent', message: 'Please check your inbox for the 6-digit verification code.' });
      } else {
        showStatus(setResetEmailStatus, data.message || '❌ Email not found. Please check and try again.', 'error');
      }
    } catch {
      // Demo fallback
      showStatus(setResetEmailStatus, '⚠️ Backend unreachable. Entering demo mode...', 'error');
      setTimeout(() => {
        setResetOtpSentEmail(email);
        setOtpValues(['', '', '', '', '', '']);
        setResetStep(2);
        startResendTimer();
      }, 1000);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!resetOtpSentEmail) return;
    setIsResendDisabled(true);
    try {
      await fetch(`${apiBase}/reset-password/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetOtpSentEmail }),
      });
      showStatus(setResetOtpStatus, '📨 New code sent!', 'success');
      setOtpValues(['', '', '', '', '', '']);
      startResendTimer();
    } catch {
      showStatus(setResetOtpStatus, '⚠️ Failed to resend code', 'error');
      setIsResendDisabled(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpValues.join('');
    if (otp.length < 6) return showStatus(setResetOtpStatus, '❌ Enter all 6 digits', 'error');

    setIsVerifyingOtp(true);
    setResetOtpStatus({ text: 'Verifying...', type: 'success' });
    try {
      const res = await fetch(`${apiBase}/reset-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetOtpSentEmail, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        if (timerRef.current) clearInterval(timerRef.current);
        setResetStep(3);
      } else {
        showStatus(setResetOtpStatus, data.message || '❌ Invalid or expired code.', 'error');
      }
    } catch {
      // Demo fallback
      if (timerRef.current) clearInterval(timerRef.current);
      setResetStep(3);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const cleanedVal = val.replace(/\D/g, '').slice(-1);
    const newOtp = [...otpValues];
    newOtp[index] = cleanedVal;
    setOtpValues(newOtp);

    // Auto-focus next box
    if (cleanedVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      const newOtp = [...otpValues];
      newOtp[index - 1] = '';
      setOtpValues(newOtp);
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otpValues];
    pasted.split('').forEach((ch, idx) => {
      newOtp[idx] = ch;
    });
    setOtpValues(newOtp);
    const nextFocusIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[nextFocusIndex]?.focus();
  };

  const calculatePasswordStrength = (val: string) => {
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
      { pct: '0%', color: 'transparent', text: 'Password strength' },
      { pct: '25%', color: '#e74c3c', text: 'Weak' },
      { pct: '50%', color: '#f39c12', text: 'Fair' },
      { pct: '75%', color: '#3498db', text: 'Good' },
      { pct: '100%', color: '#2ecc71', text: 'Strong ✓' },
    ];
    setPasswordStrength(levels[score]);
  };

  const calculateRegisterPasswordStrength = (val: string) => {
    let score = 0;
    if (val.length >= 6) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
      { pct: '0%', color: 'transparent', text: 'Password strength' },
      { pct: '25%', color: '#e74c3c', text: 'Weak' },
      { pct: '50%', color: '#f39c12', text: 'Fair' },
      { pct: '75%', color: '#3498db', text: 'Good' },
      { pct: '100%', color: '#2ecc71', text: 'Strong ✓' },
    ];
    setRegisterPasswordStrength(levels[score]);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) return showStatus(setResetPassStatus, '❌ Please fill both fields', 'error');
    if (newPassword.length < 8) return showStatus(setResetPassStatus, '❌ Password must be at least 8 characters', 'error');
    if (newPassword !== confirmPassword) return showStatus(setResetPassStatus, '❌ Passwords do not match', 'error');

    setIsResettingPassword(true);
    setResetPassStatus({ text: 'Resetting...', type: 'success' });
    try {
      const res = await fetch(`${apiBase}/reset-password/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetOtpSentEmail, otp: otpValues.join(''), newPassword, confirmPassword: newPassword }),
      });
      if (res.ok) {
        setResetStep(4);
      } else {
        const data = await res.json();
        showStatus(setResetPassStatus, data.message || '❌ Could not reset password.', 'error');
      }
    } catch {
      setResetStep(4);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const clearFields = () => {
    setLoginEmail('');
    setLoginPassword('');
    setRegName('');
    setRegAddress('');
    setRegEmail('');
    setRegPassword('');
    setRegConfirm('');
    setResetEmail('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpValues(['', '', '', '', '', '']);
    setResetStep(1);
    setLoginStatus({ text: '', type: '' });
    setRegStatus({ text: '', type: '' });
    setResetEmailStatus({ text: '', type: '' });
    setResetOtpStatus({ text: '', type: '' });
    setResetPassStatus({ text: '', type: '' });
  };

  const handleLearnMore = () => {
    const el = document.querySelector('.features');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderResetStep = () => {
    switch (resetStep) {
      case 1:
        return (
          <div className="reset-step active">
            <p className="step-label">Enter your registered Gmail to receive a reset code</p>
            {resetEmailStatus.text && (
              <div className={`modal-status ${resetEmailStatus.type}`}>
                {resetEmailStatus.text}
              </div>
            )}
            <div className="floating-input-group">
              <input
                type="email"
                autoComplete="email"
                placeholder=" "
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSendOtp()}
              />
              <label>Gmail address</label>
            </div>
            <button
              onClick={handleSendOtp}
              disabled={isSendingOtp}
              className="landing-submit-btn"
            >
              {isSendingOtp ? <><span className="loading-spinner"></span> Sending...</> : 'Send Reset Code →'}
            </button>
          </div>
        );
      case 2:
        return (
          <div className="reset-step active">
            <p className="step-label">Code sent to {resetOtpSentEmail}</p>
            {resetOtpStatus.text && (
              <div className={`modal-status ${resetOtpStatus.type}`}>
                {resetOtpStatus.text}
              </div>
            )}
            <div className="otp-row">
              {otpValues.map((val, idx) => (
                <input
                  key={idx}
                  ref={el => {
                    otpInputRefs.current[idx] = el;
                  }}

                  className="otp-box"
                  maxLength={1}
                  inputMode="numeric"
                  value={val}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  onPaste={idx === 0 ? handleOtpPaste : undefined}
                />
              ))}
            </div>
            <div className="resend-row">
              Didn't get it?{' '}
              <button
                className="resend-btn"
                onClick={handleResendOtp}
                disabled={isResendDisabled}
              >
                {isResendDisabled ? `Resend in ${resendTimer}s` : 'Resend code'}
              </button>
            </div>
            <button
              onClick={handleVerifyOtp}
              disabled={isVerifyingOtp}
              className="landing-submit-btn"
            >
              {isVerifyingOtp ? <><span className="loading-spinner"></span> Verifying...</> : 'Verify Code →'}
            </button>
          </div>
        );
      case 3:
        return (
          <div className="reset-step active">
            <p className="step-label">Choose a strong new password</p>
            {resetPassStatus.text && (
              <div className={`modal-status ${resetPassStatus.type}`}>
                {resetPassStatus.text}
              </div>
            )}
            <div className="password-wrapper">
              <div className="floating-input-group" style={{ margin: 0 }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder=" "
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value);
                    calculatePasswordStrength(e.target.value);
                  }}
                />
                <label>New password (min 8 chars)</label>
              </div>
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <i className="fas fa-eye-slash" aria-hidden /> : <i className="fas fa-eye" aria-hidden />}
                </button>
            </div>
            <div className="strength-bar">
              <div
                className="strength-fill"
                style={{
                  width: passwordStrength.pct,
                  backgroundColor: passwordStrength.color,
                }}
              />
            </div>
            <p
              className="strength-label"
              style={{ color: passwordStrength.color !== 'transparent' ? passwordStrength.color : '#8e9ab0' }}
            >
              {passwordStrength.text}
            </p>
            <div className="password-wrapper">
              <div className="floating-input-group" style={{ margin: 0 }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder=" "
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleResetPassword()}
                />
                <label>Confirm new password</label>
              </div>
              <button
                type="button"
                className="eye-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <i className="fas fa-eye-slash" aria-hidden /> : <i className="fas fa-eye" aria-hidden />}
              </button>
            </div>
            <button
              onClick={handleResetPassword}
              disabled={isResettingPassword}
              className="landing-submit-btn"
            >
              {isResettingPassword ? <><span className="loading-spinner"></span> Resetting...</> : 'Reset Password →'}
            </button>
          </div>
        );
      case 4:
        return (
          <div className="reset-step active">
            <div className="success-checkmark">
              <div className="checkmark-circle">✓</div>
              <h3>Password Reset!</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '8px 0 16px' }}>
                Your password has been updated successfully. You can now log in with your new credentials.
              </p>
              <button
                className="back-to-login"
                onClick={() => {
                  setActiveTab('login');
                  setResetStep(1);
                }}
              >
                Back to Login
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="premium-landing-body">
      {/* BACKGROUND ELEMENTS */}
      <div className="premium-bg-grid"></div>
      <div className="premium-ambient-light"></div>

      {/* GATEWAY ENTRY SCREEN */}
      <div className={`gateway-screen ${hasEntered ? 'entered' : ''}`}>
        <div className="gateway-bg-glow"></div>
        <div className="gateway-logo-container">
          <div className="gateway-logo">FINDIT</div>
          <button className="gateway-btn" onClick={() => setHasEntered(true)}>
            Enter Experience
          </button>
          {/* <div className="gateway-hint">Sound Off</div> */}
        </div>
      </div>

      <div className="landing-content">
        {/* HERO SECTION */}
        <div className="premium-hero">
          <div className={`hero-badge-premium ${hasEntered ? 'hero-reveal delay-1' : 'hero-standby'}`}>
            <span></span> AI-Powered Community Recovery
          </div>
          <h1 className={`premium-hero-title ${hasEntered ? 'hero-reveal delay-2' : 'hero-standby'}`}>
            Never Lose What <br />
            <span className="premium-text-gradient">Matters Most.</span>
          </h1>
          <p className={`premium-hero-subtitle ${hasEntered ? 'hero-reveal delay-3' : 'hero-standby'}`}>
            Join thousands recovering lost items through our smart community platform. 
            Real-time alerts, secure verification, and AI matching.
          </p>
          
          <div className={`cta-group ${hasEntered ? 'hero-reveal delay-4' : 'hero-standby'}`}>
            <button
              className="premium-btn-primary"
              onClick={() => {
                clearFields();
                setIsModalActive(true);
                setActiveTab('login');
              }}
            >
              Get Started 
            </button>
            <button className="premium-btn-secondary" onClick={handleLearnMore}>
              Watch Demo
            </button>
          </div>


        </div>

        {/* STATISTICS ROW */}
        <div className="premium-stats-row animate-on-scroll" ref={statsRef}>
          <div className="premium-stat">
            <div className="premium-stat-num">{countUsers}<span style={{ fontSize: '0.6em' }}>+</span></div>
            <div className="premium-stat-label">Active Users</div>
          </div>
          <div className="premium-stat">
            <div className="premium-stat-num">{countItems}<span style={{ fontSize: '0.6em' }}>+</span></div>
            <div className="premium-stat-label">Items Recovered</div>
          </div>
          <div className="premium-stat">
            <div className="premium-stat-num">{countRate}<span style={{ fontSize: '0.6em' }}>%</span></div>
            <div className="premium-stat-label">Success Rate</div>
          </div>
        </div>

        {/* BENTO BOX FEATURES */}
        <div className="premium-section features" id="features">
          <h2 className="premium-section-title animate-on-scroll">How It Works</h2>
          <div className="bento-grid">
            <div className="bento-card bento-card-large animate-on-scroll stagger-1">
              <div className="bento-icon">⚙️</div>
              <h3>AI Matching Algorithm</h3>
              <p>Our intelligent system automatically cross-references lost reports with found items in real-time. It analyzes descriptions, categories, and visual data to immediately notify you of highly probable matches.</p>
            </div>
            <div className="bento-card animate-on-scroll stagger-2">
              <div className="bento-icon">📌</div>
              <h3>Smart Maps</h3>
              <p>Interactive location tracking showing where items are frequently lost or found in your specific area.</p>
            </div>
            <div className="bento-card animate-on-scroll stagger-1">
              <div className="bento-icon">🛡️</div>
              <h3>Secure Verification</h3>
              <p>Built-in identity checks ensure valuable items are only returned to their rightful verified owners.</p>
            </div>
            <div className="bento-card bento-card-large animate-on-scroll stagger-2">
              <div className="bento-icon">📩</div>
              <h3>Encrypted Chat</h3>
              <p>Communicate securely with finders without revealing your personal contact information until you're ready to arrange a safe meetup.</p>
            </div>
          </div>
        </div>

        {/* CATEGORIES SECTION */}
        <div className="premium-section animate-on-scroll" style={{ paddingTop: 0 }}>
          <h2 className="premium-section-title" style={{ marginBottom: '3rem' }}>Commonly Recovered Items</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            {[{ icon: '📱', name: 'Electronics', desc: 'Phones, laptops, earbuds' },
              { icon: '💳', name: 'Documents', desc: 'IDs, passports, wallets' },
              { icon: '🔑', name: 'Keys', desc: 'Car keys, house keys' },
              { icon: '🎒', name: 'Bags', desc: 'Backpacks, luggage' },
              { icon: '💍', name: 'Jewelry', desc: 'Rings, watches' }].map((cat, idx) => (
              <div key={cat.name} className={`animate-on-scroll stagger-${(idx % 5) + 1}`} style={{ background: 'rgba(17, 24, 39, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px', padding: '1.5rem', textAlign: 'center', transition: 'all 0.3s ease', cursor: 'default' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'; e.currentTarget.style.background = 'rgba(31, 41, 55, 0.6)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.background = 'rgba(17, 24, 39, 0.4)'; }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'floatBob 3s ease-in-out infinite', animationDelay: `${idx * 0.2}s` }}>{cat.icon}</div>
                <h4 style={{ color: 'white', fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>{cat.name}</h4>
                <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SECURITY HIGHLIGHT */}
        <div className="premium-section animate-on-scroll" style={{ paddingTop: 0 }}>
          <div style={{ background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.2) 0%, rgba(17, 24, 39, 0.5) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '24px', padding: '3rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50%', left: '-20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }}></div>
            <h2 style={{ color: 'white', fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Your Data is Secure With Us</h2>
            <p style={{ color: '#9ca3af', maxWidth: '700px', margin: '0 auto', lineHeight: '1.6', fontSize: '1.05rem' }}>
              We prioritize your privacy and safety. All personal information is encrypted. Our smart matching algorithm ensures you only interact with verified individuals, and your contact details are never shared without your explicit consent. Focus on finding your items, we'll handle the security.
            </p>
          </div>
        </div>

        {/* TESTIMONIALS SECTION */}
        <div className="premium-section animate-on-scroll">
          <h2 className="premium-section-title">Community Trust</h2>
          <div className="testimonial-carousel">
            <div className="testimonial-card">
              <div className="testimonial-avatar">👤</div>
              <div className="testimonial-content">
                <p className="testimonial-text">"{testimonials[currentTestimonial].text}"</p>
                {(testimonials[currentTestimonial] as any).adminResponse && (
                  <div style={{
                    background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginTop: '12px',
                    fontSize: '0.82rem',
                    color: '#93c5fd',
                  }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, marginBottom: '4px' }}>
                      ADMIN RESPONSE
                    </div>
                    {(testimonials[currentTestimonial] as any).adminResponse}
                  </div>
                )}
                <div className="testimonial-author">
                  <div className="author-name">{testimonials[currentTestimonial].name}</div>
                  <div className="author-role">{testimonials[currentTestimonial].role}</div>
                </div>
              </div>
            </div>
            <div className="testimonial-dots">
              {testimonials.map((_, index) => (
                <div
                  key={index}
                  className={`testimonial-dot ${index === currentTestimonial ? 'active' : ''}`}
                  onClick={() => setCurrentTestimonial(index)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="landing-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'transparent' }}>
          <div className="footer-content">
            <div className="footer-logo" style={{ background: 'linear-gradient(135deg, #60a5fa, #a855f7)', WebkitBackgroundClip: 'text', color: 'transparent', fontFamily: "'Syne', sans-serif", fontSize: '2rem', fontWeight: 800 }}>FINDIT</div>
            <div className="footer-text">Join the community recovering what matters most.</div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', margin: '2rem 0' }}>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="premium-social-icon" aria-label="Facebook">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="premium-social-icon" aria-label="Twitter">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="premium-social-icon" aria-label="Instagram">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="premium-social-icon" aria-label="LinkedIn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>

            <div className="footer-links">
              <a href="#" className="footer-link" onClick={(e) => { e.preventDefault(); setInfoModalContent({title: 'Privacy Policy', body: 'We value your privacy. All your data is encrypted and secure. We will never sell or misuse your personal information. Your identity is kept anonymous until you choose to reveal it during item verification.'}); }}>Privacy Policy</a>
              <a href="#" className="footer-link" onClick={(e) => { e.preventDefault(); setInfoModalContent({title: 'Terms of Service', body: 'By using Findit, you agree to treat other community members with respect. You may only claim items that legitimately belong to you. Fraudulent claims will result in immediate permanent account suspension.'}); }}>Terms of Service</a>
              <a href="#" className="footer-link" onClick={(e) => { e.preventDefault(); setInfoModalContent({title: 'Contact Us', body: 'Need help? You can reach our support team 24/7 at support@findit.gmail.com. We typically respond within 2-4 hours.'}); }}>Contact Us</a>
            </div>
            <div className="footer-copyright">© 2026 FindIT. All rights reserved.</div>
          </div>
        </footer>
      </div>

      {/* AUTH MODAL */}
      <div className={`landing-modal ${isModalActive ? 'active' : ''}`} onClick={() => setIsModalActive(false)}>
        <div className="landing-modal-container" onClick={e => e.stopPropagation()}>
          <span className="landing-modal-close" onClick={() => setIsModalActive(false)}>
            &times;
          </span>
          <h2>Welcome to Findit</h2>
          
          <div className="landing-modal-tabs">
            <button
              className={`landing-modal-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              🗝️ Login
            </button>
            <button
              className={`landing-modal-tab ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => setActiveTab('register')}
            >
              📝 Register
            </button>
            <button
              className={`landing-modal-tab ${activeTab === 'reset' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('reset');
                setResetStep(1);
              }}
            >
              🔄 Reset
            </button>
          </div>

          {/* LOGIN */}
          <div className={`landing-modal-form ${activeTab === 'login' ? 'active' : ''}`}>
            {loginStatus.text && (
              <div className={`modal-status ${loginStatus.type}`}>
                {loginStatus.text}
              </div>
            )}
            <form onSubmit={handleLogin}>
              <input
                type="email"
                className="landing-input-field"
                placeholder="Gmail address"
                autoComplete="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
              />
              <div className="password-wrapper">
                <div className="floating-input-group" style={{ margin: 0 }}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    className="landing-input-field"
                    placeholder="Password (min 6 chars)"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                  />
                </div>
              <button
                type="button"
                className="eye-toggle"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
              >
                {showLoginPassword ? <i className="fas fa-eye-slash" aria-hidden /> : <i className="fas fa-eye" aria-hidden />}
              </button>
              </div>
              <button
                type="button"
                className="landing-forgot-link"
                onClick={() => {
                  setActiveTab('reset');
                  setResetStep(1);
                }}
              >
                Forgot Password?
              </button>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="landing-submit-btn"
              >
                {isLoggingIn ? 'Logging in...' : 'Login →'}
              </button>
            </form>
            <hr className="landing-hr" />
            <button
              type="button"
              className="landing-google-btn"
              onClick={initiateGoogleLogin}
              disabled={googleLoading}
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>{' '}
              {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
            </button>
          </div>

          {/* REGISTER */}
          <div className={`landing-modal-form ${activeTab === 'register' ? 'active' : ''}`}>
            {regStatus.text && (
              <div className={`modal-status ${regStatus.type}`}>
                {regStatus.text}
              </div>
            )}
            <form onSubmit={handleRegister}>
              <input
                type="text"
                className="landing-input-field"
                placeholder="Full Name"
                value={regName}
                onChange={e => setRegName(e.target.value)}
              />
              <input
                type="text"
                className="landing-input-field"
                placeholder="Address (optional)"
                value={regAddress}
                onChange={e => setRegAddress(e.target.value)}
              />
              <input
                type="email"
                className="landing-input-field"
                placeholder="Gmail address"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
              />
              <div className="password-wrapper">
                <div className="floating-input-group" style={{ margin: 0 }}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    className="landing-input-field"
                    placeholder="Password (min 6)"
                    value={regPassword}
                    onChange={e => {
                      setRegPassword(e.target.value);
                      calculateRegisterPasswordStrength(e.target.value);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <i className="fas fa-eye-slash" aria-hidden /> : <i className="fas fa-eye" aria-hidden />}
                </button>
              </div>

              <div className="strength-bar" style={{ marginTop: 10 }}>
                <div
                  className="strength-fill"
                  style={{
                    width: registerPasswordStrength.pct,
                    backgroundColor: registerPasswordStrength.color,
                  }}
                />
              </div>
              <p
                className="strength-label"
                style={{
                  color: registerPasswordStrength.color !== 'transparent' ? registerPasswordStrength.color : '#8e9ab0',
                  marginTop: 6,
                }}
              >
                {registerPasswordStrength.text}
              </p>

              <div className="password-wrapper">
                <div className="floating-input-group" style={{ margin: 0 }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="landing-input-field"
                    placeholder="Confirm password"
                    value={regConfirm}
                    onChange={e => setRegConfirm(e.target.value)}
                  />
                </div>
              <button
                type="button"
                className="eye-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <i className="fas fa-eye-slash" aria-hidden /> : <i className="fas fa-eye" aria-hidden />}
              </button>
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="landing-submit-btn"
              >
                {isRegistering ? 'Creating...' : 'Create Account'}
              </button>
            </form>
            <hr className="landing-hr" />
            <button
              type="button"
              className="landing-google-btn"
              onClick={initiateGoogleLogin}
              disabled={googleLoading}
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>{' '}
              {googleLoading ? 'Redirecting to Google…' : 'Sign up with Google'}
            </button>
          </div>

          {/* RESET PASSWORD */}
          <div className={`landing-modal-form ${activeTab === 'reset' ? 'active' : ''}`}>
            <div className="step-indicator">
              <div className={`step-bubble ${resetStep >= 1 ? 'active' : ''} ${resetStep > 1 ? 'done' : ''}`}>
                {resetStep > 1 ? '✓' : '1'}
              </div>
              <div className={`step-line ${resetStep > 1 ? 'done' : ''}`} />
              <div className={`step-bubble ${resetStep >= 2 ? 'active' : ''} ${resetStep > 2 ? 'done' : ''}`}>
                {resetStep > 2 ? '✓' : '2'}
              </div>
              <div className={`step-line ${resetStep > 2 ? 'done' : ''}`} />
              <div className={`step-bubble ${resetStep >= 3 ? 'active' : ''} ${resetStep > 3 ? 'done' : ''}`}>
                {resetStep > 3 ? '✓' : '3'}
              </div>
            </div>
            {renderResetStep()}
          </div>

        </div>
      </div>

      {/* INFO MODAL */}
      <div className={`landing-modal ${infoModalContent ? 'active' : ''}`} onClick={() => setInfoModalContent(null)}>
        <div className="landing-modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'center', padding: '2.5rem' }}>
          <span className="landing-modal-close" onClick={() => setInfoModalContent(null)}>
            &times;
          </span>
          <h2 style={{ marginBottom: '1.5rem', color: 'white', fontSize: '1.5rem' }}>{infoModalContent?.title}</h2>
          <p style={{ color: '#9ca3af', lineHeight: '1.6', fontSize: '1rem', marginBottom: '2rem' }}>
            {infoModalContent?.body}
          </p>
          <button 
            className="premium-btn-primary" 
            style={{ width: '100%', padding: '12px 24px' }}
            onClick={() => setInfoModalContent(null)}
          >
            I Understand
          </button>
        </div>
      </div>

      {/* SUCCESS MODAL */}
      <div className={`landing-modal ${successDialogContent ? 'active' : ''}`} style={{ zIndex: 10000 }}>
        <div className="landing-modal-container" style={{ maxWidth: '400px', textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '3rem', color: 'var(--found)', marginBottom: '1rem' }}>
            <i className="fas fa-check-circle"></i>
          </div>
          <h2 style={{ marginBottom: '1rem', color: 'white', fontSize: '1.5rem' }}>{successDialogContent?.title}</h2>
          <p style={{ color: '#9ca3af', lineHeight: '1.6', fontSize: '1rem', marginBottom: '2rem' }}>
            {successDialogContent?.message}
          </p>
          <button 
            className="premium-btn-primary" 
            style={{ width: '100%', padding: '12px 24px' }}
            onClick={() => setSuccessDialogContent(null)}
          >
            Continue
          </button>
        </div>
      </div>

      {/* ACCOUNT SUSPENDED MODAL */}
      {suspendedDialog && (
        <SuspendedAccountModal
          reason={suspendedDialog.reason}
          onClose={() => setSuspendedDialog(null)}
        />
      )}
    </div>
  );
};
