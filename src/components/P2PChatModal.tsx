import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import 'emoji-picker-element';
import imageCompression from 'browser-image-compression';


declare global {
  namespace JSX {
    interface IntrinsicElements {
      'emoji-picker': any;
    }
  }
}


interface P2PChatModalProps {
  token: string;
  apiBase: string;
  currentUser: any;
  itemId: number;
  chatTitle: string;
  otherUserId: number;
  socket: Socket | null;
  onClose: () => void;
  playSound: (type: 'send' | 'receive') => void;
}

export const P2PChatModal: React.FC<P2PChatModalProps> = ({
  token,
  apiBase,
  currentUser,
  itemId,
  chatTitle,
  otherUserId,
  socket,
  onClose,
  playSound,
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [conversationStatus, setConversationStatus] = useState<'pending' | 'accepted' | 'declined' | null>(null);
  const [conversationOwnerId, setConversationOwnerId] = useState<number | null>(null);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (!socket) return;

  
    console.log('[P2PChatModal] socket connected, waiting for events', {
      itemId,
      otherUserId,
    });

  
    const handleHistory = (data: { messages: any[]; conversation: any | null }) => {
      console.log('[P2PChatModal] History received:', data);
      setMessages(data?.messages || []);

      if (!data?.conversation) {
        setConversationStatus(null);
        setConversationOwnerId(null);
        scrollToBottom();
        return;
      }

      setConversationStatus(data.conversation.status ?? null);
      const ownerId = data.conversation.ownerId ?? data.conversation.owner?.id;
      setConversationOwnerId(ownerId != null ? Number(ownerId) : null);
      scrollToBottom();
    };

    const handleMessage = (msg: any) => {
      console.log('[P2PChatModal] Message received:', msg);


      const matchesItem = Number(msg.itemId) === Number(itemId);
      const matchesReceiver = Number(msg.receiver?.id) === Number(currentUser.id) ||
        Number(msg.receiver?.id) === Number(otherUserId);
      const matchesSender = Number(msg.sender?.id) === Number(otherUserId) ||
        Number(msg.sender?.id) === Number(currentUser.id);

     
      const isThisChat = matchesItem && (matchesSender || matchesReceiver);

      if (isThisChat) {
        console.log('[P2PChatModal] Message belongs to this chat, adding to UI');
        playSound('receive');
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
        socket.emit('getInbox');
      } else {
        console.log('[P2PChatModal] Message rejected - doesn\'t belong to this chat', {
          matchesItem,
          matchesReceiver,
          matchesSender,
          msgItemId: msg.itemId,
          currentItemId: itemId,
          msgReceiverId: msg.receiver?.id,
          msgSenderId: msg.sender?.id,
          otherUserId,
          currentUserId: currentUser.id
        });
      }
    };

    
    const handleRequestStatus = (data: { itemId: number; initiatorId: number; status: 'accepted' | 'declined' }) => {
      console.log('[P2PChatModal] Request status changed:', data);
      if (Number(data.itemId) === Number(itemId) && Number(data.initiatorId) === Number(otherUserId)) {
        setConversationStatus(data.status);
        if (data.status === 'accepted') {
          showToast(`Chat request accepted!`, 'success');
        }
        socket.emit('getInbox');
      }
    };

  
    const handleChatError = (data: { message: string }) => {
      showToast(data.message || 'Chat error occurred.', 'error');
    };

    
    socket.on('chatHistory', handleHistory);
    socket.on('newMessage', handleMessage);
    socket.on('requestStatusChanged', handleRequestStatus);
    socket.on('chatError', handleChatError);

   
    socket.emit('getHistory', { itemId: Number(itemId), otherUserId: Number(otherUserId) });

  
    return () => {
      socket.off('chatHistory', handleHistory);
      socket.off('newMessage', handleMessage);
      socket.off('requestStatusChanged', handleRequestStatus);
      socket.off('chatError', handleChatError);
    };
  }, [socket, itemId, otherUserId, currentUser.id]); 
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showEmojiPicker]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !socket) return;

    playSound('send');
    socket.emit('sendMessage', {
      receiverId: Number(otherUserId),
      itemId: Number(itemId),
      content: text,
    });

    // Optimistically update conversation status if it was null (e.g. start request)
    if (!conversationStatus) {
      setConversationStatus('pending');
      setConversationOwnerId(Number(otherUserId));
    }

    setInputText('');
    setShowEmojiPicker(false);
    scrollToBottom();
    socket.emit('getInbox');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;

    setIsUploading(true);

    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    try {
      const compressedBlob = await imageCompression(file, options);
      const compressedFile = new File([compressedBlob], file.name, {
        type: file.type,
        lastModified: Date.now(),
      });

      const formData = new FormData();
      formData.append('file', compressedFile);

      const res = await fetch(`${apiBase}/chat/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        playSound('send');
        socket.emit('sendMessage', {
          receiverId: Number(otherUserId),
          itemId: Number(itemId),
          content: 'Sent a photo 📸',
          imageUrl: data.imageUrl,
        });
        if (!conversationStatus) {
          setConversationStatus('pending');
          setConversationOwnerId(Number(otherUserId));
        }
        scrollToBottom();
        socket.emit('getInbox');
      } else {
        alert('Failed to upload image');
      }
    } catch {
      alert('Error compressing or uploading image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAcceptRequest = () => {
    if (socket) {
      socket.emit('acceptRequest', {
        itemId: Number(itemId),
        initiatorId: Number(otherUserId),
      });
      setConversationStatus('accepted');
      socket.emit('getInbox');
    }
  };

  const handleDeclineRequest = () => {
    if (socket) {
      socket.emit('declineRequest', {
        itemId: Number(itemId),
        initiatorId: Number(otherUserId),
      });
      setConversationStatus('declined');
      socket.emit('getInbox');
    }
  };


  useEffect(() => {
    const picker = document.querySelector('emoji-picker') as HTMLElement | null;
    if (!picker) return;

    const handleEmoji = (event: any) => {
      setInputText(prev => prev + event?.detail?.unicode);
      setShowEmojiPicker(false);
    };

    picker.addEventListener('emoji-click', handleEmoji as any);
    return () => picker.removeEventListener('emoji-click', handleEmoji as any);
  }, [showEmojiPicker]);


  const otherUserName = chatTitle.split(' - ')[0] || 'User';

  return (
    <div className="modal active" id="p2pChatModal" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        {/* CHAT HEADER */}
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-avatar">{otherUserName.charAt(0).toUpperCase()}</div>
            <div>
              <div className="chat-title">{otherUserName}</div>
              <div className="chat-subtitle">Regarding: {chatTitle.split(' - ')[1] || 'Item Details'}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* MESSAGES VIEW */}
        <div id="p2pChatMessages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-comments"></i>
              <p>No messages yet. Send a message to start conversation!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isSent = Number(msg.sender.id) === Number(currentUser.id);
              const timeStr = msg.createdAt
                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={msg.id || idx} className={`p2p-msg ${isSent ? 'sent' : 'received'}`}>
                  {msg.content}
                  {msg.imageUrl && (
                    <div style={{ marginTop: '4px' }}>
                      <img
                        src={`${apiBase}${msg.imageUrl}`}
                        alt="Shared proof"
                        style={{ maxWidth: '100%', borderRadius: '6px', maxHeight: '180px', objectFit: 'cover' }}
                      />
                    </div>
                  )}
                  <span
                    style={{
                      float: 'right',
                      fontSize: '0.65rem',
                      color: '#667781',
                      marginLeft: '12px',
                      marginTop: '6px',
                      userSelect: 'none',
                    }}
                  >
                    {timeStr}
                    {isSent && (
                      <i className="fas fa-check-double" style={{ color: '#53bdeb', marginLeft: '3px' }}></i>
                    )}
                  </span>
                  <div style={{ clear: 'both' }}></div>
                </div>
              );
            })
          )}
          {isUploading && (
            <div className="p2p-msg sent" style={{ opacity: 0.6 }}>
              <i className="fas fa-circle-notch fa-spin"></i> Sending photo...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT PANEL & BANNER LOGIC */}
        {conversationStatus === 'declined' ? (
          <div className="chat-request-banner" style={{ background: '#fef2f2', color: '#991b1b', padding: '1.2rem' }}>
            <i className="fas fa-times-circle" style={{ marginRight: '6px' }}></i> This chat request was declined.
          </div>
        ) : conversationStatus === 'pending' && conversationOwnerId === Number(currentUser.id) ? (
          <div className="chat-request-banner">
            <h4>Incoming Chat Request</h4>
            <p>This user wants to discuss details regarding your reported item.</p>
            <div className="chat-request-actions">
              <button className="btn-accept" onClick={handleAcceptRequest}>
                Accept Request
              </button>
              <button className="btn-decline" onClick={handleDeclineRequest}>
                Decline
              </button>
            </div>
          </div>
        ) : conversationStatus === 'pending' && conversationOwnerId !== Number(currentUser.id) ? (
          <div className="chat-request-banner" style={{ padding: '1.2rem', background: '#fffbeb', color: '#b45309' }}>
            <i className="fas fa-clock" style={{ marginRight: '6px' }}></i> Waiting for the owner to accept your chat request...
          </div>
        ) : (
          <form className="chat-input-area" onSubmit={handleSendMessage}>
            <button
              ref={emojiBtnRef}
              type="button"
              className="chat-tool-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              👍
            </button>

            <button
              type="button"
              className="chat-tool-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              📷
            </button>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleImageUpload}
            />

            <input
              type="text"
              placeholder="Type your message here..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
            />

            <button type="submit" className="send-btn">
              <i className="fas fa-paper-plane"></i>
            </button>

            {/* Floating Emoji Picker */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                style={{
                  position: 'absolute',
                  bottom: '60px',
                  left: '16px',
                  zIndex: 2000,
                  boxShadow: 'var(--shadow-lg)',
                  borderRadius: '12px',
                }}
              >
                {React.createElement('emoji-picker')}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

// Helper for quick info logs
function showToast(msg: string, type: 'success' | 'error' | 'info') {
  console.log(`[Toast] ${type}: ${msg}`);
}
