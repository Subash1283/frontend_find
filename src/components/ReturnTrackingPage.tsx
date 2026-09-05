import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface ReturnTrackingPageProps {
  token: string;
  apiBase: string;
  currentUser?: any;
  claimId?: number | string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenChat: (itemId: number, title: string, otherUserId: number) => void;
}

export const ReturnTrackingPage: React.FC<ReturnTrackingPageProps> = ({
  token,
  apiBase,
  showToast,
  onOpenChat,
  claimId: claimIdProp,
}) => {
  const { claimId: claimIdParam } = useParams<{ claimId: string }>();
  const claimId = claimIdProp != null ? String(claimIdProp) : claimIdParam;
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  useEffect(() => {
    fetchTrackingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  const fetchTrackingData = async () => {
    if (!claimId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/items/claim-requests/${claimId}/tracking`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to load tracking data', 'error');
      }
    } catch {
      showToast('Error loading claim tracking details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkArranged = async () => {
    if (!claimId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${apiBase}/items/claim-requests/${claimId}/arrange-return`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (res.ok) {
        showToast(result.message || 'Return marked as arranged!', 'success');
        fetchTrackingData();
      } else {
        showToast(result.message || 'Failed to update status', 'error');
      }
    } catch {
      showToast('Error updating return status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReceived = async () => {
    if (!claimId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${apiBase}/items/claim-requests/${claimId}/receive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (res.ok) {
        showToast('Item received successfully! Handover verified.', 'success');
        setShowSuccessModal(true);
        fetchTrackingData();
      } else {
        showToast(result.message || 'Failed to confirm item receipt', 'error');
      }
    } catch {
      showToast('Error confirming item receipt', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRevokeClaim = async () => {
    if (!claimId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${apiBase}/items/claim-requests/${claimId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'REVOKED' }),
      });
      const result = await res.json();
      if (res.ok) {
        showToast(result.message || 'Claim revoked. Other users can claim this item again.', 'success');
        setShowRevokeModal(false);
        fetchTrackingData();
      } else {
        showToast(result.message || 'Failed to revoke claim', 'error');
      }
    } catch {
      showToast('Error revoking claim', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-soft)' }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2.5rem', color: 'var(--accent)', marginBottom: '1rem' }}></i>
        <p>Loading FindIt Return Status...</p>
      </div>
    );
  }

  if (!data || !data.claim) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-soft)' }}>
        <i className="fas fa-exclamation-circle" style={{ fontSize: '3rem', color: 'var(--lost)', marginBottom: '1rem' }}></i>
        <h2>Claim Not Found</h2>
        <button className="premium-btn-primary" onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { claim, history, isClaimant, isPoster, isAdmin } = data;
  const item = claim.item || {};
  const otherUser = isClaimant ? item.user : claim.user;
  const otherRoleTitle = item.type === 'lost' ? (isClaimant ? 'Finder' : 'Owner') : (isClaimant ? 'Finder' : 'Owner');

  // Timeline steps
  const steps = [
    {
      key: 'PENDING',
      title: 'Claim Submitted',
      subtitle: 'Claim request submitted by claimant',
      date: claim.createdAt,
      isDone: true,
    },
    {
      key: 'APPROVED',
      title: 'Claimed',
      subtitle: 'Claim confirmed — item is reserved for the claimant',
      date: claim.verifiedAt,
      isDone: ['APPROVED', 'RETURN_ARRANGED', 'ITEM_RECEIVED', 'RETURN_COMPLETED'].includes(claim.status),
    },
    {
      key: 'RETURN_ARRANGED',
      title: 'In Transit',
      subtitle: 'Handover is in progress between the finder and claimant',
      date: claim.returnArrangedAt,
      isDone: ['RETURN_ARRANGED', 'ITEM_RECEIVED', 'RETURN_COMPLETED'].includes(claim.status),
    },
    {
      key: 'ITEM_RECEIVED',
      title: 'Item Received',
      subtitle: 'Confirmed by claimant/owner',
      date: claim.receivedAt,
      isDone: ['ITEM_RECEIVED', 'RETURN_COMPLETED'].includes(claim.status),
    },
    {
      key: 'RETURN_COMPLETED',
      title: 'Delivered',
      subtitle: 'Item received and the return is complete',
      date: claim.completedAt,
      isDone: claim.status === 'RETURN_COMPLETED',
    },
  ];

  const currentStepIndex = steps.reduce((acc, step, idx) => (step.isDone ? idx : acc), 0);

  return (
    <>
      {/* Inline responsive styles */}
      <style>{`
        .rtp-panel {
          padding: 24px 20px;
          border-radius: 16px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          overflow: hidden;
          box-sizing: border-box;
          max-width: 100%;
        }
        .rtp-header-row {
          display: flex;
          gap: 20px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .rtp-header-thumb {
          width: 100px;
          height: 100px;
          flex-shrink: 0;
        }
        .rtp-header-thumb img,
        .rtp-header-thumb-placeholder {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          object-fit: cover;
          border: 1px solid var(--border);
        }
        .rtp-header-thumb-placeholder {
          background: var(--surface-2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-soft);
          font-size: 2rem;
        }
        .rtp-header-meta {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .rtp-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .rtp-title-row h2 {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--text-main);
          word-break: break-word;
        }
        .rtp-chat-btn-wrap {
          width: 100%;
          max-width: 100%;
          overflow: hidden;
        }
        .rtp-chat-btn-wrap button {
          width: 100%;
          justify-content: center;
          white-space: normal;
          word-break: break-word;
          overflow-wrap: anywhere;
          text-align: center;
        }
        .rtp-step-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 4px 12px;
          flex-wrap: wrap;
        }
        .rtp-step-date {
          font-size: 0.78rem;
          color: var(--text-soft);
          font-weight: 600;
          white-space: nowrap;
        }
        .rtp-action-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .rtp-action-row button {
          white-space: nowrap;
        }
        .rtp-verif-code {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(37,99,235,0.08);
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid rgba(37,99,235,0.2);
          flex-wrap: wrap;
          word-break: break-all;
          max-width: 100%;
        }
        @media (max-width: 600px) {
          .rtp-panel {
            padding: 16px 14px !important;
          }
          .rtp-header-thumb {
            width: 72px;
            height: 72px;
          }
          .rtp-title-row h2 {
            font-size: 1.1rem;
          }
          .rtp-step-date {
            white-space: normal;
            display: block;
            margin-top: 4px;
          }
          .rtp-step-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
          }
          .rtp-action-row {
            flex-direction: column;
            align-items: stretch;
          }
          .rtp-action-row button {
            width: 100%;
            white-space: normal;
          }
          .rtp-revoke-row {
            flex-direction: column;
            align-items: stretch;
          }
          .rtp-revoke-row button {
            width: 100%;
            white-space: normal;
          }
          .rtp-chat-btn-wrap button {
             width: 100%;
             white-space: normal;
          }
        }
        @media (min-width: 601px) {
          .rtp-chat-btn-wrap {
            width: auto;
          }
          .rtp-chat-btn-wrap button {
            width: auto;
          }
        }
      `}</style>

      <div style={{ maxWidth: '850px', margin: '0 auto', padding: '24px 16px', boxSizing: 'border-box', overflowX: 'hidden', width: '100%' }}>
        {/* Back button */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-soft)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '20px',
            padding: 0,
          }}
        >
          <i className="fas fa-arrow-left"></i> Back to Dashboard
        </button>

        {/* Header Card */}
        <div
          className="panel-card rtp-panel"
          style={{ marginBottom: '24px' }}
        >
          <div className="rtp-header-row">
            {/* Thumbnail */}
            <div className="rtp-header-thumb">
              {item.imageFront ? (
                <img src={`${apiBase}/uploads/items/${item.imageFront}`} alt={item.title} />
              ) : (
                <div className="rtp-header-thumb-placeholder">
                  <i className="fas fa-box"></i>
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="rtp-header-meta">
              <div className="rtp-title-row">
                <h2>{item.title}</h2>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '99px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: item.type === 'lost' ? 'var(--lost-bg)' : 'var(--found-bg)',
                    color: item.type === 'lost' ? 'var(--lost)' : 'var(--found)',
                    flexShrink: 0,
                  }}
                >
                  {item.type}
                </span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: 'var(--text-soft)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                Category: <strong>{item.category}</strong> • Location: <strong>{item.location}</strong>
              </p>

              {claim.verificationCode && (
                <div className="rtp-verif-code">
                  <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 700 }}>Verification Code:</span>
                  <strong style={{ fontFamily: 'monospace', letterSpacing: '1px', fontSize: '0.95rem', color: '#1d4ed8' }}>
                    {claim.verificationCode}
                  </strong>
                </div>
              )}
            </div>

            {/* Chat Button */}
            {otherUser && (
              <div className="rtp-chat-btn-wrap">
                {['APPROVED', 'RETURN_ARRANGED', 'ITEM_RECEIVED', 'RETURN_COMPLETED'].includes(claim.status) ? (
                  <button
                    className="premium-btn-primary"
                    onClick={() => onOpenChat(item.id, item.title, otherUser.id)}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                    }}
                  >
                    <i className="fas fa-comments"></i>
                    Chat with {otherRoleTitle} ({otherUser.name})
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <button
                      className="premium-btn-primary"
                      disabled
                      style={{
                        padding: '12px 20px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        background: '#94a3b8',
                        color: '#ffffff',
                        cursor: 'not-allowed',
                        boxShadow: 'none',
                        opacity: 0.8,
                      }}
                      title="Messaging unlocks after finder approves claim request and initiates chat"
                    >
                      <i className="fas fa-lock"></i>
                      Chat Locked (Pending Approval)
                    </button>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-soft)', marginTop: '4px', textAlign: 'center' }}>
                      Messaging unlocks after finder manages claim &amp; chats first
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Status & Timeline Card */}
        <div className="panel-card rtp-panel">
          <h3 style={{ margin: '0 0 24px', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
            FindIt Return Status Timeline
          </h3>

          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
            {steps.map((step, index) => {
              const isCompleted = step.isDone;
              const isCurrent = index === currentStepIndex && claim.status !== 'RETURN_COMPLETED';
              const isLast = index === steps.length - 1;

              return (
                <div key={step.key} style={{ display: 'flex', gap: '16px' }}>
                  {/* Timeline Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {/* Node */}
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isCompleted ? 'var(--found)' : isCurrent ? 'var(--accent)' : 'var(--surface-2)',
                        color: isCompleted || isCurrent ? '#ffffff' : 'var(--text-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        boxShadow: isCompleted || isCurrent ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none',
                        fontWeight: 700,
                        flexShrink: 0,
                        zIndex: 2,
                      }}
                    >
                      {isCompleted ? <i className="fas fa-check"></i> : isCurrent ? <i className="fas fa-circle"></i> : <i className="far fa-circle"></i>}
                    </div>
                    {/* Line */}
                    {!isLast && (
                      <div
                        style={{
                          flex: 1,
                          width: '3px',
                          background: isCompleted ? 'var(--found)' : 'var(--border)',
                          margin: '4px 0',
                          minHeight: '40px',
                        }}
                      ></div>
                    )}
                  </div>

                  {/* Content Column */}
                  <div style={{ flex: 1, paddingBottom: isLast ? '0' : '24px', minWidth: 0 }}>
                    <div className="rtp-step-row">
                      <h4
                        style={{
                          margin: '0 0 4px',
                          fontSize: '1.05rem',
                          fontWeight: 800,
                          color: isCompleted ? 'var(--text-main)' : 'var(--text-soft)',
                          wordBreak: 'break-word',
                        }}
                      >
                        {step.title}
                      </h4>
                      {step.date && (
                        <span className="rtp-step-date" style={{ fontSize: '0.8rem', color: 'var(--text-soft)', fontWeight: 600 }}>
                          {new Date(step.date).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-soft)', lineHeight: 1.4 }}>
                      {step.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Controls */}
          <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px dashed var(--border)' }}>
            {/* Action 1: Mark Return as Arranged */}
            {claim.status === 'APPROVED' && (
              <div
                style={{
                  background: 'rgba(37,99,235,0.05)',
                  padding: '16px 18px',
                  borderRadius: '12px',
                  border: '1px solid rgba(37,99,235,0.2)',
                }}
              >
                <div className="rtp-action-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      Have you agreed on the return location/time?
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>
                      Click below once return arrangements are confirmed via chat.
                    </span>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={handleMarkArranged}
                    disabled={actionLoading}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      background: '#2563eb',
                      border: 'none',
                      color: '#fff',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {actionLoading
                      ? <i className="fas fa-spinner fa-spin"></i>
                      : <><i className="fas fa-calendar-check" style={{ marginRight: '6px' }}></i>Mark Return as Arranged</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* Action 2: I Received My Item */}
            {isClaimant && ['APPROVED', 'RETURN_ARRANGED'].includes(claim.status) && (
              <div
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '2px solid rgba(16,185,129,0.3)',
                  marginTop: '16px',
                  textAlign: 'center',
                }}
              >
                <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#065f46' }}>
                  Item Received Confirmation
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: '#047857' }}>
                  Once you physically collect your item, confirm below to complete the return process.
                </p>
                <button
                  onClick={handleMarkReceived}
                  disabled={actionLoading}
                  style={{
                    padding: '14px 28px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '1rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#ffffff',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 18px rgba(16,185,129,0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'transform 0.2s ease',
                    maxWidth: '100%',
                    whiteSpace: 'normal',
                    height: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {actionLoading
                    ? <i className="fas fa-spinner fa-spin"></i>
                    : <><i className="fas fa-check-circle" style={{ fontSize: '1.2rem' }}></i> ✅ I Received My Item</>
                  }
                </button>
              </div>
            )}

            {claim.status === 'RETURN_COMPLETED' && (
              <div
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#047857',
                  fontWeight: 700,
                }}
              >
                Return Process Completed Successfully! Thank you for using FindIt.
              </div>
            )}

            {claim.status === 'REVOKED' && (
              <div
                style={{
                  background: 'rgba(234,88,12,0.08)',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid rgba(234,88,12,0.3)',
                  color: '#9a3412',
                  fontWeight: 700,
                  marginTop: '16px',
                }}
              >
                This claim was revoked. The item is available for other claimers.
              </div>
            )}

            {(isPoster || isAdmin) && ['APPROVED', 'RETURN_ARRANGED'].includes(claim.status) && (
              <div
                style={{
                  background: 'rgba(234,88,12,0.06)',
                  padding: '16px 18px',
                  borderRadius: '12px',
                  border: '1px solid rgba(234,88,12,0.25)',
                  marginTop: '16px',
                }}
              >
                <div className="rtp-action-row rtp-revoke-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', color: '#9a3412', fontSize: '0.95rem' }}>
                      Wrong person approved?
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: '#c2410c' }}>
                      Revoke this claim if it was approved by mistake so another user can claim the item.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRevokeModal(true)}
                    disabled={actionLoading}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      background: '#ea580c',
                      border: 'none',
                      color: '#fff',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {actionLoading
                      ? <i className="fas fa-spinner fa-spin"></i>
                      : <><i className="fas fa-undo" style={{ marginRight: '6px' }}></i>Revoke Claim</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Log Table */}
        {history && history.length > 0 && (
          <div
            className="panel-card rtp-panel"
            style={{ marginTop: '24px' }}
          >
            <h4 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Status Audit Log
            </h4>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '480px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px', color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '10px', color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>Changed By</th>
                    <th style={{ padding: '10px', color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>Date &amp; Time</th>
                    <th style={{ padding: '10px', color: 'var(--text-soft)' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: any) => (
                    <tr key={h.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{h.status}</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h.changedBy?.name || 'System / Admin'}</td>
                      <td style={{ padding: '10px', color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>{new Date(h.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '10px', color: 'var(--text-soft)', fontStyle: 'italic' }}>{h.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUCCESS MODAL */}
        {showSuccessModal && (
          <div
            className="modal active"
            onClick={() => setShowSuccessModal(false)}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)',
              zIndex: 12000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '460px',
                width: '90%',
                padding: '32px 24px',
                textAlign: 'center',
                borderRadius: '20px',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '3.5rem', marginBottom: '12px', color: '#10b981' }}>
                <i className="fas fa-check-circle"></i>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
                Item Successfully Returned
              </h2>
              <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: 1.6, marginBottom: '24px' }}>
                Your item has been successfully returned and recorded in FindIt. The listing has been marked as solved.
              </p>
              <button
                className="premium-btn-primary"
                onClick={() => setShowSuccessModal(false)}
                style={{ width: '100%', padding: '12px 20px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700 }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* REVOKE CLAIM CONFIRMATION DIALOG MODAL */}
        {showRevokeModal && (
          <div
            className="modal active"
            onClick={() => !actionLoading && setShowRevokeModal(false)}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(8px)',
              zIndex: 13000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadeIn 0.2s ease-out',
              padding: '16px',
            }}
          >
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '460px',
                width: '100%',
                padding: '28px',
                borderRadius: '20px',
                textAlign: 'center',
                background: '#ffffff',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
                  color: '#ea580c',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  marginBottom: '16px',
                  boxShadow: '0 8px 20px rgba(234, 88, 12, 0.25)',
                }}
              >
                <i className="fas fa-undo"></i>
              </div>

              <h3 style={{ margin: '0 0 8px', fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', fontFamily: "'Inter', sans-serif" }}>
                Revoke Claim Confirmation
              </h3>

              <p style={{ margin: '0 0 16px', fontSize: '0.92rem', color: '#475569', lineHeight: 1.55 }}>
                Are you sure you want to revoke the claim approved for <strong style={{ color: '#0f172a' }}>{claim?.user?.name || 'this claimant'}</strong>?
              </p>

              <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px', padding: '12px 14px', marginBottom: '22px', textAlign: 'left', fontSize: '0.82rem', color: '#9a3412', lineHeight: 1.45 }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px', color: '#ea580c' }}></i>
                <strong>Note:</strong> The item status will reset so other users can submit claim requests. Any active return verification code for this claim will be invalidated.
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(false)}
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    padding: '11px 18px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevokeClaim}
                  disabled={actionLoading}
                  style={{
                    flex: 1.2,
                    padding: '11px 18px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                  }}
                >
                  {actionLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Revoking...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-undo"></i> Yes, Revoke Claim
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
