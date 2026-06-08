import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { DASHBOARD_PATHS } from './lib/dashboardRoutes';
import { AUTH_CALLBACK_PATH, parseUserFromOAuthQuery } from './lib/authRoutes';
import { SuspendedAccountModal, parseSuspensionReason } from './components/SuspendedAccountModal';

const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:3000';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [globalSuccessDialog, setGlobalSuccessDialog] = useState<{title: string, message: string} | null>(null);
  const [globalSuspendedReason, setGlobalSuspendedReason] = useState<string | null>(null);
  const authBootstrapped = useRef(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    showToast('Logged out successfully. See you soon!', 'info');
    navigate('/', { replace: true });
  }, [clearSession, navigate, showToast]);

  const showSuspendedDialog = useCallback((message: string) => {
    const reason = parseSuspensionReason(message) || 'Your account has been suspended by an administrator.';
    setGlobalSuspendedReason(reason);
  }, []);

  const fetchCurrentUser = useCallback(
    async (accessToken: string, fallbackUser?: Record<string, unknown> | null) => {
      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const user = await res.json();
          if (user?.isSuspended) {
            showSuspendedDialog(
              user.suspendReason
                ? `Your account has been suspended. Reason: ${user.suspendReason}`
                : 'Your account has been suspended.',
            );
            return null;
          }
          return user;
        }
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (String(data.message || '').toLowerCase().includes('suspended')) {
            showSuspendedDialog(data.message || 'Your account has been suspended.');
            return null;
          }
        }
      } catch {
        
      }
      return fallbackUser ?? null;
    },
    [showSuspendedDialog],
  );

  useEffect(() => {
    if (authBootstrapped.current) return;

    const bootstrapAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthToken = params.get('token');
      const oauthError = params.get('error');
      const oauthUser = parseUserFromOAuthQuery(params.get('user'));

      const cleanUrl = () => {
        window.history.replaceState({}, document.title, AUTH_CALLBACK_PATH);
      };

      if (oauthError) {
        cleanUrl();
        const decoded = decodeURIComponent(oauthError);
        if (parseSuspensionReason(decoded)) {
          showSuspendedDialog(decoded);
        } else {
          showToast(decoded, 'error');
        }
        navigate('/', { replace: true });
        setIsInitializing(false);
        authBootstrapped.current = true;
        return;
      }

      let accessToken = localStorage.getItem('token');

      if (oauthToken) {
        accessToken = oauthToken;
        localStorage.setItem('token', oauthToken);
        cleanUrl();
      }

      if (accessToken) {
        setToken(accessToken);
        const userData = await fetchCurrentUser(accessToken, oauthUser);
        if (userData) {
          setCurrentUser(userData);
          if (oauthToken) {
            setGlobalSuccessDialog({
              title: 'Welcome Back!',
              message: 'Google login successful. Redirecting to your dashboard...'
            });
            setTimeout(() => {
              setGlobalSuccessDialog(null);
              navigate(DASHBOARD_PATHS.home, { replace: true });
            }, 1500);
          }
        } else {
          clearSession();
          if (oauthToken) {
            showToast(
              'Google sign-in succeeded but we could not load your profile. Is the API running on port 3000?',
              'error',
            );
            navigate('/', { replace: true });
          }
        }
      }

      setIsInitializing(false);
      authBootstrapped.current = true;
    };

    bootstrapAuth();
  }, [clearSession, fetchCurrentUser, navigate, showSuspendedDialog, showToast]);

  const handleLoginSuccess = (newToken: string, user: any) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setCurrentUser(user);
    navigate(DASHBOARD_PATHS.home, { replace: true });
  };

  const showGlobalLoader =
    isInitializing ||
    (location.pathname === AUTH_CALLBACK_PATH && !token && !currentUser);

  if (showGlobalLoader) {
    return (
      <div className="app-boot-screen">
        <i className="fas fa-circle-notch fa-spin app-boot-spinner" aria-hidden />
        <h2>FINDIT</h2>
        <p>{location.pathname === AUTH_CALLBACK_PATH ? 'Completing Google sign-in…' : 'Loading…'}</p>
      </div>
    );
  }

  return (
    <>
      <AppRoutes
        apiBase={API_BASE}
        token={token}
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        showToast={showToast}
        setCurrentUser={setCurrentUser}
      />

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-notification toast-${toast.type}`}>
            <i
              className={`fas ${
                toast.type === 'error'
                  ? 'fa-exclamation-circle'
                  : toast.type === 'success'
                    ? 'fa-check-circle'
                    : 'fa-info-circle'
              }`}
            />
            {toast.message}
          </div>
        ))}
      </div>

      {/* GLOBAL SUCCESS MODAL FOR OAUTH */}
      {globalSuccessDialog && (
        <div className="landing-modal active" style={{ zIndex: 10000 }}>
          <div className="landing-modal-container" style={{ maxWidth: '400px', textAlign: 'center', padding: '2.5rem', background: '#111827', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '3rem', color: 'var(--found)', marginBottom: '1rem' }}>
              <i className="fas fa-check-circle"></i>
            </div>
            <h2 style={{ marginBottom: '1rem', color: 'white', fontSize: '1.5rem', fontFamily: 'var(--font-heading)' }}>{globalSuccessDialog.title}</h2>
            <p style={{ color: '#9ca3af', lineHeight: '1.6', fontSize: '1rem', marginBottom: '2rem', fontFamily: 'var(--font-body)' }}>
              {globalSuccessDialog.message}
            </p>
            <button 
              className="premium-btn-primary" 
              style={{ width: '100%', padding: '12px 24px' }}
              onClick={() => {
                setGlobalSuccessDialog(null);
                navigate(DASHBOARD_PATHS.home, { replace: true });
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {globalSuspendedReason && (
        <SuspendedAccountModal
          reason={globalSuspendedReason}
          onClose={() => setGlobalSuspendedReason(null)}
        />
      )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
