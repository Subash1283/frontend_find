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
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="modal active" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="modal-title">
          <h3>⭐ Rate & Review</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-soft)' }}>
            Leave a review for <strong>{targetUserName}</strong>
          </p>

          <div className="form-group">
            <label>Rating</label>
            <div style={{ display: 'flex', gap: '8px', fontSize: '1.8rem', cursor: 'pointer' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  onClick={() => setRating(star)}
                  style={{
                    color: star <= rating ? '#f59e0b' : '#e2e8f0',
                    transition: 'color 0.2s',
                  }}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Comment (Optional)</label>
            <textarea
              rows={4}
              placeholder="Share your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            ></textarea>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
            style={{ marginTop: '8px', justifyContent: 'center' }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  );
};
