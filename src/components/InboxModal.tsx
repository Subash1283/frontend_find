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
  currentUser,
  socket,
  onClose,
  onOpenChat,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'requests'>('active');
  const [chats, setChats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;

    const handleInboxData = (inboxChats: any[]) => {
      setChats(inboxChats);
      setIsLoading(false);
    };

    // Backend emits `inboxData` (see ChatGateway). Some older code listened to `inbox`.
    socket.on('inboxData', handleInboxData);
    socket.emit('getInbox');

    return () => {
      socket.off('inboxData', handleInboxData);
    };
  }, [socket]);

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
            <span>📬 Message Center</span>
            <button className="modal-close" onClick={onClose}>
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
                
                return (
                  <div
                    key={c.conversation?.id || `${c.item.id}-${c.otherUser.id}`}
                    style={{
                      background: 'var(--surface-2)',
                      padding: '12px 14px',
                      borderRadius: 'var(--r-sm)',
                      border: '1.5px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      transition: 'all 0.18s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'white';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--surface-2)';
                    }}
                    onClick={() => {
                      onOpenChat(
                        c.item.id,
                        `${cleanName} - ${c.item.title}`,
                        c.otherUser.id
                      );
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
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                        {cleanName}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.lastMessage || 'Sent an attachment 📸'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)' }}>
                        {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : ''}
                      </span>
                      {activeTab === 'requests' && (
                        <span style={{ background: 'var(--accent)', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px' }}>
                          New Request
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
