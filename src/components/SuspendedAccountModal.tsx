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
  <div className="landing-modal active" style={{ zIndex: 10001 }} onClick={onClose}>
    <div
      className="landing-modal-container"
      onClick={e => e.stopPropagation()}
      style={{ maxWidth: '440px', padding: '2.5rem', textAlign: 'left' }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          marginBottom: '1.25rem',
          backgroundColor: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f87171',
        }}
      >
        <i className="fas fa-ban" style={{ fontSize: '1.5rem' }} />
      </div>

      <h2 style={{ marginBottom: '0.75rem', color: 'white', fontSize: '1.45rem', fontWeight: 700 }}>
        Account Suspended
      </h2>

      <p style={{ color: '#9ca3af', lineHeight: 1.6, fontSize: '0.95rem', marginBottom: '1rem' }}>
        Your account has been temporarily suspended and you cannot sign in at this time.
      </p>

      <div
        style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#fca5a5',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            marginBottom: '6px',
          }}
        >
          Reason
        </div>
        <p style={{ margin: 0, color: '#fecaca', fontSize: '0.92rem', lineHeight: 1.55 }}>
          {reason}
        </p>
      </div>

      <p style={{ color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
        If you believe this was a mistake, contact support at{' '}
        <strong style={{ color: '#9ca3af' }}>support@findit.gmail.com</strong>.
      </p>

      <button
        type="button"
        className="premium-btn-primary"
        style={{
          width: '100%',
          padding: '12px 24px',
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          border: 'none',
        }}
        onClick={onClose}
      >
        I Understand
      </button>
    </div>
  </div>
);
