import React, { useState, useEffect, useRef } from 'react';
import '../styles/premium-landing.css';
import { SuspendedAccountModal, parseSuspensionReason } from './SuspendedAccountModal';
import { validateEmailAuthenticity, getEmailDomainSuggestions } from '../utils/emailValidation';



import catElectronicsImg from '../assets/category_electronics.png';

import dummyWallet from '../assets/dummy_wallet.jpg';
import dummyIphone from '../assets/dummy_iphone.jpg';
import dummyBackpack from '../assets/dummy_backpack.jpg';
import dummyKeys from '../assets/dummy_keys.jpg';
import dummyIdCard from '../assets/category_documents.png';
import dummyWatch from '../assets/category_jewelry.png';


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
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('findit_dark_mode') === 'true');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
      showStatus(setLoginStatus, ' Please enter your email address first', 'error');
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
  const statsRef = useRef<HTMLDivElement>(null);

  // Count-up animation state
  const [countUsers, setCountUsers] = useState(0);
  const [countItems, setCountItems] = useState(0);
  const [countRate, setCountRate] = useState(0);

  // Data for advanced features
  const [platformReviews, setPlatformReviews] = useState<any[]>([]);
  const [allItems, setAllItems]               = useState<any[]>([]);

  // Dark mode effect
  useEffect(() => {
    const root = document.querySelector('.premium-landing-body');
    if (root) {
      root.classList.toggle('dark-mode', isDarkMode);
    }
    localStorage.setItem('findit_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth > 768) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', closeOnDesktop);
    return () => window.removeEventListener('resize', closeOnDesktop);
  }, []);


  useEffect(() => {
    // Reset scroll position on mount
    window.scrollTo(0, 0);

    const fetchPlatformReviews = async () => {
      try {
        const res = await fetch(`${apiBase}/reviews/platform`);
        if (res.ok) {
          const data = await res.json();
          // Only show verified, high-quality reviews (rating >= 4)
          const topReviews = data.filter((r: any) => r.rating >= 4);
          setPlatformReviews(topReviews);
        }
      } catch (e) {
        console.warn('Failed to fetch platform reviews');
      }
    };

    const fetchAllItems = async () => {
      try {
        const res = await fetch(`${apiBase}/items`);
        if (res.ok) {
          const data = await res.json();
          setAllItems(data);
        }
      } catch (e) {
        console.warn('Failed to fetch items');
      }
    };

    fetchPlatformReviews();
    fetchAllItems();
  }, [apiBase]);

  // --- Derived data from allItems ---

  // Category definitions (icon + colour + mock initial counts) for Browse Categories
  const CATEGORIES = [
    { key: 'wallet',      label: 'Wallets',      icon: 'fa-wallet',        color: '#3b82f6', dummyCount: 312 },
    { key: 'phone',       label: 'Phones',        icon: 'fa-mobile-alt',    color: '#10b981', dummyCount: 278 },
    { key: 'bag',         label: 'Bags',          icon: 'fa-shopping-bag',  color: '#8b5cf6', dummyCount: 364 },
    { key: 'key',         label: 'Keys',          icon: 'fa-key',           color: '#f59e0b', dummyCount: 198 },
    { key: 'id card',     label: 'ID Cards',      icon: 'fa-id-card',       color: '#06b6d4', dummyCount: 126 },
    { key: 'accessory',   label: 'Accessories',   icon: 'fa-glasses',       color: '#f43f5e', dummyCount: 172 },
    { key: 'electronic',  label: 'Electronics',   icon: 'fa-headphones',    color: '#14b8a6', dummyCount: 145 },
    { key: 'other',       label: 'Others',        icon: 'fa-ellipsis-h',    color: '#94a3b8', dummyCount: 200 },
  ] as const;

  const categoryCounts = CATEGORIES.map(cat => {
    const realCount = allItems.filter(item =>
      item.category?.toLowerCase().includes(cat.key) ||
      (cat.key === 'other' && !CATEGORIES.slice(0, -1).some(c =>
        item.category?.toLowerCase().includes(c.key)
      ))
    ).length;
    return {
      ...cat,
      count: realCount + cat.dummyCount,
    };
  });

  // Recently Found – type=found, newest first
  const realFoundItems = allItems
    .filter(item => item.type === 'found' && item.status === 'active')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Dummy fallback/padding items
  const dummyFoundItems = [
    { id: 'd1', title: 'Wallet', location: 'New Road, Kathmandu', createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), imageFront: dummyWallet },
    { id: 'd2', title: 'iPhone 13', location: 'Thamel, Kathmandu', createdAt: new Date(Date.now() - 5 * 3600000).toISOString(), imageFront: dummyIphone },
    { id: 'd3', title: 'Black Backpack', location: 'Putalisadak, Kathmandu', createdAt: new Date(Date.now() - 24 * 3600000).toISOString(), imageFront: dummyBackpack },
    { id: 'd4', title: 'House Keys', location: 'Lazimpat, Kathmandu', createdAt: new Date(Date.now() - 24 * 3600000).toISOString(), imageFront: dummyKeys },
    { id: 'd5', title: 'ID Card', location: 'Boudha, Kathmandu', createdAt: new Date(Date.now() - 48 * 3600000).toISOString(), imageFront: dummyIdCard },
    { id: 'd6', title: 'Wrist Watch', location: 'Durbarmarg, Kathmandu', createdAt: new Date(Date.now() - 48 * 3600000).toISOString(), imageFront: dummyWatch },
  ];

  // Combine real found items first, then pad remaining slots with dummy items to always show 6
  const foundItems = [...realFoundItems, ...dummyFoundItems].slice(0, 6);

  // Relative time helper
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (days > 0)  return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (mins > 0)  return `${mins} min${mins > 1 ? 's' : ''} ago`;
    return 'just now';
  };

  const defaultAvatars = [
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  ];

  const dummyTestimonials = [
    {
      name: 'Sydney Cruz',
      location: 'Kathmandu',
      rating: 5,
      text: 'I lost my wallet with all my cards and cash. Thanks to FindIt, I got it back the very next day!',
      avatarUrl: defaultAvatars[0],
    },
    {
      name: 'Gem Wilson',
      location: 'Lalitpur',
      rating: 5,
      text: 'Amazing platform! I found an iPhone on the street and returned it to the owner through FindIt.',
      avatarUrl: defaultAvatars[1],
    },
    {
      name: 'Olivia Walker',
      location: 'Bhaktapur',
      rating: 5,
      text: 'Such a helpful community. We need more people and platforms like this.',
      avatarUrl: defaultAvatars[2],
    },
  ];

  const realTestimonials = platformReviews.map((r, i) => ({
    name: r.reviewer?.name || 'Anonymous',
    location: r.reviewer?.address || 'Nepal',
    rating: r.rating,
    text: r.comment,
    avatarUrl: r.image
      ? `${apiBase.replace('/api', '')}/uploads/reviews/${r.image}`
      : defaultAvatars[i % defaultAvatars.length],
  }));

  // Combine real testimonials and fallback dummy testimonials
  const testimonials = [...realTestimonials, ...dummyTestimonials];

  // Index of the first visible card (slides in steps of 3)
  const [carouselStart, setCarouselStart] = useState(0);
  const cardsPerPage = 3;

  const goPrev = () =>
    setCarouselStart(prev => Math.max(0, prev - cardsPerPage));
  const goNext = () =>
    setCarouselStart(prev =>
      prev + cardsPerPage < testimonials.length ? prev + cardsPerPage : 0
    );



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
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Auto-rotate carousel every 6 seconds
  useEffect(() => {
    const interval = setInterval(goNext, 6000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testimonials.length]);

  // Count-up animation when stats section is visible
  useEffect(() => {
    if (!statsVisible) return;
    const duration = 800; // ms
    const startTime = performance.now();
    let animationFrameId: number;

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // Ease out quad formula for smooth decelerating count-up
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      setCountUsers(Math.floor(easeProgress * 100));
      setCountItems(Math.floor(easeProgress * 5));
      setCountRate(Math.floor(easeProgress * 98));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setCountUsers(100);
        setCountItems(5);
        setCountRate(98);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
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
      showStatus(setLoginStatus, '⚠️ Backend not reachable. Please check your connection or API URL.', 'error');
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
      <div className="premium-bg-backdrop-image"></div>

      {/* GATEWAY ENTRY SCREEN */}
      <div className={`gateway-screen ${hasEntered ? 'entered' : ''}`} style={hasEntered ? { display: 'none' } : {}}>
        <div className="gateway-bg-glow"></div>
        <div className="gateway-logo-container">
          <div className="gateway-logo">FINDIT</div>
          <button className="gateway-btn" onClick={() => { setHasEntered(true); sessionStorage.setItem('findit_has_entered', 'true'); }}>
            Enter Experience
          </button>
        </div>
      </div>

      {/* HEADER NAVBAR */}
      <header className={`landing-header${isMobileMenuOpen ? ' menu-open' : ''}`}>
        <div className="landing-logo">
          <div className="logo-icon"><i className="fas fa-search"></i></div>
          <span>FINDIT</span>
        </div>

        <nav id="landing-nav" className={`landing-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <a href="#home" onClick={() => setIsMobileMenuOpen(false)}>Home</a>
          <a href="#features" onClick={() => setIsMobileMenuOpen(false)}>How It Works</a>
          <a href="#categories" onClick={() => setIsMobileMenuOpen(false)}>Categories</a>
          <a href="#safety" onClick={() => setIsMobileMenuOpen(false)}>Safety</a>
          <a href="#about" onClick={() => setIsMobileMenuOpen(false)}>About Us</a>
          <div className="landing-nav-mobile-cta">
            <button className="nav-btn-login" onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('login'); setIsMobileMenuOpen(false); }}>Log In</button>
            <button className="nav-btn-signup" onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('register'); setIsMobileMenuOpen(false); }}>Sign Up</button>
          </div>
        </nav>
        <div className="landing-nav-actions">
          <button type="button" className="dark-mode-toggle" onClick={toggleDarkMode} title={isDarkMode ? 'Light Mode' : 'Dark Mode'} aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button className="nav-btn-login nav-btn-desktop" onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('login'); setIsMobileMenuOpen(false); }}>Log In</button>
          <button className="nav-btn-signup nav-btn-desktop" onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('register'); setIsMobileMenuOpen(false); }}>Sign Up</button>
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="landing-nav"
          >
            <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
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
            <div className="card-item gadgets-card">
              <img src={catElectronicsImg} alt="Electronics" />
            </div>
            <div className="card-item headphones-card">
              <img src={dummyKeys} alt="Keys" />
            </div>
            <div className="card-item wallet-card">
              <img src={dummyWallet} alt="Wallet" />
            </div>
            <div className="match-card">
              <div className="match-icon"><i className="fas fa-check-circle"></i></div>
              <div className="match-info">
                <strong>Match Found!</strong>
                <span>Your lost electronic gadget might have been found.</span>
                <button className="match-btn" onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('login'); }}>View Details</button>
              </div>
            </div>

          </div>
        </div>

        {/* STATISTICS ROW */}
        <div className="premium-stats-container animate-on-scroll" ref={statsRef}>
          <div className="premium-stats-grid">
            <div className="premium-stat-card stat-card-blue">
              <div className="premium-stat-icon">
                <i className="fas fa-users" />
              </div>
              <div className="premium-stat-num">{countUsers}+</div>
              <div className="premium-stat-label">Active Users</div>
              <div className="premium-stat-sub">Verified community members</div>
            </div>

            <div className="premium-stat-card stat-card-green">
              <div className="premium-stat-icon">
                <i className="fas fa-box-open" />
              </div>
              <div className="premium-stat-num">{countItems}+</div>
              <div className="premium-stat-label">Items Recovered</div>
              <div className="premium-stat-sub">Reunited with rightful owners</div>
            </div>

            <div className="premium-stat-card stat-card-purple">
              <div className="premium-stat-icon">
                <i className="fas fa-chart-line" />
              </div>
              <div className="premium-stat-num">{countRate}%</div>
              <div className="premium-stat-label">Success Rate</div>
              <div className="premium-stat-sub">AI-assisted recovery precision</div>
            </div>
          </div>
        </div>

        {/* VERTICAL ANIMATED FEATURE CARDS */}
        {/* ── BROWSE CATEGORIES ── */}
        <div className="browse-categories-section animate-on-scroll" id="categories">
          <div className="browse-cat-header">
            <h2 className="browse-cat-title">Browse Categories</h2>
            <button
              className="browse-cat-viewall"
              onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('login'); }}
            >
              View All Categories <i className="fas fa-arrow-right" />
            </button>
          </div>
          <div className="browse-cat-grid">
            {categoryCounts.map(cat => (
              <button
                key={cat.key}
                className="browse-cat-chip"
                onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('login'); }}
              >
                <div className="browse-cat-icon-ring" style={{ background: `${cat.color}18`, color: cat.color }}>
                  <i className={`fas ${cat.icon}`} />
                </div>
                <span className="browse-cat-label">{cat.label}</span>
                <span className="browse-cat-count">
                  {cat.key === 'other' ? `${cat.count}+` : cat.count} Items
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── RECENTLY FOUND ITEMS ── */}
        {foundItems.length > 0 && (
          <div className="recently-found-section animate-on-scroll">
            <div className="browse-cat-header">
              <h2 className="browse-cat-title">Recently Found Items</h2>
              <button
                className="browse-cat-viewall"
                onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('login'); }}
              >
                View All Found Items <i className="fas fa-arrow-right" />
              </button>
            </div>
            <div className="found-items-row">
              {foundItems.map(item => {
                const imgSrc = (item.imageFront?.startsWith('http') || item.imageFront?.includes('/') || item.imageFront?.startsWith('data:'))
                  ? item.imageFront
                  : item.imageFront
                    ? `${apiBase.replace('/api', '')}/uploads/items/${item.imageFront}`
                    : null;
                return (
                  <button
                    key={item.id}
                    className="found-item-card"
                    onClick={() => { clearFields(); setIsModalActive(true); setActiveTab('login'); }}
                  >
                    <div className="found-item-photo">
                      {imgSrc ? (
                        <img src={imgSrc} alt={item.title} />
                      ) : (
                        <div className="found-item-photo-placeholder">
                          <i className="fas fa-image" />
                        </div>
                      )}
                    </div>
                    <div className="found-item-info">
                      <p className="found-item-name">{item.title}</p>
                      <p className="found-item-location">
                        <i className="fas fa-map-marker-alt" /> {item.location}
                      </p>
                      <p className="found-item-time">
                        <i className="far fa-clock" /> {timeAgo(item.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── HOW FINDIT WORKS – horizontal 4-step ── */}
        <div className="how-works-section animate-on-scroll" id="features">
          <div className="how-works-header">
            <div className="how-works-line" />
            <h2 className="how-works-title">How FindIt Works</h2>
            <div className="how-works-line" />
          </div>
          <div className="how-works-steps">
            {[
              { num: '1', title: 'Report',  icon: 'fa-edit',      color: '#3b82f6', bg: '#eff6ff',
                desc: 'Report your lost item in just a few simple steps.' },
              { num: '2', title: 'Search',  icon: 'fa-search',    color: '#10b981', bg: '#ecfdf5',
                desc: 'Search for lost or found items in your area.' },
              { num: '3', title: 'Match',   icon: 'fa-bell',      color: '#f59e0b', bg: '#fffbeb',
                desc: "We'll notify you when there's a possible match." },
              { num: '4', title: 'Reunite', icon: 'fa-handshake', color: '#8b5cf6', bg: '#f5f3ff',
                desc: 'Connect, verify and get your item back safely.' },
            ].map((step, idx) => (
              <React.Fragment key={step.num}>
                <div className="how-works-step">
                  <div
                    className="how-works-icon-circle"
                    style={{ background: step.bg, color: step.color }}
                  >
                    <i className={`fas ${step.icon}`} />
                  </div>
                  <p className="how-works-step-num">{step.num}. {step.title}</p>
                  <p className="how-works-step-desc">{step.desc}</p>
                </div>
                {idx < 3 && <div className="how-works-arrow">→</div>}
              </React.Fragment>
            ))}
          </div>
        </div>


        {/* HAPPY REUNIONS */}
        {testimonials.length > 0 && (
        <div className="happy-reunions-section animate-on-scroll" id="reunions">
          <div className="happy-reunions-header">
            <div className="happy-reunions-line" />
            <h2 className="happy-reunions-title">Happy Reunions</h2>
            <div className="happy-reunions-line" />
          </div>

          <div className="happy-reunions-wrapper">
            {/* Prev Arrow */}
            <button
              className="reunion-arrow reunion-arrow-left"
              onClick={goPrev}
              aria-label="Previous testimonials"
            >
              &#8249;
            </button>

            {/* Cards */}
            <div className="reunion-cards-track">
              {testimonials
                .slice(carouselStart, carouselStart + cardsPerPage)
                .map((t, idx) => (
                    <div className="reunion-card" key={`${carouselStart}-${idx}`}>
                      <div className="reunion-quote-mark">&ldquo;</div>
                      <p className="reunion-text">{t.text}</p>
                      <div className="reunion-author-row">
                        <div className="reunion-avatar-wrap">
                          <img
                            src={t.avatarUrl}
                            alt={t.name}
                            className="reunion-avatar-img"
                            loading="lazy"
                          />
                        </div>
                        <div className="reunion-author-info">
                          <strong className="reunion-name">– {t.name}</strong>
                        </div>
                        <div className="reunion-stars">
                          {'★'.repeat((t as any).rating ?? 5)}
                        </div>
                      </div>
                    </div>
                  )
                )}
            </div>

            {/* Next Arrow */}
            <button
              className="reunion-arrow reunion-arrow-right"
              onClick={goNext}
              aria-label="Next testimonials"
            >
              &#8250;
            </button>
          </div>
        </div>
        )}

        {/* FOOTER */}
        <footer className="landing-footer" id="about">
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
                <h4 className="footer-about-title">About Us</h4>
                <p className="footer-brand-desc">
                  FindIT is a next-generation AI-powered lost and found ecosystem dedicated to reconnecting people with their missing valuables. By pairing real-time computer vision analysis with geo-fenced community reporting, FindIT delivers rapid, privacy-first item recovery across Nepal.
                </p>
                <div className="footer-trust-pills">
                  <span className="trust-pill"><i className="fas fa-shield-alt"></i> 256-bit Encrypted</span>
                  <span className="trust-pill"><i className="fas fa-robot"></i> AI Vision Matching</span>
                  <span className="trust-pill"><i className="fas fa-user-check"></i> Identity Verified</span>
                </div>
                <div className="footer-socials" style={{ marginTop: '1.25rem' }}>
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

              {/* Column 1: How It Works & Ecosystem */}
              <div className="footer-col">
                <h4>How It Works</h4>
                <ul>
                  <li><a href="#features"><i className="fas fa-camera text-accent"></i> AI Photo Auto-Tagging</a></li>
                  <li><a href="#features"><i className="fas fa-map-marker-alt text-accent"></i> Geo-Fenced Radius Alerts</a></li>
                  <li><a href="#features"><i className="fas fa-lock text-accent"></i> Sensitive Document Blur</a></li>
                  <li><a href="#features"><i className="fas fa-key text-accent"></i> 6-Digit Claim Verification</a></li>
                  <li><a href="#features"><i className="fas fa-comments text-accent"></i> End-to-End P2P Chat</a></li>
                </ul>
              </div>

              {/* Column 2: Popular Categories */}
              <div className="footer-col">
                <h4>Item Categories</h4>
                <ul>
                  <li><a href="#categories">Smartphones & Laptops</a></li>
                  <li><a href="#categories">Citizenship & Passports</a></li>
                  <li><a href="#categories">Keys & Remote Fobs</a></li>
                  <li><a href="#categories">Wallets, Cash & Cards</a></li>
                  <li><a href="#categories">Backpacks & Luggage</a></li>
                  <li><a href="#categories">Jewelry & Timepieces</a></li>
                </ul>
              </div>

              {/* Column 3: Legal, Support & Trust */}
              <div className="footer-col">
                <h4>Help & Legal Trust</h4>
                <ul>
                  <li>
                    <a href="#" onClick={(e) => { e.preventDefault(); setInfoModalContent({title: 'Privacy Policy', body: 'We value your privacy. All your data is encrypted and secure. We will never sell or misuse your personal information. Your identity is kept anonymous until you choose to reveal it during item verification.'}); }}>
                      Privacy & Data Security
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => { e.preventDefault(); setInfoModalContent({title: 'Terms of Service', body: 'By using Findit, you agree to treat other community members with respect. You may only claim items that legitimately belong to you. Fraudulent claims will result in immediate permanent account suspension.'}); }}>
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => { e.preventDefault(); setInfoModalContent({title: 'Contact Support', body: 'Need assistance or have a safety concern? Our dedicated support team is available 24/7 at support@findit.gmail.com. We respond within 2-4 hours.'}); }}>
                      Contact Support 24/7
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => { e.preventDefault(); setInfoModalContent({title: 'Safety Guidelines', body: 'Always meet in public, well-lit places during item handovers. Verify the 6-digit handover code inside the platform before giving away any item.'}); }}>
                      Safe Handover Guide
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
                <span>🔒 256-Bit SSL Encrypted</span>
                <span>⚡ Real-Time AI Matcher</span>
                <span>🇳🇵 Nepal Community Network</span>
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
                className="landing-magic-link-btn"
                onClick={handleSendMagicLink}
                disabled={isSendingMagicLink || !loginEmail}
                style={{
                  cursor: loginEmail ? 'pointer' : 'not-allowed',
                  opacity: loginEmail ? 1 : 0.65,
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
