import React, { useState, useEffect } from 'react';
import { ReviewModal } from './ReviewModal';
import { UserReviewsModal } from './UserReviewsModal';
import { PlatformReviewModal } from './PlatformReviewModal';
import { ManageClaimsModal } from './ManageClaimsModal';

interface ItemDetailsModalProps {
  token: string;
  apiBase: string;
  itemId: number;
  currentUserId?: number;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenChat?: (itemId: number, title: string, otherUserId: number) => void;
}

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
  token,
  apiBase,
  itemId,
  currentUserId,
  onClose,
  showToast,
  onOpenChat,
}) => {
  const [item, setItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSensRevealed, setIsSensRevealed] = useState(false);
  const [reporterStats, setReporterStats] = useState<{ averageRating: number; totalReviews: number } | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showUserReviews, setShowUserReviews] = useState(false);
  const [showPlatformReviewModal, setShowPlatformReviewModal] = useState(false);
  
  const [showRequestClaimModal, setShowRequestClaimModal] = useState(false);
  const [proofMessage, setProofMessage] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [showManageClaimsModal, setShowManageClaimsModal] = useState(false);

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [isDisputing, setIsDisputing] = useState(false);
  // new: store the user's own dispute (if any)
  const [userDispute, setUserDispute] = useState<any>(null);

  const handleCreateDispute = async () => {
    if (!disputeReason.trim()) return;
    setIsDisputing(true);
    try {
      const res = await fetch(`${apiBase}/items/${itemId}/dispute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason }),
      });
      if (res.ok) {
        showToast('Report submitted successfully. Admins will review it.', 'success');
        setShowDisputeModal(false);
        setDisputeReason('');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to submit report', 'error');
      }
    } catch {
      showToast('Error communicating with server', 'error');
    } finally {
      setIsDisputing(false);
    }
  };

  const submitClaimRequest = async () => {
    setIsClaiming(true);
    try {
      const res = await fetch(`${apiBase}/items/${itemId}/claim-requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofMessage })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Claim request sent!', 'success');
        setShowRequestClaimModal(false);
        setProofMessage('');
      } else {
        showToast(data.message || 'Failed to request claim', 'error');
      }
    } catch {
      showToast('Error requesting claim', 'error');
    } finally {
      setIsClaiming(false);
    }
  };

  useEffect(() => {
    const fetchItemDetails = async () => {
      try {
        const res = await fetch(`${apiBase}/items/${itemId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setItem(data);
        } else {
          showToast('Failed to fetch item details', 'error');
          onClose();
        }
      } catch {
        showToast('Error communicating with server', 'error');
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    const fetchUserDispute = async () => {
      try {
        const res = await fetch(`${apiBase}/items/${itemId}/dispute`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserDispute(data);
        }
      } catch {
        // ignore if no dispute or error
      }
    };

    fetchItemDetails();
    fetchUserDispute();
  }, [itemId, apiBase, token, onClose, showToast]);

  useEffect(() => {
    if (item?.user?.id) {
      const fetchStats = async () => {
        try {
          const res = await fetch(`${apiBase}/reviews/user/${item.user.id}/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setReporterStats(data);
          }
        } catch (err) {
          // Ignore
        }
      };
      fetchStats();
    }
  }, [item?.user?.id, apiBase, token]);

  if (isLoading) {
    return (
      <div className="modal active">
        <div className="modal-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }}></i>
          <p style={{ marginTop: '1rem', color: 'var(--text-soft)' }}>Loading details...</p>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const isResolved = ['resolved', 'solved'].includes((item.status || 'active').toLowerCase());
  const isTextMasked = item.sensitive && !isSensRevealed;
  const isImageBlurred = item.sensitive && item.sensitiveBlur && !isSensRevealed;
  const isOwner = currentUserId && item?.user?.id && Number(currentUserId) === Number(item.user.id);
  const maskString = (text: string): string => {
    if (!text) return text;
    const trimmed = text.trim();
    if (trimmed.length <= 4) return 'xxxx';
    
    const keepStart = 3;
    const keepEnd = 2;
    let result = '';
    
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (i < keepStart || i >= trimmed.length - keepEnd) {
        result += ch;
      } else if (/[ \s-]/.test(ch)) {
        result += ch;
      } else {
        result += 'x';
      }
    }
    return result;
  };

  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-title" style={{ marginBottom: '16px' }}>
          <h3>🔍 Item Specifications</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
     
        {/* Show admin response if a dispute exists and has been resolved */}
        {userDispute && userDispute.status === 'resolved' && userDispute.adminResponse && (
          <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '12px', marginTop: '12px' }}>
            <h4 style={{ margin: '0 0 6px 0', color: '#0c4a6e' }}>Admin Response</h4>
            <p style={{ margin: 0, color: '#1e3a8a' }}>{userDispute.adminResponse}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header row with tags */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Syne', color: 'var(--text-main)' }}>
              {item.title}
            </h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className={`status-badge ${item.type === 'lost' ? 'lost-tag' : 'found-tag'}`}>
                {item.type.toUpperCase()}
              </span>
              <span
                className="status-badge"
                style={{
                  background: item.status === 'claimed' ? 'var(--found-bg)' : isResolved ? 'var(--found-bg)' : 'var(--accent-soft)',
                  color: item.status === 'claimed' ? 'var(--found)' : isResolved ? 'var(--found)' : 'var(--accent)',
                  border: `1px solid ${item.status === 'claimed' || isResolved ? 'rgba(16,185,129,0.2)' : 'rgba(6,182,212,0.2)'}`,
                }}
              >
                {item.status === 'claimed' ? 'CLAIMED' : isResolved ? 'RESOLVED' : 'ACTIVE'}
              </span>
            </div>
          </div>

          {/* Details list */}
          <div
            style={{
              background: 'var(--surface-2)',
              borderRadius: 'var(--r-md)',
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px 24px',
              fontSize: '0.86rem',
              border: '1.5px solid var(--border)',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-soft)', fontWeight: 600, display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</span>
              <strong style={{ color: 'var(--text-main)' }}>{item.category}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-soft)', fontWeight: 600, display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date Reported</span>
              <strong style={{ color: 'var(--text-main)' }}>
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
              </strong>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--text-soft)', fontWeight: 600, display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 Location Pinpoint</span>
              <strong style={{ color: 'var(--text-main)', display: 'block', wordBreak: 'break-word', marginTop: '2px' }}>{item.location || 'Not specified'}</strong>
              {item.latitude && item.longitude && (
                <span style={{ color: 'var(--text-soft)', fontSize: '0.78rem', marginTop: '2px', display: 'block' }}>
                  Coordinates: {parseFloat(item.latitude).toFixed(5)}, {parseFloat(item.longitude).toFixed(5)}
                </span>
              )}
            </div>

            {item.type === 'lost' && item.reward && Number(item.reward) > 0 && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-soft)', fontWeight: 600, display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>💰 Promised Reward</span>
                <span className="reward-chip" style={{ margin: '4px 0 0', display: 'inline-flex' }}>
                  {item.reward} {item.currency || 'NPR'}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <span style={{ color: 'var(--text-soft)', fontWeight: 700, display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Detailed Description</span>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6', background: 'white', border: '1.5px solid var(--border)', padding: '14px', borderRadius: 'var(--r-sm)', whiteSpace: 'pre-wrap' }}>
              {item.description || 'No description provided.'}
            </p>
          </div>

          {/* Sensitive alert */}
          {item.sensitive && (
            <div
              style={{
                background: 'var(--lost-bg)',
                border: '1px solid rgba(244,63,94,0.3)',
                padding: '12px 14px',
                borderRadius: 'var(--r-sm)',
                fontSize: '0.82rem',
                color: 'var(--lost)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                <strong>⚠️ Sensitive content note:</strong>{' '}
                <span
                  style={{
                    transition: 'filter 0.3s ease',
                  }}
                >
                  {isTextMasked ? maskString(item.sensitive) : item.sensitive}
                </span>
              </span>
              {(isTextMasked || isImageBlurred) && isOwner && (
                <button
                  type="button"
                  className="reveal-btn"
                  onClick={() => setIsSensRevealed(true)}
                  style={{ background: 'white' }}
                >
                  Reveal Content
                </button>
              )}
            </div>
          )}

          {/* Images container */}
          {(item.imageFront || item.imageBack) && (
            <div>
              <span style={{ color: 'var(--text-soft)', fontWeight: 700, display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Attached Proof Images</span>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {item.imageFront && (
                  <div style={{ flex: 1, minWidth: '240px', position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-md)' }}>
                    <img
                      src={`${apiBase}/uploads/items/${item.imageFront}`}
                      alt="Front View"
                      style={{
                        width: '100%',
                        height: '200px',
                        objectFit: 'cover',
                        border: '1.5px solid var(--border)',
                        borderRadius: 'var(--r-md)',
                        transition: 'filter 0.3s ease',
                        filter: isImageBlurred ? 'blur(20px) brightness(0.6)' : 'none',
                      }}
                    />
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', zIndex: 3 }}>
                      FRONT
                    </span>
                    {isImageBlurred && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', zIndex: 2 }}>
                        <i className="fas fa-eye-slash" style={{ fontSize: '1.5rem', color: 'white', opacity: 0.9 }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>Sensitive Image</span>
                      </div>
                    )}
                  </div>
                )}

                {item.imageBack && (
                  <div style={{ flex: 1, minWidth: '240px', position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-md)' }}>
                    <img
                      src={`${apiBase}/uploads/items/${item.imageBack}`}
                      alt="Back View"
                      style={{
                        width: '100%',
                        height: '200px',
                        objectFit: 'cover',
                        border: '1.5px solid var(--border)',
                        borderRadius: 'var(--r-md)',
                        transition: 'filter 0.3s ease',
                        filter: isImageBlurred ? 'blur(20px) brightness(0.6)' : 'none',
                      }}
                    />
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', zIndex: 3 }}>
                      BACK
                    </span>
                    {isImageBlurred && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', zIndex: 2 }}>
                        <i className="fas fa-eye-slash" style={{ fontSize: '1.5rem', color: 'white', opacity: 0.9 }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>Sensitive Image</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reporter details */}
          <div
            style={{
              marginTop: '10px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
              >
                {(item.user?.name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block' }}>Reported By</span>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.user?.name || 'Unknown'}
                  {reporterStats && (
                    <span 
                      style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600, cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setShowUserReviews(true); }}
                      title="Click to view reviews"
                    >
                      <i className="fas fa-star"></i> {reporterStats.totalReviews > 0 ? `${reporterStats.averageRating} (${reporterStats.totalReviews})` : 'New (0)'}
                    </span>
                  )}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {isResolved && currentUserId && item.user?.id && Number(currentUserId) !== Number(item.user.id) && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReviewModal(true);
                  }}
                >
                  <i className="fas fa-star"></i> Leave Review
                </button>
              )}
              {isResolved && currentUserId && item.user?.id && currentUserId === item.user.id && (
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', borderColor: '#8b5cf6', color: '#8b5cf6' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlatformReviewModal(true);
                  }}
                >
                  <i className="fas fa-heart"></i> Review Platform
                </button>
              )}
              {!isResolved && item.status !== 'claimed' && currentUserId && item.user?.id && Number(currentUserId) !== Number(item.user.id) && item.type === 'found' && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '6px', background: '#0ea5e9', border: 'none', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRequestClaimModal(true);
                  }}
                  disabled={isClaiming}
                >
                  <i className="fas fa-hand-paper"></i> Request Claim
                </button>
              )}
              {item.status === 'claimed' && currentUserId && item.claimedById === currentUserId && item.user?.id && onOpenChat && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '6px', background: '#10b981', border: 'none', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChat(item.id, `Chat about ${item.title}`, item.user.id);
                    onClose();
                  }}
                >
                  <i className="fas fa-comments"></i> Chat with Owner
                </button>
              )}
              {currentUserId && item.user?.id && Number(currentUserId) === Number(item.user.id) && item.type === 'found' && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '6px', background: '#8b5cf6', border: 'none', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowManageClaimsModal(true);
                  }}
                >
                  <i className="fas fa-tasks"></i> Manage Claim Requests
                </button>
              )}
              {currentUserId && item.user?.id && Number(currentUserId) !== Number(item.user.id) && (
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: '6px 14px', fontSize: '0.78rem', borderRadius: '6px', borderColor: '#ef4444', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDisputeModal(true);
                  }}
                >
                  <i className="fas fa-flag"></i> Report Item
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showReviewModal && (
        <ReviewModal
          token={token}
          apiBase={apiBase}
          targetUserId={item.user.id}
          targetUserName={item.user.name || 'User'}
          itemId={item.id}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setShowReviewModal(false);
            // Optionally refresh stats
            fetch(`${apiBase}/reviews/user/${item.user.id}/stats`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then(res => res.json())
              .then(data => setReporterStats(data))
              .catch(() => {});
          }}
          showToast={showToast}
        />
      )}

      {showUserReviews && (
        <UserReviewsModal
          token={token}
          apiBase={apiBase}
          targetUserId={item.user.id}
          targetUserName={item.user.name || 'User'}
          onClose={() => setShowUserReviews(false)}
          showToast={showToast}
        />
      )}

      {showPlatformReviewModal && (
        <PlatformReviewModal
          token={token}
          apiBase={apiBase}
          itemId={item.id}
          onClose={() => setShowPlatformReviewModal(false)}
          onSuccess={() => setShowPlatformReviewModal(false)}
          showToast={showToast}
        />
      )}

      {showRequestClaimModal && (
        <div 
          className="modal active" 
          onClick={() => setShowRequestClaimModal(false)}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            animation: 'fadeIn 0.2s ease-out',
            zIndex: 9999
          }}
        >
          <div 
            className="modal-card" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: '440px', 
              padding: '2.5rem', 
              textAlign: 'center',
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 1.25rem',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent, #0ea5e9)'
            }}>
              <i className="fas fa-hand-paper" style={{ fontSize: '1.5rem' }}></i>
            </div>

            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.35rem', fontWeight: '700', color: '#0f172a' }}>
              Request to Claim
            </h3>
            
            <p style={{ marginBottom: '1.5rem', color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Provide any proof or additional details to help the owner verify that this item belongs to you.
            </p>

            <textarea
              rows={4}
              placeholder="e.g., The wallet has my ID inside, or there is a scratch on the back..."
              value={proofMessage}
              onChange={e => setProofMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                fontSize: '0.95rem',
                marginBottom: '1.5rem',
                resize: 'vertical'
              }}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button"
                onClick={() => setShowRequestClaimModal(false)}
                style={{ 
                  flex: 1,
                  padding: '12px', 
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn-primary"
                onClick={submitClaimRequest}
                disabled={isClaiming}
                style={{ 
                  flex: 1,
                  padding: '12px', 
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isClaiming ? (
                  <><i className="fas fa-circle-notch fa-spin"></i> Submitting...</>
                ) : (
                  <>Submit Request</>
                )}
              </button>
            </div>
            <style>{`
              @keyframes slideUp {
                from { opacity: 0; transform: translateY(15px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
            `}</style>
          </div>
        </div>
      )}

      {showManageClaimsModal && (
        <ManageClaimsModal
          token={token}
          apiBase={apiBase}
          itemId={item.id}
          itemTitle={item.title}
          onClose={() => setShowManageClaimsModal(false)}
          showToast={showToast}
          onOpenChat={onOpenChat}
          onClaimApproved={() => {
            // Re-fetch item to update status
            fetch(`${apiBase}/items/${itemId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then(res => res.json())
              .then(data => setItem(data))
              .catch(() => {});
          }}
        />
      )}

      {showDisputeModal && (
        <div 
          className="modal active" 
          onClick={() => setShowDisputeModal(false)}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            animation: 'fadeIn 0.2s ease-out',
            zIndex: 9999
          }}
        >
          <div 
            className="modal-card" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: '440px', 
              padding: '2.5rem', 
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              marginBottom: '1.25rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444'
            }}>
              <i className="fas fa-flag" style={{ fontSize: '1.5rem' }}></i>
            </div>

            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.35rem', fontWeight: '700', color: '#0f172a' }}>
              Report Item
            </h3>
            
            <p style={{ marginBottom: '1.5rem', color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>
              If you believe this item violates our guidelines, is inappropriate, or belongs to you but was claimed falsely, please provide a reason.
            </p>

            <textarea
              rows={4}
              placeholder="Please describe why you are reporting this item..."
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                fontSize: '0.95rem',
                marginBottom: '1.5rem',
                resize: 'vertical'
              }}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button"
                onClick={() => setShowDisputeModal(false)}
                style={{ 
                  flex: 1,
                  padding: '12px', 
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn-primary"
                onClick={handleCreateDispute}
                disabled={isDisputing || !disputeReason.trim()}
                style={{ 
                  flex: 1,
                  padding: '12px', 
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: '#ef4444',
                  borderColor: '#ef4444',
                  color: '#fff'
                }}
              >
                {isDisputing ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
