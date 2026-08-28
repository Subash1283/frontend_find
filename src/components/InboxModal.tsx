import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface InboxModalProps {
  token: string;
  apiBase: string;
  currentUser: any;
  socket: Socket | null;
  onClose: () => void;
  onOpenChat: (itemId: number, title: string, otherUserId: number) => void;
}

export const InboxModal: React.FC<InboxModalProps> = ({
  token,
  apiBase,
  currentUser,
  socket,
  onClose,
  onOpenChat,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'requests'>('active');
  const [chats, setChats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [swipedChatId, setSwipedChatId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean, chatId: string | null, itemId: number | null, otherUserId: number | null }>({ show: false, chatId: null, itemId: null, otherUserId: null });

  useEffect(() => {
    const fetchInboxRest = async () => {
      try {
        const res = await fetch(`${apiBase}/chat/inbox`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setChats(prev => {
            if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
            return data;
          });
          setIsLoading(false);
        }
      } catch (e) {
        console.warn('[InboxModal] REST fetch failed:', e);
      }
    };

    fetchInboxRest();

    const handleInboxData = (inboxChats: any[]) => {
      setChats(inboxChats);
      setIsLoading(false);
    };

    if (socket) {
      socket.on('inboxData', handleInboxData);
      socket.emit('getInbox');
    }

    const pollInterval = setInterval(() => {
      if (socket && socket.connected) {
        socket.emit('getInbox');
      } else {
        fetchInboxRest();
      }
    }, 3500);

    return () => {
      clearInterval(pollInterval);
      if (socket) {
        socket.off('inboxData', handleInboxData);
      }
    };
  }, [socket, apiBase, token]);

  // Filter threads
  const activeChatsList = chats.filter(
    c =>
      !c.conversation ||
      c.conversation.status === 'accepted' ||
      (c.conversation.status === 'pending' && Number(c.conversation.initiatorId) === Number(currentUser.id))
  );

  const requestChatsList = chats.filter(
    c =>
      c.conversation &&
      c.conversation.status === 'pending' &&
      Number(c.conversation.ownerId) === Number(currentUser.id)
  );

  const displayedChats = activeTab === 'active' ? activeChatsList : requestChatsList;

  return (
    <div className="modal active" onClick={onClose} id="inboxModal">
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="inbox-header">
          <h3>
            <span> Message Center</span>
            <button 
              type="button" 
              className="modal-close" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              aria-label="Close Message Center"
            >
              &times;
            </button>
          </h3>
        </div>

        <div className="inbox-tabs">
          <div
            className={`inbox-tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active Conversations ({activeChatsList.length})
          </div>
          <div
            className={`inbox-tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Chat Requests ({requestChatsList.length})
          </div>
        </div>

        <div id="inboxList">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-soft)' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ marginRight: '8px' }}></i> Loading messages...
            </div>
          ) : displayedChats.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-inbox"></i>
              <p>No {activeTab === 'requests' ? 'requests' : 'conversations'} yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayedChats.map(c => {
                const otherUserName = c.otherUser.name || c.otherUser.email.split('@')[0];
                const cleanName = otherUserName.charAt(0).toUpperCase() + otherUserName.slice(1);
                
                const chatId = c.conversation?.id || `${c.item.id}-${c.otherUser.id}`;
                const isSwiped = swipedChatId === chatId;

                const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
                  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                  setTouchStartX(clientX);
                };

                const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
                  if (touchStartX === null) return;
                  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                  const diff = touchStartX - clientX;
                  if (diff > 40) { // Swipe left
                    setSwipedChatId(chatId);
                  } else if (diff < -40) {
                    if (swipedChatId === chatId) setSwipedChatId(null);
                  }
                };

                const handleDragEnd = () => {
                  setTouchStartX(null);
                };

                const handleDelete = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setDeleteConfirm({ show: true, chatId, itemId: c.item.id, otherUserId: c.otherUser.id });
                };

                return (
                  <div
                    key={chatId}
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 'var(--r-sm)',
                    }}
                  >
                    {/* Background Delete Action (revealed on swipe) */}
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '80px',
                        background: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        cursor: 'pointer',
                        borderTopRightRadius: 'var(--r-sm)',
                        borderBottomRightRadius: 'var(--r-sm)',
                        fontSize: '1.2rem',
                      }}
                      onClick={handleDelete}
                    >
                      <i className="fas fa-trash"></i>
                    </div>

                    {/* Foreground Chat Item */}
                    <div
                      className="inbox-item-foreground"
                      onTouchStart={handleDragStart}
                      onTouchMove={handleDragMove}
                      onTouchEnd={handleDragEnd}
                      onMouseDown={handleDragStart}
                      onMouseMove={handleDragMove}
                      onMouseUp={handleDragEnd}
                      style={{
                        background: 'var(--surface-2)',
                        padding: '12px 14px',
                        borderRadius: 'var(--r-sm)',
                        border: '1.5px solid var(--border)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        transition: touchStartX === null ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.18s, border-color 0.18s' : 'background 0.18s, border-color 0.18s',
                        transform: isSwiped ? 'translateX(-80px)' : 'translateX(0)',
                        position: 'relative',
                        zIndex: 1,
                        userSelect: 'none',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.background = 'white';
                      }}
                      onMouseLeave={e => {
                        handleDragEnd();
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--surface-2)';
                      }}
                      onClick={() => {
                        // Prevent clicking if we just dragged (touchStartX would not be null during drag, but is null on click usually)
                        // However we clear it on mouseup before click fires. We rely on the fact that if it's swiped, the first click should just unswipe.
                        if (isSwiped) {
                          setSwipedChatId(null);
                        } else {
                          onOpenChat(
                            c.item.id,
                            `${cleanName} - ${c.item.title}`,
                            c.otherUser.id
                          );
                        }
                      }}
                    >
                      <div
                        className="chat-avatar"
                        style={{
                          width: '40px',
                          height: '40px',
                          fontSize: '1rem',
                          borderRadius: '12px',
                          flexShrink: 0,
                        }}
                      >
                        {cleanName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{cleanName}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)', fontWeight: 500 }}>
                            {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.lastMessage || 'Sent an attachment 📸'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                        {activeTab === 'requests' && (
                          <span style={{ background: 'var(--accent)', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px' }}>
                            New Request
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <div className="dialog-overlay" style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ show: false, chatId: null, itemId: null, otherUserId: null }); }}
        >
          <div 
            className="dialog-box"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '24px',
              padding: '32px 28px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              position: 'relative',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px',
                boxShadow: '0 8px 16px rgba(239, 68, 68, 0.15)',
              }}>
                <i className="fas fa-trash-alt" style={{ fontSize: '22px', color: '#ef4444' }}></i>
              </div>
              <h3 style={{ 
                fontSize: '1.3rem', 
                fontWeight: 800, 
                marginBottom: '10px',
                color: '#0f172a',
                fontFamily: "'Outfit', sans-serif",
              }}>
                Delete Conversation?
              </h3>
              <p style={{ 
                fontSize: '0.92rem', 
                color: '#475569', 
                marginBottom: '24px',
                lineHeight: '1.55',
                fontFamily: "'Outfit', sans-serif",
              }}>
                Are you sure you want to permanently delete this conversation?<br />
                <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', display: 'inline-block', marginTop: '6px' }}>
                  ⚠️ This action cannot be undone.
                </span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ show: false, chatId: null, itemId: null, otherUserId: null }); }}
                style={{
                  padding: '11px 22px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minWidth: '105px',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!deleteConfirm.itemId || !deleteConfirm.otherUserId) return;
                  try {
                    await fetch(`${apiBase}/chat/conversation/${deleteConfirm.itemId}/${deleteConfirm.otherUserId}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    if (socket) {
                      socket.emit('getInbox');
                    }
                  } catch (err) {
                    console.error('Failed to delete conversation', err);
                  } finally {
                    setDeleteConfirm({ show: false, chatId: null, itemId: null, otherUserId: null });
                  }
                }}
                style={{
                  padding: '11px 22px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minWidth: '105px',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
