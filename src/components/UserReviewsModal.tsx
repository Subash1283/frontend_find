import React, { useState, useEffect } from 'react';

interface UserReviewsModalProps {
  token: string;
  apiBase: string;
  targetUserId: number;
  targetUserName: string;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const UserReviewsModal: React.FC<UserReviewsModalProps> = ({
  token,
  apiBase,
  targetUserId,
  targetUserName,
  onClose,
  showToast,
}) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch(`${apiBase}/reviews/user/${targetUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setReviews(data);
        } else {
          showToast('Failed to load reviews', 'error');
        }
      } catch (e) {
        showToast('Connection error', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchReviews();
  }, [targetUserId, apiBase, token, showToast]);

  return (
    <div className="modal active" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-title" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-soft)' }}>
          <h3>⭐ Reviews for {targetUserName}</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 0', flex: 1 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-soft)' }}>Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-soft)' }}>No reviews yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviews.map(review => (
                <div key={review.id} style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{review.reviewer?.name || 'Anonymous'}</strong>
                    <div style={{ color: '#f59e0b', fontSize: '0.85rem', letterSpacing: '2px' }}>
                      {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                    </div>
                  </div>
                  {review.comment && (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                      {review.comment}
                    </p>
                  )}
                  {review.adminResponse && (
                    <div style={{
                      background: 'rgba(79,70,229,0.06)',
                      border: '1px solid rgba(79,70,229,0.15)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginTop: '8px',
                      fontSize: '0.8rem',
                      color: 'var(--text-main)',
                    }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4f46e5', marginBottom: '4px' }}>
                        <i className="fas fa-shield-alt" style={{ marginRight: '4px' }}></i>ADMIN RESPONSE
                      </div>
                      {review.adminResponse}
                    </div>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-soft)' }}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
