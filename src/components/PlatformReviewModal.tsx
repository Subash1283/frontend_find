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
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

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
      const formData = new FormData();
      formData.append('type', 'platform');
      formData.append('rating', rating.toString());
      formData.append('comment', comment.trim());
      if (itemId) formData.append('itemId', itemId.toString());
      if (imageFile) formData.append('image', imageFile);

      const res = await fetch(`${apiBase}/reviews`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
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
            🌟 Review FindIt
          </h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-soft)', lineHeight: 1.4 }}>
            Your item was marked as solved! How was your experience using our platform?
          </p>

          {/* Rating Group */}
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

          {/* Comment / Testimonial */}
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-soft)' }}>
              COMMENT / TESTIMONIAL
            </label>
            <textarea
              rows={3}
              placeholder="Tell us what you liked about FindIt..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
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
                minHeight: '80px',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
            ></textarea>
          </div>

          {/* Custom File Upload Dropzone */}
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-soft)' }}>
              UPLOAD PICTURE (OPTIONAL)
            </label>
            {!imagePreview ? (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '2px dashed var(--border, #cbd5e1)',
                  background: 'var(--bg-input, #f8fafc)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  margin: 0,
                  textTransform: 'none',
                  letterSpacing: 'normal',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>📷</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-soft, #64748b)', fontWeight: 500 }}>
                  Choose a picture to upload
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
              </label>
            ) : (
              <div
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: 'fit-content',
                  marginTop: '4px',
                }}
              >
                <img
                  src={imagePreview}
                  alt="Review Preview"
                  style={{
                    maxWidth: '120px',
                    maxHeight: '100px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    border: '2px solid var(--border, #e2e8f0)',
                  }}
                />
                <button
                  type="button"
                  onClick={removeImage}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Submit Button */}
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
            {isSubmitting ? 'Submitting...' : 'Submit Platform Review'}
          </button>
        </form>
      </div>
    </div>
  );
};

