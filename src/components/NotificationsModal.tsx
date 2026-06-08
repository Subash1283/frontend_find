import React from 'react';

interface NotificationsModalProps {
  notifications: any[];
  onClose: () => void;
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  notifications,
  onClose,
  markNotificationRead,
  markAllNotificationsRead,
}) => {
  return (
    <div className="modal active" onClick={onClose} style={{ zIndex: 1200 }}>
      <div 
        className="modal-card" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '500px', padding: '24px' }}
      >
        <div className="modal-title" style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-bell"></i> Notifications Log
          </h3>
          <button className="modal-close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', margin: 0 }}>
            &times;
          </button>
        </div>

        {notifications.filter(n => !n.isRead).length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <button 
              onClick={markAllNotificationsRead} 
              style={{ 
                width: '100%',
                padding: '12px', 
                borderRadius: '8px', 
                border: 'none', 
                background: 'var(--reward, #f59e0b)',
                color: 'white',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px rgba(245, 158, 11, 0.2)',
                transition: 'transform 0.1s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <i className="fas fa-check-double"></i> MARK ALL AS READ
            </button>
          </div>
        )}

        <div className="alert-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-soft)', fontSize: '0.9rem' }}>
              <i className="fas fa-bell-slash" style={{ display: 'block', fontSize: '2rem', marginBottom: '12px', opacity: 0.3 }}></i>
              You have no new notifications.
            </div>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                className="alert-item"
                style={{ 
                  cursor: notif.isRead ? 'default' : 'pointer', 
                  padding: '12px 16px', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '8px', 
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  transition: 'background 0.2s',
                  opacity: notif.isRead ? 0.6 : 1
                }}
                onClick={() => {
                  if (!notif.isRead) markNotificationRead(notif.id);
                }}
                onMouseEnter={e => {
                  if (!notif.isRead) e.currentTarget.style.background = 'var(--border-soft)';
                }}
                onMouseLeave={e => {
                  if (!notif.isRead) e.currentTarget.style.background = 'var(--bg-secondary)';
                }}
              >
                <i className="fas fa-bolt" style={{ color: 'var(--reward)', marginTop: '3px' }}></i>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                  {notif.message}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
