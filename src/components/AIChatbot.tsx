import React, { useState, useEffect, useRef } from 'react';

interface AIChatbotProps {
  token: string;
  apiBase: string;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  isLocked?: boolean;
  onOpenItemDetails: (id: number) => void;
  onOpenChat: (itemId: number, title: string, otherUserId: number) => void;
}

/** Claim state per found item */
interface ClaimState {
  step: 'idle' | 'requested' | 'approved';
}

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  isPending?: boolean;
  contactCard?: {
    itemId: number;
    itemTitle: string;
    contactName: string;
    contactRole: 'Owner' | 'Finder';
    contactEmail?: string;
    contactUserId: number;
  };
}

/** Extract all item IDs mentioned as [ID:N] or (ID:N) from a string */
function extractItemIds(text: string): number[] {
  const matches = [...text.matchAll(/[\(\[]ID:(\d+)[\)\]]/gi)];
  return [...new Set(matches.map(m => parseInt(m[1], 10)))];
}

/** Returns true if the text sounds like a confirmation or a request to contact */
function isConfirmation(text: string): boolean {
  const t = text.trim().toLowerCase();
  const isConfirm = /\b(yes|yeah|yep|yup|correct|that'?s (mine|my|it)|it'?s mine|found it|match(es)?|confirmed?|that is mine|this is mine|mine|absolutely|right|exactly|affirmative)\b/.test(t);
  const isContactRequest = /\b(how (can|do|to) (i|we) (contact|reach|message|chat|get)|contact (him|her|them|owner|finder)|chat with|message (him|her|them))\b/.test(t);
  return isConfirm || isContactRequest;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({
  token,
  apiBase,
  showToast = () => {},
  onOpenItemDetails,
  onOpenChat,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'bot', text: 'Hi! I am FindIT, your Findit AI assistant. Tell me what you lost or found, and I will search our system for matches!' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Per-item claim state and loading
  const [claimStates, setClaimStates] = useState<Record<number, ClaimState>>({});
  const [claimLoading, setClaimLoading] = useState<Record<number, boolean>>({});
  // Per-item proof message input and form-open state
  const [proofInputs, setProofInputs] = useState<Record<number, string>>({});
  const [proofFormOpen, setProofFormOpen] = useState<Record<number, boolean>>({});

  /** IDs of items the bot most recently suggested as matches */
  const lastMentionedItemIds = useRef<number[]>([]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  /** Scan a bot message and remember every item ID it mentions */
  const rememberMentionedIds = (text: string) => {
    const ids = extractItemIds(text);
    if (ids.length > 0) lastMentionedItemIds.current = ids;
  };

  /** Fetch item from API, return item data */
  const fetchItemContactInfo = async (itemId: number) => {
    const res = await fetch(`${apiBase}/items/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  };

  /** Check claim status for a FOUND item and update claimStates */
  const checkAndInitClaimState = async (item: any) => {
    if (item.type !== 'found') return;
    try {
      const res = await fetch(`${apiBase}/items/${item.id}/claim/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const status = await res.json();
      setClaimStates(prev => ({
        ...prev,
        [item.id]: {
          step: status.isVerified ? 'approved'
              : status.hasPendingRequest ? 'requested'
              : 'idle',
        },
      }));
    } catch { /* ignore */ }
  };

  const handleSubmitClaim = async (itemId: number) => {
    const proof = (proofInputs[itemId] || '').trim();
    if (!proof) {
      showToast('Please write a proof message before submitting.', 'error');
      return;
    }
    setClaimLoading(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch(`${apiBase}/items/${itemId}/claim-requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofMessage: proof }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Claim request sent! Waiting for the finder to accept.', 'success');
        setClaimStates(prev => ({ ...prev, [itemId]: { step: 'requested' } }));
        setProofFormOpen(prev => ({ ...prev, [itemId]: false }));
        setProofInputs(prev => ({ ...prev, [itemId]: '' }));
      } else {
        showToast(data.message || 'Failed to send claim request', 'error');
      }
    } catch {
      showToast('Error sending claim request', 'error');
    } finally {
      setClaimLoading(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;

    setMessages(prev => [...prev, { sender: 'user', text: query }]);
    setInputValue('');

    // Confirmation flow
    if (isConfirmation(query) && lastMentionedItemIds.current.length > 0) {
      setMessages(prev => [...prev, { sender: 'bot', text: "Great! Let me pull up the finder's details...", isPending: true }]);
      try {
        const results = await Promise.all(
          lastMentionedItemIds.current.map(id => fetchItemContactInfo(id))
        );
        const validItems = results.filter(Boolean);

        if (validItems.length === 0) {
          setMessages(prev => prev.map((msg, idx) =>
            idx === prev.length - 1
              ? { sender: 'bot', text: "Sorry, I couldn't retrieve the item details. Please try opening the item directly from the list." }
              : msg
          ));
          return;
        }

        // Initialize claim states for FOUND items
        await Promise.all(validItems.map(item => checkAndInitClaimState(item)));

        // Replace pending with contact cards
        setMessages(prev => {
          const withoutPending = prev.slice(0, -1);
          const introMsg: ChatMessage = {
            sender: 'bot',
            text: `🎉 Here ${validItems.length === 1 ? 'is the contact' : 'are the contacts'} for the matching items:`,
          };
          const cards: ChatMessage[] = validItems.map(item => ({
            sender: 'bot' as const,
            text: '',
            contactCard: {
              itemId: item.id,
              itemTitle: item.title,
              contactName: item.user?.name || 'Unknown',
              contactRole: item.type === 'lost' ? 'Owner' : 'Finder',
              contactEmail: item.user?.email,
              contactUserId: item.user?.id,
            },
          }));
          return [...withoutPending, introMsg, ...cards];
        });

        lastMentionedItemIds.current = [];
      } catch {
        setMessages(prev => prev.map((msg, idx) =>
          idx === prev.length - 1
            ? { sender: 'bot', text: "Sorry, I couldn't load the finder's details. Please try again." }
            : msg
        ));
      }
      return;
    }

    // Normal search flow
    setMessages(prev => [...prev, { sender: 'bot', text: 'Analyzing...', isPending: true }]);

    try {
      const res = await fetch(`${apiBase}/chatbot/ask`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: query }),
      });
      if (res.ok) {
        const data = await res.json();
        const responseText = data.response || "I'm sorry, I couldn't process that query. Please try again.";
        rememberMentionedIds(responseText);
        setMessages(prev =>
          prev.map((msg, idx) =>
            idx === prev.length - 1 ? { sender: 'bot', text: responseText } : msg
          )
        );
      } else {
        throw new Error();
      }
    } catch {
      setMessages(prev =>
        prev.map((msg, idx) =>
          idx === prev.length - 1
            ? { sender: 'bot', text: "Sorry, I'm having trouble connecting to the AI assistant right now." }
            : msg
        )
      );
    }
  };

  // Parse text containing "[ID:123]" into clickable buttons
  const renderMessageText = (text: string) => {
    const parts = text.split(/[\(\[]ID:(\d+)[\)\]]/gi);
    if (parts.length === 1) return text;

    return parts.map((part, idx) => {
      if (idx % 2 === 1) {
        const itemId = parseInt(part, 10);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onOpenItemDetails(itemId)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontWeight: 'bold',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: '0 2px',
              fontFamily: 'inherit',
              fontSize: 'inherit',
            }}
          >
            [View Item #{itemId}]
          </button>
        );
      }
      return part;
    });
  };

  const renderContactCard = (card: NonNullable<ChatMessage['contactCard']>) => {
    const claim = claimStates[card.itemId];
    const isFoundItem = card.contactRole === 'Finder';
    const isApproved = !isFoundItem || claim?.step === 'approved';
    const isRequested = isFoundItem && claim?.step === 'requested';
    const isIdle = isFoundItem && (!claim || claim.step === 'idle');
    const isLoading = !!claimLoading[card.itemId];

    return (
      <div
        key={card.itemId}
        style={{
          background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(99,102,241,0.08) 100%)',
          border: '1.5px solid rgba(6,182,212,0.35)',
          borderRadius: '12px',
          padding: '14px 16px',
          marginTop: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Contact info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: card.contactRole === 'Owner' ? 'var(--lost)' : 'var(--accent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            {(card.contactName || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {card.contactRole}
            </div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
              {card.contactName}
            </div>
          </div>
        </div>

        {/* Item label */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="fas fa-box-open" />
          <span>Item: <strong style={{ color: 'var(--text-main)' }}>{card.itemTitle}</strong></span>
        </div>

        {/* Request Claim section — only for FOUND items not yet approved */}
        {isFoundItem && (
          <div style={{ borderTop: '1px solid rgba(6,182,212,0.2)', paddingTop: '10px' }}>
            {isIdle && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: 0 }}>
                  🔐 To contact this finder, send a claim request with proof. Chat unlocks once they accept.
                </p>

                {!proofFormOpen[card.itemId] ? (
                  <button
                    type="button"
                    onClick={() => setProofFormOpen(prev => ({ ...prev, [card.itemId]: true }))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#0ea5e9',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className="fas fa-hand-paper" /> Request Claim
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <textarea
                      rows={3}
                      placeholder="Describe your proof (e.g. item color, serial number, where you lost it...)"
                      value={proofInputs[card.itemId] || ''}
                      onChange={e => setProofInputs(prev => ({ ...prev, [card.itemId]: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        fontSize: '0.8rem',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleSubmitClaim(card.itemId)}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#0ea5e9',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        {isLoading ? <i className="fas fa-circle-notch fa-spin" /> : <><i className="fas fa-paper-plane" /> Send Request</>}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProofFormOpen(prev => ({ ...prev, [card.itemId]: false }))}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--text-soft)',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isRequested && (
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fas fa-clock" /> Claim request sent — waiting for the finder to accept.
              </div>
            )}



          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!isApproved}
            onClick={() => {
              if (isApproved && card.contactUserId) {
                onOpenChat(card.itemId, `${card.contactName} – ${card.itemTitle}`, card.contactUserId);
              }
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: isApproved
                ? (card.contactRole === 'Owner' ? 'var(--lost)' : 'var(--accent)')
                : 'var(--border)',
              color: isApproved ? '#fff' : 'var(--text-soft)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: isApproved ? 'pointer' : 'not-allowed',
              opacity: isApproved ? 1 : 0.55,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <i className={`fas ${isApproved ? 'fa-comments' : 'fa-lock'}`} />
            {isApproved ? `Chat with ${card.contactRole}` : 'Chat Locked'}
          </button>
          <button
            type="button"
            onClick={() => onOpenItemDetails(card.itemId)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1.5px solid var(--accent)',
              background: 'transparent',
              color: 'var(--accent)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fas fa-eye" />
            View Post
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`chatbot-widget ${isOpen ? 'open' : ''}`} id="chatbotWidget">
      {/* HEADER */}
      <div className="chatbot-header" onClick={() => setIsOpen(!isOpen)}>
        <span>💬 FindIT Assistant AI</span>
        <i id="chatbotToggleIcon" className={`fas ${isOpen ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
      </div>

      {/* CHAT LOG */}
      <div className="chatbot-body" ref={bodyRef}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chat-message ${msg.sender === 'user' ? 'user' : 'bot'}`}
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {msg.isPending ? (
              <span>
                <i className="fas fa-circle-notch fa-spin" style={{ marginRight: '6px' }}></i> Analyzing...
              </span>
            ) : msg.contactCard ? (
              renderContactCard(msg.contactCard)
            ) : (
              renderMessageText(msg.text)
            )}
          </div>
        ))}
      </div>

      {/* FOOTER INPUT */}
      <form className="chatbot-footer" onSubmit={handleSendMessage}>
        <input
          type="text"
          id="chatbotInput"
          placeholder="Ask me to search or check items..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
        />
        <button type="submit">
          <i className="fas fa-paper-plane"></i>
        </button>
      </form>
    </div>
  );
};
