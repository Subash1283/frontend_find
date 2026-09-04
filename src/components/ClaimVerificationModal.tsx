import React, { useState } from 'react';

interface ClaimVerificationModalProps {
  verificationCode: string;
  itemTitle?: string;
  itemId?: number;
  otherUserId?: number;
  onClose: () => void;
  onOpenChat?: (itemId?: number, itemTitle?: string, otherUserId?: number) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ClaimVerificationModal: React.FC<ClaimVerificationModalProps> = ({
  verificationCode,
  itemTitle = 'Item',
  itemId,
  otherUserId,
  onClose,
  onOpenChat,
  showToast,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(verificationCode);
      setCopied(true);
      showToast(`Verification code ${verificationCode} copied to clipboard!`, 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Failed to copy code. Please manually select and copy.', 'error');
    }
  };

  return (
    <div
      className="modal active"
      onClick={onClose}
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 12000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '460px',
          width: '90%',
          padding: '28px',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          textAlign: 'center',
        }}
      >
        {/* Header Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #dcfce7 0%, #a7f3d0 100%)',
            color: '#059669',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            marginBottom: '16px',
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
          }}
        >
          <i className="fas fa-shield-check"></i>
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: '1.4rem',
            fontWeight: 800,
            color: '#0f172a',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Claim Verified!
        </h3>

        <p
          style={{
            margin: '0 0 20px',
            fontSize: '0.92rem',
            color: '#475569',
            lineHeight: 1.55,
          }}
        >
          Your claim request for <strong style={{ color: '#0f172a' }}>"{itemTitle}"</strong> has been approved. Use the verification code below when receiving your item.
        </p>

        {/* Verification Code Container (Matching User Design) */}
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '2px dashed #34d399',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.08)',
          }}
        >
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: '#047857',
              display: 'block',
              marginBottom: '10px',
            }}
          >
            Verification Code
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: '12px',
                fontSize: '1.45rem',
                fontWeight: 800,
                letterSpacing: '3px',
                fontFamily: 'monospace',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                userSelect: 'all',
              }}
            >
              {verificationCode}
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                background: copied ? '#059669' : '#047857',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              <i className={copied ? 'fas fa-check' : 'fas fa-copy'}></i>
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {onOpenChat && (
            <button
              type="button"
              onClick={() => {
                onOpenChat(itemId, itemTitle, otherUserId);
                onClose();
              }}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              }}
            >
              <i className="fas fa-comments"></i> Chat with Founder / Owner
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '11px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#64748b',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Close Dialog
          </button>
        </div>
      </div>
    </div>
  );
};
