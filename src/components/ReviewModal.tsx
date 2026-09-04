import React, { useState } from 'react';

interface ReviewModalProps {
  token: string;
  apiBase: string;
  targetUserId: number;
  targetUserName: string;
  itemId?: number;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  token,
  apiBase,
  targetUserId,
  targetUserName,
  itemId,
  onClose,
  onSuccess,
  showToast,
}) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ratingLabels: Record<number, string> = {
    1: 'Terrible 😞',
    2: 'Poor 🙁',
    3: 'Average 😐',
    4: 'Good 🙂',
    5: 'Excellent! 🌟',
  };

  const currentRating = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`${apiBase}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserId,
          rating,
          comment: comment.trim(),
          itemId,
        }),
      });

      if (res.ok) {
        showToast('Review submitted successfully!', 'success');
        onSuccess();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || 'Failed to submit review', 'error');
      }
    } catch {
      showToast('Connection error to backend', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal active" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '460px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '24px',
        }}
      >
        <div className="modal-title" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⭐ Rate & Review
          </h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-soft)', lineHeight: 1.4 }}>
            Leave a review for <strong>{targetUserName}</strong>
          </p>

          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-soft)' }}>
              RATING
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{ display: 'flex', gap: '6px', fontSize: '2rem', cursor: 'pointer' }}
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    style={{
                      color: star <= currentRating ? '#f59e0b' : '#cbd5e1',
                      transform: star <= currentRating ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      userSelect: 'none',
                      filter: star <= currentRating ? 'drop-shadow(0 2px 4px rgba(245,158,11,0.3))' : 'none',
                    }}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>
                {ratingLabels[currentRating]}
              </span>
            </div>
          </div>

          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-soft)' }}>
              COMMENT (OPTIONAL)
            </label>
            <textarea
              rows={4}
              placeholder="Share your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1.5px solid var(--border, #e2e8f0)',
                background: 'var(--bg-input, #f8fafc)',
                fontSize: '0.9rem',
                color: 'var(--text-main, #0f172a)',
                outline: 'none',
                resize: 'vertical',
                minHeight: '90px',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
            ></textarea>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
            style={{
              marginTop: '8px',
              padding: '12px',
              borderRadius: '12px',
              fontSize: '0.95rem',
              fontWeight: 600,
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  );
};

