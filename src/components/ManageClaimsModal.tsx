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
  const [confirmAction, setConfirmAction] = useState<null | {
    requestId: number;
    status: 'APPROVED' | 'REJECTED' | 'REVOKED';
    userName: string;
  }>(null);


  const [approvedPopupData, setApprovedPopupData] = useState<{
    code: string;
    claimantName: string;
    claimantId?: number;
  } | null>(null);

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

  const promptConfirm = (
    requestId: number,
    status: 'APPROVED' | 'REJECTED' | 'REVOKED',
    userName: string,
  ) => {
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
          if (onClaimApproved && (status === 'APPROVED' || status === 'REVOKED')) {
            onClaimApproved();
          }
          if (status === 'APPROVED') {
            const claim = claims.find((c) => c.id === requestId);
            const claimantId = claim?.userId ?? claim?.user?.id;
            const claimantName = claim?.user?.name || 'Claimant';
            const code = data.verificationCode || data.claimRequest?.verificationCode || claim?.verificationCode;

            if (code) {
              setApprovedPopupData({
                code,
                claimantName,
                claimantId: claimantId ? Number(claimantId) : undefined,
              });
            } else if (onOpenChat && claimantId) {
              onOpenChat(itemId, `${claimantName} - ${itemTitle || 'Item'}`, Number(claimantId));
              onClose();
            } else {
              onClose();
            }
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
  const isRevoke = confirmAction?.status === 'REVOKED';

  const claimStatusStyle = (status: string) => {
    if (status === 'PENDING') return { backgroundColor: '#fef3c7', color: '#d97706' };
    if (status === 'APPROVED' || status === 'RETURN_ARRANGED' || status === 'ITEM_RECEIVED') {
      return { backgroundColor: '#dcfce7', color: '#16a34a' };
    }
    if (status === 'REVOKED') return { backgroundColor: '#ffedd5', color: '#c2410c' };
    return { backgroundColor: '#fee2e2', color: '#ef4444' };
  };

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
                        ...claimStatusStyle(claim.status),
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
                    {['APPROVED', 'RETURN_ARRANGED'].includes(claim.status) && (
                      <>
                        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px dashed #34d399', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                          {claim.verificationCode && (
                            <div>
                              <span style={{ fontSize: '0.8rem', color: '#065f46', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Verification Code</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ fontSize: '1.25rem', color: '#2563eb', fontFamily: 'monospace', letterSpacing: '2px', backgroundColor: '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>{claim.verificationCode}</strong>
                                <button type="button" onClick={() => {
                                  navigator.clipboard.writeText(claim.verificationCode);
                                  showToast(`Copied ${claim.verificationCode} to clipboard!`, 'success');
                                }} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: '#059669', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Copy code">
                                  <i className="fas fa-copy"></i> Copy
                                </button>
                              </div>
                            </div>
                          )}
                          {onOpenChat && (
                            <button className="btn-primary" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.82rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }} onClick={() => { onOpenChat(itemId, `${claim.user?.name || 'Claimant'} - ${itemTitle || 'Item'}`, claim.userId); onClose(); }}>
                              <i className="fas fa-comments"></i> Chat with Claimant
                            </button>
                          )}
                          <button
                            onClick={() => promptConfirm(claim.id, 'REVOKED', claim.user?.name || 'this user')}
                            disabled={isProcessing}
                            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.78rem', background: '#f87171', border: 'none', color: '#fff', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                          >
                            <i className="fas fa-undo" style={{ marginRight: '6px' }}></i>
                            Revoke Claim
                          </button>
                        </div>
                      </>
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
                  : isRevoke
                  ? 'linear-gradient(135deg, #fff7ed, #ffedd5)'
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
                  backgroundColor: isApprove ? '#10b981' : isRevoke ? '#ea580c' : '#ef4444',
                  color: '#fff',
                  fontSize: '1.5rem',
                  marginBottom: '0.75rem',
                  boxShadow: isApprove
                    ? '0 4px 14px rgba(16,185,129,0.4)'
                    : isRevoke
                    ? '0 4px 14px rgba(234,88,12,0.4)'
                    : '0 4px 14px rgba(239,68,68,0.4)',
                }}
              >
                <i className={isApprove ? 'fas fa-check' : isRevoke ? 'fas fa-undo' : 'fas fa-times'}></i>
              </div>
              <h4
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: isApprove ? '#065f46' : isRevoke ? '#9a3412' : '#991b1b',
                }}
              >
                {isApprove ? 'Approve Claim' : isRevoke ? 'Revoke Claim' : 'Reject Claim'}
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
                ) : isRevoke ? (
                  <>
                    Are you sure you want to <strong style={{ color: '#ea580c' }}>revoke</strong> the claim by{' '}
                    <strong>{confirmAction.userName}</strong>?
                    <br />
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      The item will be available again. Other users who were also claiming it can be considered.
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
                  backgroundColor: isApprove ? '#10b981' : isRevoke ? '#ea580c' : '#ef4444',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: isApprove
                    ? '0 2px 10px rgba(16,185,129,0.35)'
                    : isRevoke
                    ? '0 2px 10px rgba(234,88,12,0.35)'
                    : '0 2px 10px rgba(239,68,68,0.35)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = isApprove
                    ? '0 4px 14px rgba(16,185,129,0.45)'
                    : isRevoke
                    ? '0 4px 14px rgba(234,88,12,0.45)'
                    : '0 4px 14px rgba(239,68,68,0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isApprove
                    ? '0 2px 10px rgba(16,185,129,0.35)'
                    : isRevoke
                    ? '0 2px 10px rgba(234,88,12,0.35)'
                    : '0 2px 10px rgba(239,68,68,0.35)';
                }}
              >
                {isApprove ? (
                  <><i className="fas fa-check" style={{ marginRight: '6px' }}></i>Yes, Approve</>
                ) : isRevoke ? (
                  <><i className="fas fa-undo" style={{ marginRight: '6px' }}></i>Yes, Revoke</>
                ) : (
                  <><i className="fas fa-times" style={{ marginRight: '6px' }}></i>Yes, Reject</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION CODE POPUP NOTIFICATION MODAL */}
      {approvedPopupData && (
        <div
          className="modal active"
          onClick={() => {
            setApprovedPopupData(null);
            onClose();
          }}
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 13000,
            display: 'flex',
            alignItems: 'center',
            justify-content: 'center',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              width: '90%',
              padding: '30px',
              borderRadius: '20px',
              textAlign: 'center',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #dcfce7 0%, #a7f3d0 100%)',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                justify-content: 'center',
                fontSize: '2rem',
                marginBottom: '16px',
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
              }}
            >
              <i className="fas fa-shield-check"></i>
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>
              Claim Approved & Code Generated!
            </h3>

            <p style={{ margin: '0 0 20px', fontSize: '0.92rem', color: '#475569', lineHeight: 1.55 }}>
              You have approved the claim request by <strong style={{ color: '#0f172a' }}>{approvedPopupData.claimantName}</strong> for <strong style={{ color: '#0f172a' }}>"{itemTitle || 'Item'}"</strong>.
            </p>

            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '2px dashed #34d399',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.08)',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: '#047857',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                Return Verification Code
              </span>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justify-content: 'center',
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
                  {approvedPopupData.code}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(approvedPopupData.code);
                    showToast(`Verification code ${approvedPopupData.code} copied!`, 'success');
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#047857',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)',
                  }}
                >
                  <i className="fas fa-copy"></i> Copy Code
                </button>
              </div>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px 14px', marginBottom: '20px', textAlign: 'left', fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.45 }}>
              <i className="fas fa-info-circle" style={{ marginRight: '6px', color: '#3b82f6' }}></i>
              <strong>Handover Verification:</strong> Use this code during item handover to verify identity. The claimant has also received this code in their notifications.
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {onOpenChat && approvedPopupData.claimantId && (
                <button
                  type="button"
                  onClick={() => {
                    const cid = approvedPopupData.claimantId!;
                    const cname = approvedPopupData.claimantName;
                    setApprovedPopupData(null);
                    onClose();
                    onOpenChat(itemId, `${cname} - ${itemTitle || 'Item'}`, cid);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justify-content: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  <i className="fas fa-comments"></i> Chat with Claimant
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setApprovedPopupData(null);
                  onClose();
                }}
                style={{
                  flex: onOpenChat && approvedPopupData.claimantId ? '0 0 auto' : 1,
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
