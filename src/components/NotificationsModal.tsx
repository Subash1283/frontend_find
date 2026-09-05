import React from 'react';

interface NotificationsModalProps {
  notifications: any[];
  onClose: () => void;
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;
  onNavigate?: (link: string) => void;
  onOpenVerificationModal?: (code: string, itemTitle?: string, itemId?: number) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  notifications,
  onClose,
  markNotificationRead,
  markAllNotificationsRead,
  onNavigate,
  onOpenVerificationModal,
  showToast,
}) => {
  return (
    <div className="modal active" onClick={onClose} style={{ zIndex: 1200 }}>
      <div 
        className="modal-card" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '520px', padding: '24px', borderRadius: '16px' }}
      >
        <div className="modal-title" style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-bell" style={{ color: '#f59e0b' }}></i> Notifications Log
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
            notifications.map(notif => {
              // Extract verification code if message contains FINDIT-XXXX
              const codeMatch = notif.message?.match(/(FINDIT-\d{4,6})/i);
              const code = codeMatch ? codeMatch[1].toUpperCase() : null;

              // Extract item title if present in quotes
              const titleMatch = notif.message?.match(/"([^"]+)"/);
              const itemTitle = titleMatch ? titleMatch[1] : undefined;

              // Extract item ID if present in notification link
              const itemLinkMatch = notif.link?.match(/\/items\/(\d+)/);
              const itemId = itemLinkMatch ? Number(itemLinkMatch[1]) : undefined;

              return (
                <div
                  key={notif.id}
                  className="alert-item"
                  style={{ 
                    cursor: 'pointer', 
                    padding: '14px 16px', 
                    background: code ? '#ecfdf5' : 'var(--bg-secondary)', 
                    border: code ? '1px solid #a7f3d0' : '1px solid transparent',
                    borderRadius: '12px', 
                    marginBottom: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    opacity: notif.isRead && !code ? 0.65 : 1,
                    boxShadow: code ? '0 4px 12px rgba(16, 185, 129, 0.12)' : 'none',
                  }}
                  onClick={() => {
                    if (!notif.isRead) markNotificationRead(notif.id);
                    if (notif.link?.includes('/tracking') && onNavigate) {
                      onNavigate(notif.link);
                    } else if (code && onOpenVerificationModal) {
                      onOpenVerificationModal(code, itemTitle, itemId);
                    } else if (notif.link && onNavigate) {
                      onNavigate(notif.link);
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <i className={code ? "fas fa-key" : "fas fa-bolt"} style={{ color: code ? '#059669' : 'var(--reward)', marginTop: '3px' }}></i>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.4', flex: 1, color: code ? '#065f46' : 'var(--text-main, #0f172a)', fontWeight: 500 }}>
                      {notif.message}
                    </div>
                  </div>

                  {code && (
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        flexWrap: 'wrap',
                        gap: '8px 10px',
                        marginTop: '8px',
                        padding: '8px 12px',
                        background: '#ffffff',
                        borderRadius: '8px',
                        border: '1px dashed #34d399',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, minWidth: '0' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Code:</span>
                        <strong 
                          style={{ 
                            fontSize: '0.98rem', 
                            color: '#2563eb', 
                            fontFamily: 'monospace', 
                            letterSpacing: '0.5px', 
                            whiteSpace: 'nowrap', 
                            wordBreak: 'keep-all',
                            overflowWrap: 'normal',
                            background: '#eff6ff',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: '1px solid #bfdbfe'
                          }}
                        >
                          {code}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: 'auto' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(code);
                            if (showToast) showToast(`Copied ${code} to clipboard!`, 'success');
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#059669',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <i className="fas fa-copy"></i> Copy
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenVerificationModal) onOpenVerificationModal(code, itemTitle, itemId);
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #2563eb',
                            background: '#eff6ff',
                            color: '#2563eb',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          View Popup
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
