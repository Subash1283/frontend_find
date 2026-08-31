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

  const handleRevokeClaim = async () => {
    if (!claimId) return;
    const claimantName = data?.claim?.user?.name || 'this claimant';
    if (!window.confirm(`Revoke the claim by ${claimantName}? The item will be available again so other users can claim it.`)) {
      return;
    }
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
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '24px 16px' }}>
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
        }}
      >
        <i className="fas fa-arrow-left"></i> Back to Dashboard
      </button>

      {/* Header Card */}
      <div
        className="panel-card"
        style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          {item.imageFront ? (
            <img
              src={`${apiBase}/uploads/items/${item.imageFront}`}
              alt={item.title}
              style={{
                width: '100px',
                height: '100px',
                objectFit: 'cover',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}
            />
          ) : (
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '12px',
                background: 'var(--surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-soft)',
                fontSize: '2rem',
              }}
            >
              <i className="fas fa-box"></i>
            </div>
          )}

          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {item.title}
              </h2>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '99px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: item.type === 'lost' ? 'var(--lost-bg)' : 'var(--found-bg)',
                  color: item.type === 'lost' ? 'var(--lost)' : 'var(--found)',
                }}
              >
                {item.type}
              </span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: 'var(--text-soft)' }}>
              Category: <strong>{item.category}</strong> • Location: <strong>{item.location}</strong>
            </p>

            {claim.verificationCode && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(37,99,235,0.08)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(37,99,235,0.2)',
                }}
              >
                <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 700 }}>Verification Code:</span>
                <strong style={{ fontFamily: 'monospace', letterSpacing: '1px', fontSize: '0.95rem', color: '#1d4ed8' }}>
                  {claim.verificationCode}
                </strong>
              </div>
            )}
          </div>

          {/* Chat Button */}
          {otherUser && (
            <div>
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
                <i className="fas fa-comments"></i>  Chat with {otherRoleTitle} ({otherUser.name})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Status & Timeline Card */}
      <div
        className="panel-card"
        style={{
          padding: '28px',
          borderRadius: '16px',
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}
      >
        <h3 style={{ margin: '0 0 24px', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
          FindIt Return Status Timeline
        </h3>

        {/* E-Commerce style timeline */}
        <div style={{ position: 'relative', paddingLeft: '32px', borderLeft: '3px solid var(--border)', marginLeft: '12px' }}>
          {steps.map((step, index) => {
            const isCompleted = step.isDone;
            const isCurrent = index === currentStepIndex && claim.status !== 'RETURN_COMPLETED';

            return (
              <div key={step.key} style={{ marginBottom: index === steps.length - 1 ? '0' : '32px', position: 'relative' }}>
                {/* Node icon */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-45px',
                    top: '0px',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: isCompleted ? 'var(--found)' : isCurrent ? 'var(--accent)' : 'var(--surface-2)',
                    color: isCompleted || isCurrent ? '#ffffff' : 'var(--text-soft)',
                    border: `3px solid var(--surface)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    boxShadow: isCompleted || isCurrent ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none',
                    fontWeight: 700,
                  }}
                >
                  {isCompleted ? <i className="fas fa-check"></i> : isCurrent ? <i className="fas fa-circle"></i> : <i className="far fa-circle"></i>}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <h4
                      style={{
                        margin: '0 0 4px',
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: isCompleted ? 'var(--text-main)' : 'var(--text-soft)',
                      }}
                    >
                      {step.title}
                    </h4>
                    {step.date && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)', fontWeight: 600 }}>
                        {new Date(step.date).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-soft)' }}>
                    {step.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls Section */}
        <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px dashed var(--border)' }}>
          {/* Action 1: Mark Return as Arranged */}
          {claim.status === 'APPROVED' && (
            <div style={{ background: 'rgba(37,99,235,0.05)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: '0.95rem' }}>Have you agreed on the return location/time?</strong>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>Click below once return arrangements are confirmed via chat.</span>
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
                }}
              >
                {actionLoading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-calendar-check" style={{ marginRight: '6px' }}></i> Mark Return as Arranged</>}
              </button>
            </div>
          )}

          {/* Action 2: Prominent "I Received My Item" Confirmation Button */}
          {isClaimant && ['APPROVED', 'RETURN_ARRANGED'].includes(claim.status) && (
            <div style={{ background: 'rgba(16,185,129,0.08)', padding: '20px', borderRadius: '14px', border: '2px solid rgba(16,185,129,0.3)', marginTop: '16px', textAlign: 'center' }}>
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
                }}
              >
                {actionLoading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-check-circle" style={{ fontSize: '1.2rem' }}></i> ✅ I Received My Item</>}
              </button>
            </div>
          )}

          {claim.status === 'RETURN_COMPLETED' && (
            <div style={{ background: 'rgba(16,185,129,0.1)', padding: '16px 20px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(16,185,129,0.3)', color: '#047857', fontWeight: 700 }}>
              Return Process Completed Successfully! Thank you for using FindIt.
            </div>
          )}

          {claim.status === 'REVOKED' && (
            <div style={{ background: 'rgba(234,88,12,0.08)', padding: '16px 20px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(234,88,12,0.3)', color: '#9a3412', fontWeight: 700, marginTop: '16px' }}>
              This claim was revoked. The item is available for other claimers.
            </div>
          )}

          {(isPoster || isAdmin) && ['APPROVED', 'RETURN_ARRANGED'].includes(claim.status) && (
            <div style={{ background: 'rgba(234,88,12,0.06)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(234,88,12,0.25)', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ display: 'block', color: '#9a3412', fontSize: '0.95rem' }}>Wrong person approved?</strong>
                <span style={{ fontSize: '0.82rem', color: '#c2410c' }}>
                  Revoke this claim if it was approved by mistake so another user can claim the item.
                </span>
              </div>
              <button
                type="button"
                onClick={handleRevokeClaim}
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
                }}
              >
                {actionLoading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-undo" style={{ marginRight: '6px' }}></i> Revoke Claim</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* History Log Table */}
      {history && history.length > 0 && (
        <div
          className="panel-card"
          style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            marginTop: '24px',
          }}
        >
          <h4 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Status Audit Log
          </h4>
          <div className="admin-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-soft)' }}>Status</th>
                  <th style={{ padding: '10px', color: 'var(--text-soft)' }}>Changed By</th>
                  <th style={{ padding: '10px', color: 'var(--text-soft)' }}>Date & Time</th>
                  <th style={{ padding: '10px', color: 'var(--text-soft)' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-main)' }}>{h.status}</td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{h.changedBy?.name || 'System / Admin'}</td>
                    <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{new Date(h.createdAt).toLocaleString()}</td>
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
        <div className="modal active" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-card" style={{ maxWidth: '440px', width: '90%', padding: '32px', textAlign: 'center', borderRadius: '20px', background: '#fff' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '12px', color: '#10b981' }}>
              <i className="fas fa-check-circle"></i>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
              Item Successfully Returned
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: 1.6, marginBottom: '24px' }}>
              Your item has been successfully returned and recorded in FindIt. The listing has been marked as solved.
            </p>
            <button
              className="premium-btn-primary"
              onClick={() => {
                setShowSuccessModal(false);
              }}
              style={{ width: '100%', padding: '12px 20px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700 }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
