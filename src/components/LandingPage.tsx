import React, { useState, useEffect, useRef } from 'react';
import '../styles/premium-landing.css';
import { SuspendedAccountModal, parseSuspensionReason } from './SuspendedAccountModal';
import { validateEmailAuthenticity, getEmailDomainSuggestions } from '../utils/emailValidation';

import backpackImg from '../assets/blue_backpack.png';
import headphonesImg from '../assets/beige_headphones.png';
import walletImg from '../assets/brown_wallet.png';

import catElectronicsImg from '../assets/category_electronics.png';
import catDocumentsImg from '../assets/category_documents.png';
import catKeysImg from '../assets/category_keys.png';
import catBagsImg from '../assets/category_bags.png';
import catJewelryImg from '../assets/category_jewelry.png';

interface LandingPageProps {
  apiBase: string;
  onLoginSuccess: (token: string, userData: any) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ apiBase, onLoginSuccess, showToast }) => {
  const [hasEntered, setHasEntered] = useState(() => sessionStorage.getItem('findit_has_entered') === 'true');
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
  const [showRegPassword, setShowRegPassword] = useState(false);
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
  const [passwordStrength, setPasswordStrength] = useState({ pct: '0%', color: 'transparent', text: '' });
  const [registerPasswordStrength, setRegisterPasswordStrength] = useState({ pct: '0%', color: 'transparent', text: '' });
  const [resetPassStatus, setResetPassStatus] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Magic Login Link states
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkResult, setMagicLinkResult] = useState<{ message: string; magicLink?: string } | null>(null);

  const handleSendMagicLink = async () => {
    if (!loginEmail.trim()) {
      showStatus(setLoginStatus, '❌ Please enter your email address first', 'error');
      return;
    }
    setIsSendingMagicLink(true);
    setMagicLinkResult(null);
    try {
      const res = await fetch(`${apiBase}/auth/send-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMagicLinkResult(data);
        showStatus(setLoginStatus, '✉️ Magic login link sent to your email!', 'success');
      } else {
        showStatus(setLoginStatus, data.message || 'Failed to send magic link.', 'error');
      }
    } catch {
      showStatus(setLoginStatus, '⚠️ Connection error to backend', 'error');
    } finally {
      setIsSendingMagicLink(false);
    }
  };

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
    // Reset scroll position on mount
    window.scrollTo(0, 0);

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
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
    if (!validateGmail(email)) return showStatus(setLoginStatus, '❌ Please enter a valid email address', 'error');

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
        setIsModalActive(false);
        setLoginStatus({ text: '', type: '' });
        onLoginSuccess(data.access_token, data.user);
      } else {
        const rawMsg = data.message;
        const message = Array.isArray(rawMsg) ? rawMsg.join(', ') : (rawMsg || 'Login failed. Check credentials.');
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
    if (isRegistering) return;

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
    const emailVal = validateEmailAuthenticity(email);
    if (!emailVal.isValidFormat) {
      return showStatus(setRegStatus, '❌ Please enter a valid email address', 'error');
    }
    if (emailVal.isDisposable) {
      return showStatus(setRegStatus, '⚠️ Temporary/Disposable emails are blocked. Please use your genuine email.', 'error');
    }
    if (emailVal.badgeType === 'typo' && emailVal.suggestedFix) {
      return showStatus(setRegStatus, `⚠️ Typo detected in email domain. Did you mean ${emailVal.suggestedFix}?`, 'error');
    }
    if (password.length < 6) {
      return showStatus(setRegStatus, '❌ Password must be at least 6 characters', 'error');
    }
    if (password !== confirm) {
      return showStatus(setRegStatus, '❌ Passwords do not match', 'error');
    }

    setIsRegistering(true);
    setRegStatus({ text: 'Creating account...', type: 'success' });
    try {
      const payload: any = { name, email, password };
      if (address) payload.address = address;

      const res = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setLoginEmail(email);
        setLoginPassword('');
        setRegName('');
        setRegEmail('');
        setRegPassword('');
        setRegConfirm('');
        setRegAddress('');
        setRegStatus({ text: '', type: '' });
        setActiveTab('login');
        showStatus(setLoginStatus, 'Account created successfully! Please log in.', 'success');
      } else {
        const rawMsg = data.message;
        const errMsg = Array.isArray(rawMsg) ? rawMsg.join(', ') : (rawMsg || 'Registration failed. Email might exist.');
        showStatus(setRegStatus, `❌ ${errMsg}`, 'error');
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
    if (!val) {
      setPasswordStrength({ pct: '0%', color: 'transparent', text: '' });
      return;
    }
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
      { pct: '25%', color: '#e74c3c', text: 'Weak' },
      { pct: '50%', color: '#f39c12', text: 'Fair' },
      { pct: '75%', color: '#2563eb', text: 'Good' },
      { pct: '100%', color: '#10b981', text: 'Strong ✓' },
    ];
    const index = Math.min(score, levels.length - 1);
    setPasswordStrength(levels[index]);
  };

  const calculateRegisterPasswordStrength = (val: string) => {
    if (!val) {
      setRegisterPasswordStrength({ pct: '0%', color: 'transparent', text: '' });
      return;
    }
    let score = 0;
    if (val.length >= 6) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
      { pct: '25%', color: '#e74c3c', text: 'Weak' },
      { pct: '50%', color: '#f39c12', text: 'Fair' },
      { pct: '75%', color: '#2563eb', text: 'Good' },
      { pct: '100%', color: '#10b981', text: 'Strong ✓' },
    ];
    const index = Math.min(score, levels.length - 1);
    setRegisterPasswordStrength(levels[index]);
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
    setShowLoginPassword(false);
    setRegName('');
    setRegAddress('');
    setRegEmail('');
    setRegPassword('');
    setRegConfirm('');
    setShowRegPassword(false);
    setRegisterPasswordStrength({ pct: '0%', color: 'transparent', text: '' });
    setPasswordStrength({ pct: '0%', color: 'transparent', text: '' });
    setResetEmail('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
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
            <h2>Forgot Password?</h2>
            <p className="form-sub-heading">Enter your email to receive a reset code</p>
            {resetEmailStatus.text && (
              <div className={`modal-status ${resetEmailStatus.type}`}>
                {resetEmailStatus.text}
              </div>
            )}
            <div className="form-group-field">
              <label>Email Address</label>
              <input
                type="email"
                className="landing-input-field"
                placeholder="Enter your email"
                autoComplete="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSendOtp()}
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={isSendingOtp}
              className="landing-submit-btn"
            >
              {isSendingOtp ? <><span className="loading-spinner"></span> Sending...</> : 'Send Reset Code'}
            </button>
            <div className="modal-footer-text">
              <span className="auth-switch-link" onClick={() => setActiveTab('login')}><i className="fas fa-arrow-left"></i> Back to login</span>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="reset-step active">
            <h2>Enter OTP Code</h2>
            <p className="form-sub-heading">Code sent to {resetOtpSentEmail}</p>
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
              {isVerifyingOtp ? <><span className="loading-spinner"></span> Verifying...</> : 'Verify Code'}
            </button>
            <div className="modal-footer-text">
              <span className="auth-switch-link" onClick={() => setActiveTab('login')}><i className="fas fa-arrow-left"></i> Back to login</span>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="reset-step active">
            <h2>Create New Password</h2>
            <p className="form-sub-heading">Choose a strong new password</p>
            {resetPassStatus.text && (
              <div className={`modal-status ${resetPassStatus.type}`}>
                {resetPassStatus.text}
              </div>
            )}
            <div className="form-group-field">
              <label>New Password</label>
              <div className="password-wrapper">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="landing-input-field"
                  placeholder="Enter new password (min 8 chars)"
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value);
                    calculatePasswordStrength(e.target.value);
                  }}
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <i className="fas fa-eye-slash" aria-hidden /> : <i className="fas fa-eye" aria-hidden />}
                </button>
              </div>
              <div className="strength-bar" style={{ marginTop: 6 }}>
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
                style={{
                  color: passwordStrength.color !== 'transparent' ? passwordStrength.color : '#8e9ab0',
                  marginTop: 4
                }}
              >
                {passwordStrength.text}
              </p>
            </div>

            <div className="form-group-field">
              <label>Confirm Password</label>
              <div className="password-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="landing-input-field"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleResetPassword()}
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <i className="fas fa-eye-slash" aria-hidden /> : <i className="fas fa-eye" aria-hidden />}
                </button>
              </div>
            </div>

            <button
              onClick={handleResetPassword}
              disabled={isResettingPassword}
              className="landing-submit-btn"
            >
              {isResettingPassword ? <><span className="loading-spinner"></span> Resetting...</> : 'Reset Password'}
            </button>
            <div className="modal-footer-text">
              <span className="auth-switch-link" onClick={() => setActiveTab('login')}><i className="fas fa-arrow-left"></i> Back to login</span>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="reset-step active">
            <div className="success-checkmark">
              <div className="checkmark-circle">✓</div>
              <h3>Password Reset!</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '8px 0 24px', lineHeight: '1.5' }}>
                Your password has been updated successfully. You can now log in with your new credentials.
              </p>
              <button
                className="landing-submit-btn"
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
          <button className="gateway-btn" onClick={() => { setHasEntered(true); sessionStorage.setItem('findit_has_entered', 'true'); }}>
            Enter Experience
          </button>
        </div>
      </div>

      {/* HEADER NAVBAR */}
      <header className="landing-header">
        <div className="landing-logo">
          <div className="logo-icon"><i className="fas fa-search"></i></div>
          <span>FINDIT</span>
        </div>
        <nav className="landing-nav">
          <a href="#home">Home</a>
          <a href="#features">How It Works</a>
          <a href="#categories">Categories</a>
          <a href="#safety">Safety</a>
          <a href="#about">About Us</a>
        </nav>
        <div className="landing-nav-actions">
          <button className="nav-btn-login" onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('login'); }}>Log In</button>
          <button className="nav-btn-signup" onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('register'); }}>Sign Up</button>
        </div>
      </header>

      <div className="landing-content">
        {/* HERO SECTION */}
        <div className="premium-hero" id="home">
          <div className="hero-left-content">
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
                  setActiveTab('register');
                }}
              >
                Report Lost Item
              </button>
              <button className="premium-btn-secondary" onClick={handleLearnMore}>
                Browse Found Items
              </button>
            </div>

            <div className="hero-features-list">
              <div className="hero-feature-item">
                <div className="hero-feature-icon"><i className="fas fa-brain"></i></div>
                <div className="hero-feature-text">
                  <strong>AI Smart Matching</strong>
                  <span>Advanced AI finds your items faster</span>
                </div>
              </div>
              <div className="hero-feature-item">
                <div className="hero-feature-icon"><i className="fas fa-bell"></i></div>
                <div className="hero-feature-text">
                  <strong>Real-time Alerts</strong>
                  <span>Instant notifications when matches found</span>
                </div>
              </div>
              <div className="hero-feature-item">
                <div className="hero-feature-icon"><i className="fas fa-check-circle"></i></div>
                <div className="hero-feature-text">
                  <strong>Secure & Verified</strong>
                  <span>Safe verification and secure claims</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-right-cards">
            <div className="card-item backpack-card">
              <img src={backpackImg} alt="Blue Backpack" />
            </div>
            <div className="card-item headphones-card">
              <img src={headphonesImg} alt="Beige Headphones" />
            </div>
            <div className="card-item wallet-card">
              <img src={walletImg} alt="Brown Wallet" />
            </div>
            <div className="match-card">
              <div className="match-icon"><i className="fas fa-check-circle"></i></div>
              <div className="match-info">
                <strong>Match Found!</strong>
                <span>Your lost backpack might have been found.</span>
                <button className="match-btn" onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('login'); }}>View Details</button>
              </div>
            </div>
            <div className="decor-dots"></div>
          </div>
        </div>

        {/* STATISTICS ROW */}
        <div className="premium-stats-container animate-on-scroll" ref={statsRef}>
          <div className="premium-stats-grid">
            <div className="premium-stat-card">
              <div className="premium-stat-icon">
                <i className="fas fa-users" />
              </div>
              <div className="premium-stat-num">{countUsers}+</div>
              <div className="premium-stat-label">Active Users</div>
              <div className="premium-stat-sub">Verified community members</div>
            </div>

            <div className="premium-stat-card">
              <div className="premium-stat-icon">
                <i className="fas fa-box-open" />
              </div>
              <div className="premium-stat-num">{countItems}+</div>
              <div className="premium-stat-label">Items Recovered</div>
              <div className="premium-stat-sub">Reunited with rightful owners</div>
            </div>

            <div className="premium-stat-card">
              <div className="premium-stat-icon">
                <i className="fas fa-chart-line" />
              </div>
              <div className="premium-stat-num">{countRate}%</div>
              <div className="premium-stat-label">Success Rate</div>
              <div className="premium-stat-sub">AI-assisted recovery precision</div>
            </div>
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
        <div className="premium-section animate-on-scroll" id="categories" style={{ paddingTop: 0 }}>
          <h2 className="premium-section-title" style={{ marginBottom: '2.5rem' }}>Commonly Recovered Items</h2>
          <div className="category-grid">
            {[
              { img: catElectronicsImg, name: 'Electronics', desc: 'Phones, laptops, earbuds' },
              { img: catDocumentsImg, name: 'Documents', desc: 'IDs, passports, wallets' },
              { img: catKeysImg, name: 'Keys', desc: 'Car keys, house keys' },
              { img: catBagsImg, name: 'Bags', desc: 'Backpacks, luggage' },
              { img: catJewelryImg, name: 'Jewelry', desc: 'Rings, watches' },
            ].map((cat, idx) => (
              <div key={cat.name} className={`category-card animate-on-scroll stagger-${(idx % 5) + 1}`}>
                <div className="category-img-wrapper">
                  <img src={cat.img} alt={cat.name} className="category-real-img" />
                </div>
                <h4>{cat.name}</h4>
                <p>{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SECURITY HIGHLIGHT */}
        <div className="premium-section animate-on-scroll" id="safety" style={{ paddingTop: 0 }}>
          <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)', border: '1px solid #dbeafe', borderRadius: '24px', padding: '3rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50%', left: '-20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }}></div>
            <h2 style={{ color: '#1e3a8a', fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Your Data is Secure With Us</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '700px', margin: '0 auto', lineHeight: '1.6', fontSize: '1.05rem' }}>
              We prioritize your privacy and safety. All personal information is encrypted. Our smart matching algorithm ensures you only interact with verified individuals, and your contact details are never shared without your explicit consent. Focus on finding your items, we'll handle the security.
            </p>
          </div>
        </div>

        {/* TESTIMONIALS SECTION */}
        <div className="premium-section animate-on-scroll" id="about">
          <h2 className="premium-section-title">Community Trust</h2>
          <div className="testimonial-carousel">
            <div className="testimonial-card">
              <div className="testimonial-avatar">👤</div>
              <div className="testimonial-content">
                <p className="testimonial-text">"{testimonials[currentTestimonial].text}"</p>
                {(testimonials[currentTestimonial] as any).adminResponse && (
                  <div style={{
                    background: 'rgba(37,99,235,0.06)',
                    border: '1px solid rgba(37,99,235,0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginTop: '12px',
                    fontSize: '0.82rem',
                    color: '#1d4ed8',
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
        <footer className="landing-footer">
          <div className="footer-container">
            <div className="footer-top-grid">
              {/* Brand Info Column */}
              <div className="footer-brand-col">
                <div className="footer-brand">
                  <div className="footer-logo-mark">
                    <i className="fas fa-search-location"></i>
                  </div>
                  <span className="footer-logo-text">FIND<span>IT</span></span>
                </div>
                <p className="footer-brand-desc">
                  Reconnecting people with what matters most through AI-driven matching and secure community reporting.
                </p>
                <div className="footer-socials">
                  <a href="https://facebook.com" target="_blank" rel="noreferrer" className="social-pill" aria-label="Facebook">
                    <i className="fab fa-facebook-f"></i>
                  </a>
                  <a href="https://twitter.com" target="_blank" rel="noreferrer" className="social-pill" aria-label="Twitter">
                    <i className="fab fa-twitter"></i>
                  </a>
                  <a href="https://instagram.com" target="_blank" rel="noreferrer" className="social-pill" aria-label="Instagram">
                    <i className="fab fa-instagram"></i>
                  </a>
                  <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="social-pill" aria-label="LinkedIn">
                    <i className="fab fa-linkedin-in"></i>
                  </a>
                </div>
              </div>

              {/* Column 1: Platform */}
              <div className="footer-col">
                <h4>Platform</h4>
                <ul>
                  <li><a href="#features">How It Works</a></li>
                  <li><a href="#features">AI Matching</a></li>
                  <li><a href="#categories">Recovered Items</a></li>
                  <li><a href="#about">Community Trust</a></li>
                </ul>
              </div>

              {/* Column 2: Categories */}
              <div className="footer-col">
                <h4>Categories</h4>
                <ul>
                  <li><a href="#categories">Electronics</a></li>
                  <li><a href="#categories">Documents & IDs</a></li>
                  <li><a href="#categories">Keys & Fobs</a></li>
                  <li><a href="#categories">Bags & Luggage</a></li>
                  <li><a href="#categories">Jewelry & Watches</a></li>
                </ul>
              </div>

              {/* Column 3: Legal & Help */}
              <div className="footer-col">
                <h4>Legal & Help</h4>
                <ul>
                  <li>
                    <a href="#" onClick={(e) => { e.preventDefault(); setInfoModalContent({title: 'Privacy Policy', body: 'We value your privacy. All your data is encrypted and secure. We will never sell or misuse your personal information. Your identity is kept anonymous until you choose to reveal it during item verification.'}); }}>
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => { e.preventDefault(); setInfoModalContent({title: 'Terms of Service', body: 'By using Findit, you agree to treat other community members with respect. You may only claim items that legitimately belong to you. Fraudulent claims will result in immediate permanent account suspension.'}); }}>
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => { e.preventDefault(); setInfoModalContent({title: 'Contact Us', body: 'Need help? You can reach our support team 24/7 at support@findit.gmail.com. We typically respond within 2-4 hours.'}); }}>
                      Contact Us
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="footer-bottom-bar">
              <div className="footer-copyright">
                © {new Date().getFullYear()} FindIT Technologies Inc. All rights reserved.
              </div>
              <div className="footer-badges">
                <span>🔒 256-bit Encrypted</span>
                <span>⚡ Instant AI Match</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* AUTH MODAL */}
      <div className={`landing-modal ${isModalActive ? 'active' : ''}`} onClick={() => setIsModalActive(false)}>
        <div className="landing-modal-container" onClick={e => e.stopPropagation()}>
          <span className="landing-modal-close" onClick={() => setIsModalActive(false)}>
            &times;
          </span>

          {/* LEFT SPLIT PANE */}
          <div className="landing-modal-left">
            {activeTab === 'login' && (
              <>
                <div className="modal-pane-icon">
                  <i className="fas fa-shield-alt"></i>
                </div>
                <h3>Secure Login</h3>
                <p>Your security is our priority. We keep your data safe and protected.</p>
              </>
            )}
            {activeTab === 'register' && (
              <>
                <div className="modal-pane-icon">
                  <i className="fas fa-user-friends"></i>
                </div>
                <h3>Create Account</h3>
                <p>Join our helpful community to start tracking and recovering lost items.</p>
              </>
            )}
            {activeTab === 'reset' && (
              <>
                <div className="modal-pane-icon">
                  <i className="fas fa-lock"></i>
                </div>
                <h3>{resetStep === 3 ? 'Create New Password' : 'Reset Password'}</h3>
                <p>{resetStep === 3 ? 'Choose a strong password to keep your account secure.' : 'No worries! Enter your email and we\'ll send you a link to reset your password.'}</p>
              </>
            )}
          </div>

          {/* RIGHT SPLIT PANE */}
          <div className="landing-modal-right">
            {/* LOGIN TAB */}
            <div className={`landing-modal-form ${activeTab === 'login' ? 'active' : ''}`}>
              <h2>Welcome Back</h2>
              <p className="form-sub-heading">Sign in to continue to your account</p>
              {loginStatus.text && (
                <div className={`modal-status ${loginStatus.type}`}>
                  {loginStatus.text}
                </div>
              )}
              <form onSubmit={handleLogin}>
                <div className="form-group-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label>Email Address</label>
                    {loginEmail && (() => {
                      const val = validateEmailAuthenticity(loginEmail);
                      if (val.badgeType === 'genuine') {
                        return <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, background: '#dcfce7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #86efac' }}>✓ {val.providerLabel}</span>;
                      }
                      if (val.badgeType === 'edu') {
                        return <span style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 600, background: '#dbeafe', padding: '2px 8px', borderRadius: '6px', border: '1px solid #93c5fd' }}>🎓 {val.providerLabel}</span>;
                      }
                      return null;
                    })()}
                  </div>
                  <input
                    type="email"
                    className="landing-input-field"
                    placeholder="Enter your email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                  />
                  {loginEmail && (() => {
                    const val = validateEmailAuthenticity(loginEmail);
                    if (val.badgeType === 'typo' && val.suggestedFix) {
                      return (
                        <div style={{ marginTop: '6px', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>Did you mean <strong>{val.suggestedFix}</strong>?</span>
                          <button
                            type="button"
                            onClick={() => setLoginEmail(val.suggestedFix!)}
                            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Fix Email
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="form-group-field">
                  <label>Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      className="landing-input-field"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="eye-toggle"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <i className="fas fa-eye-slash" aria-hidden /> : <i className="fas fa-eye" aria-hidden />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="landing-forgot-link"
                  onClick={() => {
                    setActiveTab('reset');
                    setResetStep(1);
                  }}
                >
                  Forgot password?
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="landing-submit-btn"
                >
                  {isLoggingIn ? 'Logging in...' : 'Log In'}
                </button>
              </form>

              <div className="divider-row"><span>Or sign in with Magic Email Link</span></div>

              <button
                type="button"
                onClick={handleSendMagicLink}
                disabled={isSendingMagicLink || !loginEmail}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: loginEmail ? 'pointer' : 'not-allowed',
                  opacity: loginEmail ? 1 : 0.65,
                  transition: 'all 0.2s',
                  marginBottom: '14px',
                }}
              >
                <i className="fas fa-envelope-open-text" style={{ fontSize: '1.05rem', color: '#2563eb' }}></i>
                {isSendingMagicLink ? 'Sending Link to Email...' : '📧 Send Direct Login Link to Gmail'}
              </button>

              {magicLinkResult && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px', marginBottom: '16px', fontSize: '0.85rem', color: '#166534' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fas fa-check-circle" style={{ color: '#22c55e', fontSize: '1.1rem' }}></i>
                    Login Link Sent!
                  </div>
                  <p style={{ margin: '0 0 10px 0', lineHeight: 1.4 }}>
                    We've sent a direct login link to <strong>{loginEmail}</strong>.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <a
                      href="https://mail.google.com"
                      target="_blank"
                      rel="noreferrer"
                      style={{ background: '#ea4335', color: '#fff', padding: '7px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <i className="fab fa-google"></i> Open Gmail Inbox
                    </a>
                    {magicLinkResult.magicLink && (
                      <a
                        href={magicLinkResult.magicLink}
                        style={{ background: '#2563eb', color: '#fff', padding: '7px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        🚀 1-Click Login Now
                      </a>
                    )}
                  </div>
                </div>
              )}
              <div className="divider-row"><span>Or continue with</span></div>
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
                {googleLoading ? 'Redirecting...' : 'Google'}
              </button>
              <div className="modal-footer-text">
                Don't have an account? <span className="auth-switch-link" onClick={() => setActiveTab('register')}>Sign up</span>
              </div>
            </div>

            {/* REGISTER TAB */}
            <div className={`landing-modal-form ${activeTab === 'register' ? 'active' : ''}`}>
              <h2>Create Account</h2>
              <p className="form-sub-heading">Sign up to get started</p>
              {regStatus.text && (
                <div className={`modal-status ${regStatus.type}`}>
                  {regStatus.text}
                </div>
              )}
              <form onSubmit={handleRegister}>
                <div className="form-group-field">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="landing-input-field"
                    placeholder="Enter your full name"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                  />
                </div>
                <div className="form-group-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label>Email Address</label>
                    {regEmail && (() => {
                      const val = validateEmailAuthenticity(regEmail);
                      if (val.badgeType === 'genuine') {
                        return <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, background: '#dcfce7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #86efac' }}>✓ {val.providerLabel}</span>;
                      }
                      if (val.badgeType === 'edu') {
                        return <span style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 600, background: '#dbeafe', padding: '2px 8px', borderRadius: '6px', border: '1px solid #93c5fd' }}>🎓 {val.providerLabel}</span>;
                      }
                      if (val.badgeType === 'disposable') {
                        return <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600, background: '#fee2e2', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fca5a5' }}>⚠️ Disposable Email Blocked</span>;
                      }
                      if (val.badgeType === 'typo') {
                        return <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600, background: '#fef3c7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fde68a' }}>⚠️ Domain Typo</span>;
                      }
                      return null;
                    })()}
                  </div>
                  <input
                    type="email"
                    className="landing-input-field"
                    placeholder="Enter your email (e.g. user@gmail.com)"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                  />

                  {/* TYPO FIX & DISPOSABLE WARNING BANNER */}
                  {regEmail && (() => {
                    const val = validateEmailAuthenticity(regEmail);
                    if (val.badgeType === 'typo' && val.suggestedFix) {
                      return (
                        <div style={{ marginTop: '6px', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>Did you mean <strong>{val.suggestedFix}</strong>?</span>
                          <button
                            type="button"
                            onClick={() => setRegEmail(val.suggestedFix!)}
                            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Fix Email
                          </button>
                        </div>
                      );
                    }
                    if (val.badgeType === 'disposable') {
                      return (
                        <div style={{ marginTop: '6px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.8rem', color: '#991b1b' }}>
                          ⚠️ Temporary/disposable email domains are blocked to prevent fraud. Please use your genuine email address.
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* DOMAIN QUICK-FILL SUGGESTIONS */}
                  {regEmail.includes('@') && !regEmail.split('@')[1]?.includes('.') && (() => {
                    const suggestions = getEmailDomainSuggestions(regEmail);
                    if (suggestions.length > 0) {
                      return (
                        <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>Quick suggestions:</span>
                          {suggestions.map((sug, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setRegEmail(sug)}
                              style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', cursor: 'pointer', fontWeight: 600 }}
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="form-group-field">
                  <label>Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      className="landing-input-field"
                      placeholder="Create a password"
                      value={regPassword}
                      onChange={e => {
                        setRegPassword(e.target.value);
                        calculateRegisterPasswordStrength(e.target.value);
                      }}
                    />
                    <button
                      type="button"
                      className="eye-toggle"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <i className="fas fa-eye-slash" aria-hidden /> : <i className="fas fa-eye" aria-hidden />}
                    </button>
                  </div>
                  <div className="strength-bar">
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
                      marginTop: 4,
                    }}
                  >
                    {registerPasswordStrength.text}
                  </p>
                </div>

                <div className="form-group-field">
                  <label>Confirm Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="landing-input-field"
                      placeholder="Confirm your password"
                      value={regConfirm}
                      onChange={e => setRegConfirm(e.target.value)}
                    />
                    <button
                      type="button"
                      className="eye-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <i className="fas fa-eye-slash" aria-hidden /> : <i className="fas fa-eye" aria-hidden />}
                    </button>
                  </div>
                </div>

                <div className="form-group-field">
                  <label>Address (optional)</label>
                  <input
                    type="text"
                    className="landing-input-field"
                    placeholder="Enter your address"
                    value={regAddress}
                    onChange={e => setRegAddress(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  onClick={handleRegister}
                  disabled={isRegistering}
                  className="landing-submit-btn"
                >
                  {isRegistering ? 'Creating...' : 'Sign Up'}
                </button>
              </form>
              <div className="divider-row"><span>Or continue with</span></div>
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
                {googleLoading ? 'Redirecting...' : 'Google'}
              </button>
              <div className="modal-footer-text">
                Already have an account? <span className="auth-switch-link" onClick={() => setActiveTab('login')}>Log in</span>
              </div>
            </div>

            {/* RESET PASSWORD TAB */}
            <div className={`landing-modal-form ${activeTab === 'reset' ? 'active' : ''}`}>
              <div className="step-indicator" style={{ display: 'none' }}>
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
      </div>

      {/* INFO MODAL */}
      <div className={`landing-modal ${infoModalContent ? 'active' : ''}`} onClick={() => setInfoModalContent(null)}>
        <div className="landing-modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'center', padding: '2.5rem', display: 'block', height: 'auto' }}>
          <span className="landing-modal-close" onClick={() => setInfoModalContent(null)}>
            &times;
          </span>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.5rem', display: 'block' }}>{infoModalContent?.title}</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '1rem', marginBottom: '2rem' }}>
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
        <div className="landing-modal-container" style={{ maxWidth: '400px', textAlign: 'center', padding: '2.5rem', display: 'block', height: 'auto' }}>
          <div style={{ fontSize: '3rem', color: 'var(--found)', marginBottom: '1rem' }}>
            <i className="fas fa-check-circle"></i>
          </div>
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.5rem', display: 'block' }}>{successDialogContent?.title}</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '1rem', marginBottom: '2rem' }}>
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
