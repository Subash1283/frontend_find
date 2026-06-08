import React, { useState } from 'react';

interface PlatformReviewModalProps {
  token: string;
  apiBase: string;
  itemId: number;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const PlatformReviewModal: React.FC<PlatformReviewModalProps> = ({
  token,
  apiBase,
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
          type: 'platform',
          rating,
          comment: comment.trim(),
          itemId,
        }),
      });

      if (res.ok) {
        showToast('Thank you for reviewing the platform!', 'success');
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
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="modal-title">
          <h3>🌟 Review FindIt</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-soft)' }}>
            Your item was marked as solved! How was your experience using our platform?
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
            <label>Comment / Testimonial</label>
            <textarea
              rows={4}
              placeholder="Tell us what you liked about FindIt..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
            ></textarea>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
            style={{ marginTop: '8px', justifyContent: 'center' }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Platform Review'}
          </button>
        </form>
      </div>
    </div>
  );
};
