import React from 'react';

interface SuspendedAccountModalProps {
  reason: string;
  onClose: () => void;
}

export const parseSuspensionReason = (message: string): string | null => {
  const lower = message.toLowerCase();
  if (!lower.includes('suspended')) return null;
  const reasonMatch = message.match(/reason:\s*(.+)$/i);
  return (
    reasonMatch?.[1]?.trim() ||
    message.replace(/^your account has been suspended\.?\s*/i, '').trim() ||
    message
  );
};

export const SuspendedAccountModal: React.FC<SuspendedAccountModalProps> = ({ reason, onClose }) => (
  <div 
    className="dialog-overlay"
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10001,
      animation: 'fadeIn 0.2s ease-out',
    }}
    onClick={onClose}
  >
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '24px',
        padding: '32px',
        maxWidth: '440px',
        width: '90%',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          marginBottom: '1.25rem',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          boxShadow: '0 8px 16px rgba(239, 68, 68, 0.15)',
        }}
      >
        <i className="fas fa-ban" style={{ fontSize: '1.5rem' }} />
      </div>

      <h2 style={{ marginBottom: '0.5rem', color: '#0f172a', fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
        Account Suspended
      </h2>

      <p style={{ color: '#64748b', lineHeight: 1.55, fontSize: '0.92rem', marginBottom: '1.25rem', fontFamily: "'Outfit', sans-serif" }}>
        Your account has been temporarily suspended and you cannot sign in at this time.
      </p>

      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '14px',
          padding: '14px 16px',
          marginBottom: '1.25rem',
          width: '100%',
          textAlign: 'left',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: '#dc2626',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          REASON FOR SUSPENSION
        </div>
        <p style={{ margin: 0, color: '#991b1b', fontSize: '0.9rem', lineHeight: 1.5, fontWeight: 500, fontFamily: "'Outfit', sans-serif" }}>
          {reason}
        </p>
      </div>

      <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif" }}>
        If you believe this was a mistake, please contact support at{' '}
        <strong style={{ color: '#2563eb' }}>support@findit.gmail.com</strong>.
      </p>

      <button
        type="button"
        style={{
          width: '100%',
          padding: '13px 24px',
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '12px',
          fontWeight: 700,
          fontSize: '0.95rem',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
          transition: 'all 0.2s ease',
          fontFamily: "'Outfit', sans-serif",
        }}
        onClick={onClose}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(239, 68, 68, 0.4)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.3)'; }}
      >
        I Understand
      </button>
    </div>
  </div>
);
