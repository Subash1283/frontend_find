import React, { useState, useEffect } from 'react';

interface ManageClaimsModalProps {
  token: string;
  apiBase: string;
  itemId: number;
  itemTitle?: string;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onClaimApproved?: () => void;
  onOpenChat?: (itemId: number, title: string, otherUserId: number) => void;
}

interface ConfirmAction {
  requestId: number;
  status: 'APPROVED' | 'REJECTED';
  userName: string;
}

export const ManageClaimsModal: React.FC<ManageClaimsModalProps> = ({
  token,
  apiBase,
  itemId,
  itemTitle,
  onClose,
  showToast,
  onClaimApproved,
  onOpenChat,
}) => {
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    fetchClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const fetchClaims = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/items/${itemId}/claim-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClaims(data);
      } else {
        showToast('Failed to fetch claim requests', 'error');
      }
    } catch {
      showToast('Error fetching claim requests', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const promptConfirm = (requestId: number, status: 'APPROVED' | 'REJECTED', userName: string) => {
    setConfirmAction({ requestId, status, userName });
  };

  const executeRespond = async () => {
    if (!confirmAction) return;
    const { requestId, status } = confirmAction;
    setConfirmAction(null);
    setIsProcessing(true);
    try {
      const res = await fetch(`${apiBase}/items/claim-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Claim ${status.toLowerCase()} successfully`, 'success');
        if (status === 'APPROVED' && onClaimApproved) {
          onClaimApproved();
          onClose();
        } else {
          fetchClaims();
        }
      } else {
        showToast(data.message || 'Failed to process claim', 'error');
      }
    } catch {
      showToast('Error processing claim', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const isApprove = confirmAction?.status === 'APPROVED';

  return (
    <>
      <div
        className="modal active"
        onClick={onClose}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          animation: 'fadeIn 0.2s ease-out',
          zIndex: 10000,
        }}
      >
        <div
          className="modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '560px',
            padding: '2rem',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            animation: 'slideUp 0.3s ease-out',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>
              Manage Claim Requests
            </h3>
            <button className="modal-close" onClick={onClose} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              &times;
            </button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#0ea5e9' }}></i>
                <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading requests...</p>
              </div>
            ) : claims.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                <i className="fas fa-inbox" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}></i>
                <p>No claim requests found for this item.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {claims.map((claim) => (
                  <div key={claim.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '1.05rem', color: '#0f172a', display: 'block' }}>{claim.user?.name || 'Unknown User'}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Requested on {new Date(claim.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: claim.status === 'PENDING' ? '#fef3c7' : claim.status === 'APPROVED' ? '#dcfce7' : '#fee2e2',
                        color: claim.status === 'PENDING' ? '#d97706' : claim.status === 'APPROVED' ? '#16a34a' : '#ef4444',
                      }}>
                        {claim.status}
                      </span>
                    </div>

                    <div style={{ marginBottom: '16px', fontSize: '0.9rem', color: '#334155', backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <strong>Proof/Message:</strong>
                      <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                        {claim.proofMessage || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No message provided</span>}
                      </p>
                    </div>

                    {claim.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => promptConfirm(claim.id, 'REJECTED', claim.user?.name || 'this user')}
                          disabled={isProcessing}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: '1px solid #fca5a5',
                            backgroundColor: '#fef2f2',
                            color: '#ef4444',
                            fontWeight: 600,
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => promptConfirm(claim.id, 'APPROVED', claim.user?.name || 'this user')}
                          disabled={isProcessing}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#10b981',
                            color: 'white',
                            fontWeight: 600,
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Approve Claim
                        </button>
                      </div>
                    )}
                    {claim.status === 'APPROVED' && claim.verificationCode && (
                       <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px dashed #34d399', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                         <div>
                           <span style={{ fontSize: '0.8rem', color: '#065f46', display: 'block', marginBottom: '4px' }}>Verification Code</span>
                           <strong style={{ fontSize: '1.2rem', color: '#059669', letterSpacing: '2px' }}>{claim.verificationCode}</strong>
                         </div>
                         {onOpenChat && (
                           <button
                             className="btn-primary"
                             style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', background: '#059669', border: 'none', color: '#fff', cursor: 'pointer' }}
                             onClick={() => {
                               onOpenChat(itemId, `Chat about ${itemTitle || 'Item'}`, claim.userId);
                               onClose();
                             }}
                           >
                             <i className="fas fa-comments"></i> Chat with Claimant
                           </button>
                         )}
                       </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirmation Dialog ── */}
      {confirmAction && (
        <div
          onClick={() => setConfirmAction(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '400px',
              margin: '0 1rem',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              animation: 'slideUp 0.25s ease-out',
            }}
          >
            {/* Icon header */}
            <div
              style={{
                padding: '1.75rem 1.5rem 1rem',
                textAlign: 'center',
                background: isApprove
                  ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)'
                  : 'linear-gradient(135deg, #fef2f2, #fee2e2)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isApprove ? '#10b981' : '#ef4444',
                  color: '#fff',
                  fontSize: '1.5rem',
                  marginBottom: '0.75rem',
                  boxShadow: isApprove
                    ? '0 4px 14px rgba(16,185,129,0.4)'
                    : '0 4px 14px rgba(239,68,68,0.4)',
                }}
              >
                <i className={isApprove ? 'fas fa-check' : 'fas fa-times'}></i>
              </div>
              <h4
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: isApprove ? '#065f46' : '#991b1b',
                }}
              >
                {isApprove ? 'Approve Claim' : 'Reject Claim'}
              </h4>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  color: '#334155',
                  textAlign: 'center',
                }}
              >
                {isApprove ? (
                  <>
                    Are you sure you want to <strong style={{ color: '#10b981' }}>approve</strong> the claim by{' '}
                    <strong>{confirmAction.userName}</strong>?
                    <br />
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      A verification code will be generated and the item will be marked as claimed.
                    </span>
                  </>
                ) : (
                  <>
                    Are you sure you want to <strong style={{ color: '#ef4444' }}>reject</strong> the claim by{' '}
                    <strong>{confirmAction.userName}</strong>?
                    <br />
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      This action cannot be undone.
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                padding: '0 1.5rem 1.5rem',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => setConfirmAction(null)}
                style={{
                  flex: 1,
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e2e8f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
              >
                Cancel
              </button>
              <button
                onClick={executeRespond}
                style={{
                  flex: 1,
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: isApprove ? '#10b981' : '#ef4444',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: isApprove
                    ? '0 2px 10px rgba(16,185,129,0.35)'
                    : '0 2px 10px rgba(239,68,68,0.35)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = isApprove
                    ? '0 4px 14px rgba(16,185,129,0.45)'
                    : '0 4px 14px rgba(239,68,68,0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isApprove
                    ? '0 2px 10px rgba(16,185,129,0.35)'
                    : '0 2px 10px rgba(239,68,68,0.35)';
                }}
              >
                {isApprove ? (
                  <><i className="fas fa-check" style={{ marginRight: '6px' }}></i>Yes, Approve</>
                ) : (
                  <><i className="fas fa-times" style={{ marginRight: '6px' }}></i>Yes, Reject</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
