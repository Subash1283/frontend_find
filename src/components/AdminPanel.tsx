import React, { useState, useEffect, useRef } from 'react';

interface AdminPanelProps {
  token: string;
  apiBase: string;
  allItems: any[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  openDeleteDialog: (id: number, name: string, itemType: 'item' | 'user') => void;
}

const SecureImage: React.FC<{ url: string; token: string; alt: string }> = ({ url, token, alt }) => {
  const [src, setSrc] = useState<string>('');
  
  useEffect(() => {
    let objectUrl = '';
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(err => console.error('Failed to load image', err));
      
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token]);

  if (!src) {
    return (
      <div style={{ width: '100%', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '8px', border: '1.5px solid var(--border)' }}>
        <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--text-soft)' }}></i>
      </div>
    );
  }
  return <img src={src} alt={alt} style={{ width: '100%', height: '240px', objectFit: 'contain', borderRadius: '8px', border: '1.5px solid var(--border)', background: '#f8fafc' }} />;
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  token,
  apiBase,
  allItems,
  showToast,
  openDeleteDialog,
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'verified' | 'unverified' | 'pending' | 'suspended'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Items admin review
  const [itemsFilterType, setItemsFilterType] = useState<'all' | 'lost' | 'found'>('all');
  const [itemsFilterStatus, setItemsFilterStatus] = useState<'all' | 'active' | 'solved'>('active');
  const [itemsSearchQuery, setItemsSearchQuery] = useState('');


  // Popover State
  const [popoverUser, setPopoverUser] = useState<any | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const popoverHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Document modal preview state
  const [previewDocUser, setPreviewDocUser] = useState<any | null>(null);

  // Reviews moderation state
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsFilter, setReviewsFilter] = useState<'all' | 'platform' | 'user' | 'hidden'>('all');
  const [respondingReviewId, setRespondingReviewId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState('');

  // Claims audit state
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsFilter, setClaimsFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Disputes state
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputesFilter, setDisputesFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [respondingDisputeId, setRespondingDisputeId] = useState<number | null>(null);
  const [disputeResponseText, setDisputeResponseText] = useState('');

  // Announcements state
  const [announcementText, setAnnouncementText] = useState('');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);
  const [showAnnounceConfirm, setShowAnnounceConfirm] = useState(false);
  const [announceResult, setAnnounceResult] = useState<string | null>(null);

  const [suspendDialog, setSuspendDialog] = useState<{
    id: number;
    name: string;
    mode: 'suspend' | 'unsuspend';
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);

  const DEFAULT_SUSPEND_REASON =
    'Violation of community guidelines (e.g. fraudulent claim or inappropriate behavior)';

  const [activeTab, setActiveTab] = useState<'accounts' | 'items' | 'reviews' | 'claims' | 'disputes' | 'announcements'>('accounts');

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${apiBase}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      showToast('Failed to fetch users list', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClaims = async () => {
    setClaimsLoading(true);
    try {
      const res = await fetch(`${apiBase}/items/admin/claims`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setClaims(await res.json());
    } catch { /* ignore */ } finally { setClaimsLoading(false); }
  };

  const fetchDisputes = async () => {
    setDisputesLoading(true);
    try {
      const res = await fetch(`${apiBase}/items/admin/disputes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDisputes(await res.json());
    } catch { /* ignore */ } finally { setDisputesLoading(false); }
  };

  const handleResolveDispute = async (id: number, status: string, adminResponse?: string) => {
    try {
      const res = await fetch(`${apiBase}/items/admin/disputes/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminResponse }),
      });
      if (res.ok) {
        showToast('Dispute updated successfully', 'success');
        setRespondingDisputeId(null);
        setDisputeResponseText('');
        fetchDisputes();
      } else {
        showToast('Failed to update dispute', 'error');
      }
    } catch { showToast('Connection error', 'error'); }
  };

  const handleSendAnnouncement = async () => {
    if (!announcementText.trim()) return false;
    setIsSendingAnnouncement(true);
    try {
      const res = await fetch(`${apiBase}/notifications/admin/announcement`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: announcementText }),
      });
      if (res.ok) {
        showToast('Announcement sent to all users!', 'success');
        setAnnouncementText('');
        return true;
      } else {
        showToast('Failed to send announcement', 'error');
        return false;
      }
    } catch {
      showToast('Connection error', 'error');
      return false;
    } finally { setIsSendingAnnouncement(false); }
  };

  useEffect(() => {
    fetchUsers();
    fetchAllReviews();
    fetchClaims();
    fetchDisputes();
  }, []);

  const fetchAllReviews = async () => {
    setReviewsLoading(true);
    try {
      const res = await fetch(`${apiBase}/reviews/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllReviews(data);
      }
    } catch {
      console.error('Failed to fetch reviews');
    } finally {
      setReviewsLoading(false);
    }
  };

  const getUserVerificationStatus = (u: any) => {
    if (u.role === 'admin') return 'admin';
    return u.verificationStatus || (u.isVerified ? 'verified' : 'unverified');
  };

  const countUserItems = (userId: number) => {
    return allItems.filter(i => Number(i.user?.id) === Number(userId)).length;
  };

  // Perform bulk check
  const handleBulkVerify = async () => {
    const pendingCount = users.filter(
      u => u.role !== 'admin' && getUserVerificationStatus(u) === 'pending'
    ).length;

    if (pendingCount === 0) {
      showToast('No pending identity documents to check', 'error');
      return;
    }

    if (
      !window.confirm(
        `Trigger OCR automated scan for ${pendingCount} pending users? Name matches are auto-approved.`
      )
    ) {
      return;
    }

    try {
      showToast('Running OCR scans on verification backlog...', 'info');
      const res = await fetch(`${apiBase}/users/verify-pending`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Scans Completed: ${data.verified || 0} approved, ${data.rejected || 0} rejected, ${
            data.pending || 0
          } left pending.`,
          'success'
        );
        fetchUsers();
      } else {
        showToast(data.message || 'Auto-scan run failed', 'error');
      }
    } catch {
      showToast('Connection error during bulk check', 'error');
    }
  };

  // Verify single user status
  const handleVerifyUser = async (id: number, status: 'verified' | 'rejected') => {
    const isApprove = status === 'verified';
    if (!isApprove && !window.confirm("Reject this user's identity verification?")) return;

    try {
      const res = await fetch(`${apiBase}/users/${id}/verify`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast(
          isApprove ? 'User verification approved!' : 'Verification rejected',
          isApprove ? 'success' : 'info'
        );
        fetchUsers();
      } else {
        showToast('Failed to modify user status', 'error');
      }
    } catch {
      showToast('Error sending status PATCH', 'error');
    }
  };

  // Delete User account - uses the shared delete dialog
  const handleDeleteUser = (id: number, name: string) => {
    openDeleteDialog(id, name, 'user');
  };

  const closeSuspendDialog = () => {
    if (isSuspending) return;
    setSuspendDialog(null);
    setSuspendReason('');
  };

  const handleSuspendUser = (id: number, name: string, suspend: boolean) => {
    setSuspendReason(suspend ? DEFAULT_SUSPEND_REASON : '');
    setSuspendDialog({ id, name, mode: suspend ? 'suspend' : 'unsuspend' });
  };

  const confirmSuspendAction = async () => {
    if (!suspendDialog) return;

    const { id, name, mode } = suspendDialog;
    const reason = suspendReason.trim();

    if (mode === 'suspend' && !reason) {
      showToast('A suspension reason is required.', 'error');
      return;
    }

    setIsSuspending(true);
    try {
      const endpoint = mode === 'suspend' ? 'suspend' : 'unsuspend';
      const res = await fetch(`${apiBase}/users/${id}/${endpoint}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'suspend' ? { reason } : {}),
      });
      if (res.ok) {
        showToast(
          mode === 'suspend' ? `${name} has been suspended.` : `${name} has been unsuspended.`,
          'success',
        );
        setSuspendDialog(null);
        setSuspendReason('');
        fetchUsers();
        fetchDisputes();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || `Failed to ${mode === 'suspend' ? 'suspend' : 'unsuspend'} user`, 'error');
      }
    } catch {
      showToast('Connection error', 'error');
    } finally {
      setIsSuspending(false);
    }
  };

  
  const regularUsers = users.filter(u => u.role !== 'admin');
  const totalPending = regularUsers.filter(u => getUserVerificationStatus(u) === 'pending').length;
  const totalVerified = regularUsers.filter(u => getUserVerificationStatus(u) === 'verified').length;
  const totalSuspended = regularUsers.filter(u => u.isSuspended).length;

  const filteredUsers = users.filter(u => {
    const matchSearch =
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(u.id).includes(searchQuery);

    const status = getUserVerificationStatus(u);
    const matchFilter =
      filterType === 'all' ||
      (filterType === 'suspended' && u.role !== 'admin' && u.isSuspended) ||
      (filterType !== 'suspended' && u.role !== 'admin' && status === filterType);

    return matchSearch && matchFilter;
  });

  // Popover Trigger Helper
  const handleMouseEnterEmail = (user: any, e: React.MouseEvent<HTMLSpanElement>) => {
    if (popoverHideTimerRef.current) clearTimeout(popoverHideTimerRef.current);

    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverUser(user);

    // Position calculations
    const popW = 340;
    const popH = 280;
    let top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;

    if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
    if (left < 12) left = 12;
    if (rect.bottom + popH > window.innerHeight) top = rect.top + window.scrollY - popH - 10;

    setPopoverPosition({ top, left });
  };

  const handleMouseLeaveEmail = () => {
    popoverHideTimerRef.current = setTimeout(() => {
      setPopoverUser(null);
    }, 250);
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'admin')
      return (
        <span
          className="status-badge found-tag"
          style={{ background: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}
        >
          ADMIN
        </span>
      );
    if (status === 'verified') return <span className="status-badge found-tag">VERIFIED</span>;
    if (status === 'pending')
      return (
        <span
          className="status-badge"
          style={{
            background: 'var(--reward-bg)',
            color: 'var(--reward)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          PENDING
        </span>
      );
    return <span className="status-badge lost-tag">UNVERIFIED</span>;
  };

  const renderSuspendedBadge = (u: any) => {
    if (!u.isSuspended) return null;
    return (
      <span
        className="status-badge"
        style={{
          background: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid rgba(239,68,68,0.25)',
          marginLeft: '6px',
        }}
        title={u.suspendReason || 'Account suspended'}
      >
        SUSPENDED
      </span>
    );
  };



  const getItemOwnerId = (item: any) => {
    return Number(item?.user?.id ?? item?.userId ?? item?.user_id);
  };

  // Document metadata resolver

  const getItemStatus = (item: any) => (item.status || 'active') as string;

  const toggleItemResolve = async (itemId: number, nextStatus: string) => {
    try {
      const res = await fetch(`${apiBase}/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.message || 'Failed to update item status', 'error');
        return;
      }

      showToast(`Item ${nextStatus === 'solved' ? 'solved' : 'reopened'} successfully`, 'success');
      window.location.reload();
    } catch (error) {
      console.error('Error updating item:', error);
      showToast('Error updating item', 'error');
    }
  };

  const renderItemStatusBadge = (status: string) => {
    if (status === 'solved' || status === 'claimed') {
      return (
        <span
          className="status-badge"
          style={{
            background: 'var(--found-bg)',
            color: 'var(--found)',
            border: '1px solid rgba(34,197,94,0.25)',
          }}
        >
          {status.toUpperCase()}
        </span>
      );
    }

    return (
      <span
        className="status-badge"
        style={{
          background: 'var(--reward-bg)',
          color: 'var(--reward)',
          border: '1px solid rgba(245,158,11,0.2)',
        }}
      >
        ACTIVE
      </span>
    );
  };

  const filteredAdminItems = allItems
    .filter(i => itemsFilterType === 'all' || i.type === itemsFilterType)
    .filter(i => {
      const st = getItemStatus(i);
      if (itemsFilterStatus === 'all') return true;
      if (itemsFilterStatus === 'active') return st === 'active';
      if (itemsFilterStatus === 'solved') return st === 'solved' || st === 'claimed';
      return true;
    })
    .filter(i => {
      const q = itemsSearchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (i.title || '').toLowerCase().includes(q) ||
        (i.location || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      );
    });

  // Document metadata resolver
  const getDocMeta = (u: any) => {
    if (!u.verificationDocument) return null;
    const isDocType = u.verificationDocumentType === 'citizenship' || u.verificationDocumentType === 'driving_license';
    return {
      hasBack: isDocType,
      label: u.verificationDocumentType === 'citizenship' ? 'Citizenship Card' : u.verificationDocumentType === 'passport' ? 'Passport' : 'Driving License',
      frontUrl: `${apiBase}/users/${u.id}/verification-document?side=front`,
      backUrl: u.verificationDocumentBack ? `${apiBase}/users/${u.id}/verification-document?side=back` : null,
    };
  };

  return (
    <div>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ fontFamily: 'Syne', fontSize: '1.25rem', fontWeight: 800 }}>🛡️ System Administrative Console</h3>
        <button className="btn-primary" onClick={handleBulkVerify}>
          <i className="fas fa-magic"></i> Auto-Verify Backlog (OCR Check)
        </button>
      </div>

      {/* STATS CHIPS BAR */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '20px' }}>
        <div className="stat-card" style={{ padding: '14px 18px' }}>
          <div className="stat-title" style={{ fontSize: '0.65rem' }}>Total Accounts</div>
          <div className="stat-number" style={{ fontSize: '1.8rem' }}>{users.length}</div>
        </div>
        <div className="stat-card" style={{ padding: '14px 18px' }}>
          <div className="stat-title" style={{ fontSize: '0.65rem' }}>Pending Verification</div>
          <div className="stat-number" style={{ fontSize: '1.8rem', color: '#b45309' }}>{totalPending}</div>
        </div>
        <div className="stat-card" style={{ padding: '14px 18px' }}>
          <div className="stat-title" style={{ fontSize: '0.65rem' }}>Verified Citizens</div>
          <div className="stat-number" style={{ fontSize: '1.8rem', color: 'var(--found)' }}>{totalVerified}</div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px', 
        borderBottom: '2px solid var(--border)', paddingBottom: '16px'
      }}>
        {[
          { id: 'accounts', label: 'Accounts', icon: 'fa-users-cog' },
          { id: 'items', label: 'Items Review', icon: 'fa-box' },
          { id: 'reviews', label: 'Reviews', icon: 'fa-star' },
          { id: 'claims', label: 'Claims', icon: 'fa-clipboard-list' },
          { id: 'disputes', label: 'Disputes', icon: 'fa-gavel' },
          { id: 'announcements', label: 'Announcements', icon: 'fa-bullhorn' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.id ? 'var(--accent)' : 'var(--surface-2)',
              color: activeTab === tab.id ? '#fff' : 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <i className={`fas ${tab.icon}`}></i> {tab.label}
          </button>
        ))}
      </div>

      {/* FILTER TOOLBAR */}
      {activeTab === 'accounts' && (
      <div className="admin-users-toolbar">
        <div className="search-wrap">
          <i className="fas fa-search"></i>
          <input
            type="search"
            placeholder="Search accounts by name, email, ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`admin-filter-pill ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Accounts
          </button>
          <button
            className={`admin-filter-pill ${filterType === 'pending' ? 'active' : ''}`}
            onClick={() => setFilterType('pending')}
          >
            Pending ({totalPending})
          </button>
          <button
            className={`admin-filter-pill ${filterType === 'verified' ? 'active' : ''}`}
            onClick={() => setFilterType('verified')}
          >
            Verified ({totalVerified})
          </button>
          <button
            className={`admin-filter-pill ${filterType === 'unverified' ? 'active' : ''}`}
            onClick={() => setFilterType('unverified')}
          >
            Unverified
          </button>
          <button
            className={`admin-filter-pill ${filterType === 'suspended' ? 'active' : ''}`}
            onClick={() => setFilterType('suspended')}
          >
            Suspended ({totalSuspended})
          </button>
        </div>
      </div>
      )}

      {/* ADMIN ITEMS REVIEW */}
      {activeTab === 'items' && (
      <div className="panel-card" style={{ marginTop: '22px' }}>



        <div className="panel-header">
          <i className="fas fa-box"></i> Item Review (Admin)
        </div>

        <div className="admin-users-toolbar" style={{ marginTop: '12px' }}>
          <div className="search-wrap">
            <i className="fas fa-search"></i>
            <input
              type="search"
              placeholder="Search items by title, location, description..."
              value={itemsSearchQuery}
              onChange={e => setItemsSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={`admin-filter-pill ${itemsFilterType === 'all' ? 'active' : ''}`}
              onClick={() => setItemsFilterType('all')}
            >
              All
            </button>
            <button
              className={`admin-filter-pill ${itemsFilterType === 'lost' ? 'active' : ''}`}
              onClick={() => setItemsFilterType('lost')}
            >
              Lost
            </button>
            <button
              className={`admin-filter-pill ${itemsFilterType === 'found' ? 'active' : ''}`}
              onClick={() => setItemsFilterType('found')}
            >
              Found
            </button>

            <button
              className={`admin-filter-pill ${itemsFilterStatus === 'active' ? 'active' : ''}`}
              onClick={() => setItemsFilterStatus('active')}
            >
              Active
            </button>
            <button
              className={`admin-filter-pill ${itemsFilterStatus === 'solved' ? 'active' : ''}`}
              onClick={() => setItemsFilterStatus('solved')}
            >
              Solved
            </button>
          </div>
        </div>

        <div className="admin-items-grid" style={{ marginTop: '16px' }}>
          {filteredAdminItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-soft)' }}>
              <i className="fas fa-box-open" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}></i>
              <div>No items found for current filters.</div>
            </div>
          ) : (
            filteredAdminItems.map(item => {
              const ownerId = getItemOwnerId(item);
              const status = getItemStatus(item);
              const isSolved = status === 'solved' || status === 'claimed';
              const ownerName = item.user?.name || item.userName || 'Unknown';
              const owner = users.find(u => Number(u.id) === ownerId);
              const ownerStatus = owner ? getUserVerificationStatus(owner) : null;
              const isOwnerBlocked = ownerStatus === 'pending' || ownerStatus === 'unverified';

              return (
                <div key={item.id} className="admin-item-card">
                  <div className="admin-item-header">
                    <div className="admin-item-type-badge">
                      <i className={`fas ${item.type === 'lost' ? 'fa-search' : 'fa-check-circle'}`}></i>
                      {String(item.type).toUpperCase()}
                    </div>
                    {renderItemStatusBadge(status)}
                  </div>

                  <div className="admin-item-body">
                    {item.image ? (
                      <div className="admin-item-image">
                        <img
                          src={`${apiBase}/uploads/items/${item.image}`}
                          alt={item.title || 'Item'}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <div className="admin-item-icon hidden">
                          {item.type === 'lost' ? '🔍' : '✅'}
                        </div>
                      </div>
                    ) : (
                      <div className="admin-item-icon">
                        {item.type === 'lost' ? '🔍' : '✅'}
                      </div>
                    )}
                    <div className="admin-item-content">
                      <h4 className="admin-item-title">{item.title || 'Untitled'}</h4>
                      <p className="admin-item-location">
                        <i className="fas fa-map-marker-alt"></i> {item.location || '—'}
                      </p>
                      <div className="admin-item-meta">
                        <span className="admin-item-owner">
                          <i className="fas fa-user"></i> #{ownerId} {ownerName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="admin-item-footer">
                    {isOwnerBlocked ? (
                      <span
                        className="admin-item-warning"
                        title="Owner verification is pending/unverified"
                      >
                        <i className="fas fa-exclamation-triangle"></i> Owner needs verification
                      </span>
                    ) : (
                      <div className="admin-item-actions">
                        <button
                          className="admin-action-btn resolve"
                          onClick={() => toggleItemResolve(item.id, isSolved ? 'active' : 'solved')}
                          title={isSolved ? 'Reopen item' : 'Mark as solved'}
                        >
                          <i className={`fas ${isSolved ? 'fa-undo' : 'fa-check-circle'}`}></i>
                          {isSolved ? 'Reopen' : 'Solve'}
                        </button>
                        <button
                          className="admin-action-btn delete"
                          onClick={async () => {
                            if (!window.confirm('Delete this item report permanently?')) return;
                            try {
                              const res = await fetch(`${apiBase}/items/${item.id}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              if (res.ok) {
                                showToast('Item deleted', 'success');
                                window.location.reload();
                              } else {
                                showToast('Failed to delete item', 'error');
                              }
                            } catch {
                              showToast('Error deleting item', 'error');
                            }
                          }}
                          title="Delete item"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* USERS ACCOUNTS TABLE */}
      {activeTab === 'accounts' && (
      <div className="panel-card" style={{ marginTop: '22px' }}>
        <div className="panel-header">
          <i className="fas fa-users-cog"></i> Account Records
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-soft)' }}>
            <i className="fas fa-circle-notch fa-spin" style={{ marginRight: '8px' }}></i> Loading account index...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-soft)' }}>
            No accounts found matching current query parameters.
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1.5px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>ID</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Name</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Email ID (Hover Card)</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Role</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const status = getUserVerificationStatus(u);
                  const isPending = status === 'pending';
                  const docMeta = getDocMeta(u);

                  return (
                    <tr
                      key={u.id}
                      style={{ borderBottom: '1px solid var(--border-soft)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px', fontWeight: 600 }}>#{u.id}</td>
                      <td style={{ padding: '12px' }} className="admin-name-cell">
                        {u.name || 'Anonymous'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          className="admin-email-cell"
                          onMouseEnter={e => handleMouseEnterEmail(u, e)}
                          onMouseLeave={handleMouseLeaveEmail}
                        >
                          {u.email}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            background: u.role === 'admin' ? 'var(--lost-bg)' : 'var(--found-bg)',
                            color: u.role === 'admin' ? 'var(--lost)' : 'var(--found)',
                            padding: '3px 8px',
                            borderRadius: 'var(--r-pill)',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {renderStatusBadge(status)}
                        {renderSuspendedBadge(u)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {docMeta && (
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ padding: '4px 10px', marginRight: '6px' }}
                            onClick={() => setPreviewDocUser(u)}
                            title="View Scanned Documents"
                          >
                            <i className="fas fa-id-card"></i> View ID
                          </button>
                        )}
                        {isPending && (
                          <>
                            <button
                              className="icon-btn resolve"
                              style={{ padding: '4px 8px', marginRight: '4px' }}
                              onClick={() => handleVerifyUser(u.id, 'verified')}
                              title="Approve verification claim"
                            >
                              <i className="fas fa-check"></i>
                            </button>
                            <button
                              className="icon-btn del"
                              style={{ padding: '4px 8px', marginRight: '4px' }}
                              onClick={() => handleVerifyUser(u.id, 'rejected')}
                              title="Reject verification claim"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </>
                        )}
                        {u.role !== 'admin' && (
                          <>
                            {u.isSuspended ? (
                              <button
                                className="icon-btn resolve"
                                style={{ padding: '4px 8px', marginRight: '4px' }}
                                onClick={() => handleSuspendUser(u.id, u.name || u.email || 'User', false)}
                                title="Lift suspension"
                              >
                                <i className="fas fa-unlock"></i>
                              </button>
                            ) : (
                              <button
                                className="icon-btn"
                                style={{ padding: '4px 8px', marginRight: '4px', color: '#b91c1c' }}
                                onClick={() => handleSuspendUser(u.id, u.name || u.email || 'User', true)}
                                title="Suspend account"
                              >
                                <i className="fas fa-ban"></i>
                              </button>
                            )}
                            <button
                              className="icon-btn del"
                              style={{ padding: '4px 8px' }}
                              onClick={() => handleDeleteUser(u.id, u.name || u.email || 'this user')}
                              title="Purge user account"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* FLOAT DETAILS POPOVER */}
      {popoverUser && (
        <div
          id="adminUserPopover"
          style={{
            position: 'absolute',
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
          }}
          onMouseEnter={() => {
            if (popoverHideTimerRef.current) clearTimeout(popoverHideTimerRef.current);
          }}
          onMouseLeave={() => {
            setPopoverUser(null);
          }}
        >
          <div className="admin-popover-header">
            <div className="admin-popover-avatar">
              {(popoverUser.name || popoverUser.email || '?').charAt(0).toUpperCase()}
            </div>
          <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                {popoverUser.name || 'Anonymous'}
              </div>
<div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis' }}>

                {popoverUser.email}
              </div>
            </div>
          </div>
          <div className="admin-popover-body">

            <div className="admin-popover-row">
              <span className="label">User ID</span>
              <span className="value">#{popoverUser.id}</span>
            </div>
            <div className="admin-popover-row">
              <span className="label">Access Scope</span>
              <span className="value" style={{ textTransform: 'capitalize' }}>{popoverUser.role}</span>
            </div>
            {popoverUser.isSuspended && (
              <div className="admin-popover-row">
                <span className="label">Suspended</span>
                <span className="value" style={{ color: '#b91c1c', fontWeight: 700 }}>
                  {popoverUser.suspendReason || 'Yes'}
                </span>
              </div>
            )}
            <div className="admin-popover-row">
              <span className="label">Auth Provider</span>
              <span className="value" style={{ textTransform: 'capitalize' }}>{popoverUser.provider || 'local'}</span>
            </div>
            <div className="admin-popover-row">
              <span className="label">Residence</span>
              <span className="value">{popoverUser.address || '—'}</span>
            </div>
            <div className="admin-popover-row">
              <span className="label">Platform Feeds</span>
              <span className="value">{countUserItems(popoverUser.id)} reported</span>
            </div>
            <div className="admin-popover-row">
              <span className="label">Doc Status</span>
              <span className="value">{getUserVerificationStatus(popoverUser).toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW DIALOG MODAL */}
      {previewDocUser && (() => {
        const meta = getDocMeta(previewDocUser);
        if (!meta) return null;

        const status = getUserVerificationStatus(previewDocUser);
        const isPending = status === 'pending';

        return (
          <div className="modal active" onClick={() => setPreviewDocUser(null)} style={{ zIndex: 3000 }}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="modal-title">
                <h3>🪪 Scanned ID Documents Preview</h3>
                <button className="modal-close" onClick={() => setPreviewDocUser(null)}>
                  &times;
                </button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>Claimant:</span>{' '}
                <strong style={{ fontSize: '0.9rem' }}>{previewDocUser.name} ({previewDocUser.email})</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: '4px' }}>
                  Document Category: <strong>{meta.label}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ flex: 1, minWidth: '260px', textAlign: 'center' }}>
                  <label style={{ marginBottom: '6px', display: 'block' }}>Front Page Scan</label>
                  <SecureImage url={meta.frontUrl} token={token} alt="Front page document preview" />
                </div>

                {meta.hasBack && meta.backUrl && (
                  <div style={{ flex: 1, minWidth: '260px', textAlign: 'center' }}>
                    <label style={{ marginBottom: '6px', display: 'block' }}>Back Page Scan</label>
                    <SecureImage url={meta.backUrl} token={token} alt="Back page document preview" />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                {isPending ? (
                  <>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => {
                        handleVerifyUser(previewDocUser.id, 'verified');
                        setPreviewDocUser(null);
                      }}
                    >
                      Approve Verification
                    </button>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, background: 'var(--lost-bg)', color: 'var(--lost)', boxShadow: 'none', justifyContent: 'center' }}
                      onClick={() => {
                        handleVerifyUser(previewDocUser.id, 'rejected');
                        setPreviewDocUser(null);
                      }}
                    >
                      Reject & Delete Claims
                    </button>
                  </>
                ) : (
                  <div style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '12px',
                    borderRadius: '8px',
                    background: status === 'verified' ? 'var(--found-bg)' : 'var(--surface-2)',
                    color: status === 'verified' ? 'var(--found)' : 'var(--text-soft)',
                    fontWeight: 700,
                    border: `1px solid ${status === 'verified' ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`
                  }}>
                    {status === 'verified' ? (
                      <><i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i> Verified User</>
                    ) : (
                      <><i className="fas fa-times-circle" style={{ marginRight: '8px' }}></i> Application Rejected</>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/*REVIEWS  */}
      {activeTab === 'reviews' && (
      <div className="panel-card" style={{ marginTop: '22px' }}>
        <div className="panel-header">
          <i className="fas fa-star"></i> Reviews Moderation
        </div>

        <div className="admin-users-toolbar" style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['all', 'platform', 'user', 'hidden'] as const).map(f => (
              <button
                key={f}
                className={`admin-filter-pill ${reviewsFilter === f ? 'active' : ''}`}
                onClick={() => setReviewsFilter(f)}
              >
                {f === 'all' ? `All (${allReviews.length})` : f === 'hidden' ? `Hidden (${allReviews.filter(r => r.isHidden).length})` : f === 'platform' ? `Platform (${allReviews.filter(r => r.type === 'platform').length})` : `User (${allReviews.filter(r => r.type === 'user').length})`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          {reviewsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-soft)' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ marginRight: '8px' }}></i> Loading reviews...
            </div>
          ) : (() => {
            const filtered = allReviews.filter(r => {
              if (reviewsFilter === 'hidden') return r.isHidden;
              if (reviewsFilter === 'platform') return r.type === 'platform';
              if (reviewsFilter === 'user') return r.type === 'user';
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-soft)' }}>
                  <i className="fas fa-comment-slash" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}></i>
                  <div>No reviews found.</div>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filtered.map(review => (
                  <div
                    key={review.id}
                    style={{
                      background: review.isHidden ? 'rgba(239,68,68,0.05)' : 'var(--surface-2)',
                      padding: '16px',
                      borderRadius: '12px',
                      border: `1px solid ${review.isHidden ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                      opacity: review.isHidden ? 0.7 : 1,
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          {review.reviewer?.name || 'Anonymous'}
                        </strong>
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '99px',
                          background: review.type === 'platform' ? '#e0e7ff' : 'var(--found-bg)',
                          color: review.type === 'platform' ? '#4f46e5' : 'var(--found)',
                          textTransform: 'uppercase',
                        }}>
                          {review.type}
                        </span>
                        {review.isHidden && (
                          <span style={{
                            marginLeft: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '99px',
                            background: 'var(--lost-bg)',
                            color: 'var(--lost)',
                            textTransform: 'uppercase',
                          }}>
                            HIDDEN
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#f59e0b', fontSize: '0.85rem', letterSpacing: '2px' }}>
                        {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                      </div>
                    </div>

                    {/* Comment */}
                    {review.comment && (
                      <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        "{review.comment}"
                      </p>
                    )}

                    {/* Target info */}
                    {review.type === 'user' && review.targetUser && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-soft)', marginBottom: '8px' }}>
                        <i className="fas fa-arrow-right" style={{ marginRight: '4px' }}></i>
                        Review for: <strong>{review.targetUser.name || review.targetUser.email}</strong>
                      </div>
                    )}

                    {/* Existing admin response */}
                    {review.adminResponse && (
                      <div style={{
                        background: 'rgba(79,70,229,0.06)',
                        border: '1px solid rgba(79,70,229,0.15)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '8px',
                        fontSize: '0.82rem',
                        color: 'var(--text-main)',
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4f46e5', marginBottom: '4px' }}>
                          <i className="fas fa-shield-alt" style={{ marginRight: '4px' }}></i>ADMIN RESPONSE
                        </div>
                        {review.adminResponse}
                      </div>
                    )}

                    {/* Response input */}
                    {respondingReviewId === review.id && (
                      <div style={{ marginBottom: '8px' }}>
                        <textarea
                          rows={2}
                          placeholder="Write an admin response..."
                          value={responseText}
                          onChange={e => setResponseText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            resize: 'vertical',
                          }}
                        ></textarea>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          <button
                            className="btn-primary"
                            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                            onClick={async () => {
                              try {
                                const res = await fetch(`${apiBase}/reviews/admin/${review.id}`, {
                                  method: 'PATCH',
                                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ adminResponse: responseText.trim() }),
                                });
                                if (res.ok) {
                                  showToast('Response saved!', 'success');
                                  setRespondingReviewId(null);
                                  setResponseText('');
                                  fetchAllReviews();
                                } else {
                                  showToast('Failed to save response', 'error');
                                }
                              } catch { showToast('Connection error', 'error'); }
                            }}
                          >
                            Save Response
                          </button>
                          <button
                            className="icon-btn"
                            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                            onClick={() => { setRespondingReviewId(null); setResponseText(''); }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                      <button
                        className="icon-btn"
                        style={{ padding: '4px 10px' }}
                        onClick={() => {
                          setRespondingReviewId(review.id);
                          setResponseText(review.adminResponse || '');
                        }}
                        title="Respond to this review"
                      >
                        <i className="fas fa-reply"></i> Respond
                      </button>
                      <button
                        className={`icon-btn ${review.isHidden ? 'resolve' : 'del'}`}
                        style={{ padding: '4px 10px' }}
                        onClick={async () => {
                          try {
                            const res = await fetch(`${apiBase}/reviews/admin/${review.id}`, {
                              method: 'PATCH',
                              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ isHidden: !review.isHidden }),
                            });
                            if (res.ok) {
                              showToast(review.isHidden ? 'Review made visible' : 'Review hidden', 'success');
                              fetchAllReviews();
                            } else {
                              showToast('Failed to toggle visibility', 'error');
                            }
                          } catch { showToast('Connection error', 'error'); }
                        }}
                      >
                        <i className={`fas ${review.isHidden ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                        {review.isHidden ? 'Show' : 'Hide'}
                      </button>
                      <button
                        className="icon-btn del"
                        style={{ padding: '4px 10px' }}
                        onClick={async () => {
                          if (!window.confirm('Permanently delete this review?')) return;
                          try {
                            const res = await fetch(`${apiBase}/reviews/admin/${review.id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            if (res.ok) {
                              showToast('Review deleted', 'success');
                              fetchAllReviews();
                            } else {
                              showToast('Failed to delete review', 'error');
                            }
                          } catch { showToast('Connection error', 'error'); }
                        }}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>

                    {/* Date */}
                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-soft)' }}>
                      {new Date(review.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
      )}

      {/* CLAIMS AUDIT LOG */}
      {activeTab === 'claims' && (
      <div className="panel-card" style={{ marginTop: '22px' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><i className="fas fa-clipboard-list"></i> Claim Requests Audit Log</span>
          <button className="icon-btn" onClick={fetchClaims} title="Refresh claims" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
            <i className="fas fa-sync-alt"></i> Refresh
          </button>
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '14px 0 4px' }}>
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => {
            const count = f === 'all' ? claims.length : claims.filter(c => c.status?.toLowerCase() === f).length;
            const colors: Record<string, { bg: string; color: string }> = {
              all: { bg: 'var(--surface-2)', color: 'var(--text-main)' },
              pending: { bg: 'var(--reward-bg)', color: 'var(--reward)' },
              approved: { bg: 'var(--found-bg)', color: 'var(--found)' },
              rejected: { bg: 'var(--lost-bg)', color: 'var(--lost)' },
            };
            const c = colors[f];
            return (
              <button
                key={f}
                onClick={() => setClaimsFilter(f)}
                style={{
                  padding: '5px 14px',
                  borderRadius: '99px',
                  border: `1.5px solid ${claimsFilter === f ? c.color : 'var(--border)'}`,
                  background: claimsFilter === f ? c.bg : 'transparent',
                  color: claimsFilter === f ? c.color : 'var(--text-soft)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize',
                }}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: '12px' }}>
          {claimsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-soft)' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ marginRight: '8px' }}></i> Loading claim requests...
            </div>
          ) : (() => {
            const filtered = claims.filter(c => claimsFilter === 'all' || c.status?.toLowerCase() === claimsFilter);
            if (filtered.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-soft)' }}>
                  <i className="fas fa-clipboard" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}></i>
                  <div>No {claimsFilter !== 'all' ? claimsFilter : ''} claim requests found.</div>
                </div>
              );
            }
            return (
              <div className="admin-table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1.5px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>#</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Status</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Claimant</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Item</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Item Owner</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Proof Message</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Requested At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c: any) => {
                      const status = (c.status || 'pending').toLowerCase();
                      const statusStyle: Record<string, React.CSSProperties> = {
                        pending: { background: 'var(--reward-bg)', color: 'var(--reward)', border: '1px solid rgba(245,158,11,0.2)' },
                        approved: { background: 'var(--found-bg)', color: 'var(--found)', border: '1px solid rgba(34,197,94,0.25)' },
                        rejected: { background: 'var(--lost-bg)', color: 'var(--lost)', border: '1px solid rgba(239,68,68,0.2)' },
                      };
                      const badge = statusStyle[status] || statusStyle.pending;
                      return (
                        <tr
                          key={c.id}
                          style={{ borderBottom: '1px solid var(--border-soft)', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-soft)' }}>#{c.id}</td>
                          <td style={{ padding: '12px' }}>
                            <span className="status-badge" style={{ ...badge, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                              {status === 'approved' && <i className="fas fa-check" style={{ marginRight: '4px' }}></i>}
                              {status === 'rejected' && <i className="fas fa-times" style={{ marginRight: '4px' }}></i>}
                              {status === 'pending' && <i className="fas fa-hourglass-half" style={{ marginRight: '4px' }}></i>}
                              {status}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>
                                {(c.user?.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600 }}>{c.user?.name || 'Unknown'}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>{c.user?.email || ''}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ fontWeight: 600 }}>{c.item?.title || <em style={{ color: 'var(--text-soft)' }}>Deleted</em>}</span>
                            {c.item?.type && (
                              <span className={`status-badge ${c.item.type === 'lost' ? 'lost-tag' : 'found-tag'}`} style={{ marginLeft: '6px', fontSize: '0.6rem' }}>
                                {c.item.type.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                            {c.item?.user?.name || '—'}
                          </td>
                          <td style={{ padding: '12px', maxWidth: '220px' }}>
                            {c.proofMessage ? (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                "{c.proofMessage}"
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-soft)', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-soft)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                            {new Date(c.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>
      )}

      {/* DISPUTES & REPORTS MANAGEMENT */}
      {activeTab === 'disputes' && (
      <div className="panel-card" style={{ marginTop: '22px' }}>
        <div className="panel-header">
          <i className="fas fa-gavel"></i> Disputes & Reports
        </div>

        <div className="admin-users-toolbar" style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['all', 'pending', 'resolved'] as const).map(f => (
              <button
                key={f}
                className={`admin-filter-pill ${disputesFilter === f ? 'active' : ''}`}
                onClick={() => setDisputesFilter(f)}
              >
                {f === 'all' ? `All (${disputes.length})` : f === 'pending' ? `Pending (${disputes.filter(d => d.status === 'pending').length})` : `Resolved (${disputes.filter(d => d.status === 'resolved').length})`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          {disputesLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-soft)' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ marginRight: '8px' }}></i> Loading disputes...
            </div>
          ) : (() => {
            const filtered = disputes.filter(d => {
              if (disputesFilter === 'pending') return d.status === 'pending';
              if (disputesFilter === 'resolved') return d.status === 'resolved';
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-soft)' }}>
                  <i className="fas fa-check-double" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}></i>
                  <div>No disputes found.</div>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filtered.map((dispute: any) => (
                  <div
                    key={dispute.id}
                    style={{
                      background: dispute.status === 'resolved' ? 'rgba(34,197,94,0.04)' : 'var(--surface-2)',
                      padding: '16px',
                      borderRadius: '12px',
                      border: `1px solid ${dispute.status === 'resolved' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--lost-bg)', color: 'var(--lost)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                          {(dispute.reporter?.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {dispute.reporter?.name || 'Anonymous'}
                          </strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>
                            {dispute.reporter?.email || ''}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 10px',
                        borderRadius: '99px',
                        background: dispute.status === 'resolved' ? 'var(--found-bg)' : 'var(--lost-bg)',
                        color: dispute.status === 'resolved' ? 'var(--found)' : 'var(--lost)',
                        textTransform: 'uppercase',
                      }}>
                        {dispute.status}
                      </span>
                    </div>

                    {/* Reported Item Info */}
                    {dispute.item && (
                      <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', fontSize: '0.82rem', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-soft)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          <i className="fas fa-box" style={{ marginRight: '4px' }}></i> Reported Item
                        </div>
                        <strong>{dispute.item.title}</strong>
                        <span className={`status-badge ${dispute.item.type === 'lost' ? 'lost-tag' : 'found-tag'}`} style={{ marginLeft: '8px', fontSize: '0.6rem' }}>
                          {dispute.item.type?.toUpperCase()}
                        </span>
                        <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--text-soft)' }}>
                          by {dispute.item.user?.name || 'Unknown'}
                        </span>
                      </div>
                    )}

                    {/* Reason */}
                    <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                      <strong>Reason:</strong> "{dispute.reason}"
                    </p>

                    {/* Admin response display */}
                    {dispute.adminResponse && (
                      <div style={{
                        background: 'rgba(79,70,229,0.06)',
                        border: '1px solid rgba(79,70,229,0.15)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '8px',
                        fontSize: '0.82rem',
                        color: 'var(--text-main)',
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4f46e5', marginBottom: '4px' }}>
                          <i className="fas fa-shield-alt" style={{ marginRight: '4px' }}></i>ADMIN RESPONSE
                        </div>
                        {dispute.adminResponse}
                      </div>
                    )}

                    {/* Response input */}
                    {respondingDisputeId === dispute.id && (
                      <div style={{ marginBottom: '8px' }}>
                        <textarea
                          rows={2}
                          placeholder="Write admin response..."
                          value={disputeResponseText}
                          onChange={e => setDisputeResponseText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            resize: 'vertical',
                          }}
                        ></textarea>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          <button
                            className="btn-primary"
                            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                            onClick={() => handleResolveDispute(dispute.id, 'resolved', disputeResponseText.trim())}
                          >
                            Resolve with Response
                          </button>
                          <button
                            className="icon-btn"
                            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                            onClick={() => { setRespondingDisputeId(null); setDisputeResponseText(''); }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                      {dispute.item?.user?.id && dispute.item.user.role !== 'admin' && (
                        <button
                          className="icon-btn"
                          style={{ padding: '4px 10px', color: '#b91c1c' }}
                          onClick={() =>
                            handleSuspendUser(
                              dispute.item.user.id,
                              dispute.item.user.name || dispute.item.user.email || 'Item owner',
                              !dispute.item.user.isSuspended,
                            )
                          }
                          title="Suspend the reported item owner"
                        >
                          <i className={`fas ${dispute.item.user.isSuspended ? 'fa-unlock' : 'fa-ban'}`}></i>
                          {dispute.item.user.isSuspended ? 'Unsuspend Owner' : 'Suspend Owner'}
                        </button>
                      )}
                      {dispute.reporter?.id && dispute.reporter.role !== 'admin' && (
                        <button
                          className="icon-btn"
                          style={{ padding: '4px 10px', color: '#b91c1c' }}
                          onClick={() =>
                            handleSuspendUser(
                              dispute.reporter.id,
                              dispute.reporter.name || dispute.reporter.email || 'Reporter',
                              !dispute.reporter.isSuspended,
                            )
                          }
                          title="Suspend the user who filed this report"
                        >
                          <i className={`fas ${dispute.reporter.isSuspended ? 'fa-unlock' : 'fa-ban'}`}></i>
                          {dispute.reporter.isSuspended ? 'Unsuspend Reporter' : 'Suspend Reporter'}
                        </button>
                      )}
                      {dispute.status === 'pending' && (
                        <>
                          <button
                            className="icon-btn"
                            style={{ padding: '4px 10px' }}
                            onClick={() => {
                              setRespondingDisputeId(dispute.id);
                              setDisputeResponseText(dispute.adminResponse || '');
                            }}
                          >
                            <i className="fas fa-reply"></i> Respond & Resolve
                          </button>
                          <button
                            className="icon-btn resolve"
                            style={{ padding: '4px 10px' }}
                            onClick={() => handleResolveDispute(dispute.id, 'resolved')}
                          >
                            <i className="fas fa-check"></i> Resolve
                          </button>
                        </>
                      )}
                      {dispute.status === 'resolved' && (
                        <button
                          className="icon-btn"
                          style={{ padding: '4px 10px' }}
                          onClick={() => handleResolveDispute(dispute.id, 'pending')}
                        >
                          <i className="fas fa-undo"></i> Reopen
                        </button>
                      )}
                    </div>

                    {/* Date */}
                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-soft)' }}>
                      {new Date(dispute.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
      )}

      {/* GLOBAL ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
      <div className="panel-card" style={{ marginTop: '22px' }}>
        <div className="panel-header">
          <i className="fas fa-bullhorn"></i> Send Global Announcement
        </div>
        <div style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', marginBottom: '12px' }}>
            Send a notification to <strong>all registered users</strong> on the platform. Use this for important updates, maintenance notices, or community alerts.
          </p>
          <textarea
            rows={3}
            placeholder="Write your announcement message here..."
            value={announcementText}
            onChange={e => setAnnouncementText(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-main)',
              fontSize: '0.9rem',
              resize: 'vertical',
              marginBottom: '12px',
            }}
          ></textarea>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-soft)' }}>
              {announcementText.length > 0 ? `${announcementText.length} characters` : 'No message entered'}
            </span>
            <button
              className="btn-primary"
              onClick={() => {
                if (!announcementText.trim()) return;
                setShowAnnounceConfirm(true);
              }}
              disabled={isSendingAnnouncement || !announcementText.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <i className={`fas ${isSendingAnnouncement ? 'fa-circle-notch fa-spin' : 'fa-paper-plane'}`}></i>
              {isSendingAnnouncement ? 'Sending...' : `Send to All (${users.length} users)`}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Suspend / Unsuspend Account Modal */}
      {suspendDialog && (
        <div
          className="modal active"
          onClick={closeSuspendDialog}
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', animation: 'fadeIn 0.2s ease-out', zIndex: 10000 }}
        >
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              padding: '2rem',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                marginBottom: '1.25rem',
                backgroundColor: suspendDialog.mode === 'suspend' ? '#fef2f2' : '#ecfdf5',
                border: `1px solid ${suspendDialog.mode === 'suspend' ? '#fecaca' : '#a7f3d0'}`,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: suspendDialog.mode === 'suspend' ? '#ef4444' : '#059669',
              }}
            >
              <i
                className={`fas ${suspendDialog.mode === 'suspend' ? 'fa-ban' : 'fa-unlock'}`}
                style={{ fontSize: '1.5rem' }}
              />
            </div>

            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {suspendDialog.mode === 'suspend' ? 'Suspend Account' : 'Lift Suspension'}
            </h3>

            <p style={{ marginBottom: '1.25rem', color: 'var(--text-soft)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              {suspendDialog.mode === 'suspend' ? (
                <>
                  You are about to suspend <strong style={{ color: 'var(--text-main)' }}>{suspendDialog.name}</strong>.
                  They will be blocked from login, posting, chatting, and all other actions until you unsuspend them.
                </>
              ) : (
                <>
                  Restore access for <strong style={{ color: 'var(--text-main)' }}>{suspendDialog.name}</strong>?
                  They will be able to log in and use Findit again.
                </>
              )}
            </p>

            {suspendDialog.mode === 'suspend' && (
              <>
                <label
                  htmlFor="suspend-reason"
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-soft)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                  }}
                >
                  Reason (shown to the user)
                </label>
                <textarea
                  id="suspend-reason"
                  rows={4}
                  placeholder="Describe why this account is being suspended..."
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface-2)',
                    color: 'var(--text-main)',
                    fontSize: '0.92rem',
                    marginBottom: '1.25rem',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1.25rem' }}>
                  {[
                    'Fraudulent claim',
                    'Fake or misleading listing',
                    'Harassment in chat',
                    'Repeated policy violations',
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSuspendReason(preset)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '99px',
                        border: '1px solid var(--border)',
                        background: suspendReason === preset ? 'var(--lost-bg)' : 'transparent',
                        color: suspendReason === preset ? 'var(--lost)' : 'var(--text-soft)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={closeSuspendDialog}
                disabled={isSuspending}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  backgroundColor: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  cursor: isSuspending ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmSuspendAction}
                disabled={isSuspending || (suspendDialog.mode === 'suspend' && !suspendReason.trim())}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: suspendDialog.mode === 'suspend' ? '#dc2626' : undefined,
                  borderColor: suspendDialog.mode === 'suspend' ? '#dc2626' : undefined,
                  opacity: isSuspending || (suspendDialog.mode === 'suspend' && !suspendReason.trim()) ? 0.6 : 1,
                }}
              >
                {isSuspending ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin" />
                    Processing...
                  </>
                ) : suspendDialog.mode === 'suspend' ? (
                  <>
                    <i className="fas fa-ban" />
                    Suspend Account
                  </>
                ) : (
                  <>
                    <i className="fas fa-unlock" />
                    Unsuspend
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Confirmation Modal */}
      {showAnnounceConfirm && (
        <div className="modal active" onClick={() => setShowAnnounceConfirm(false)} style={{ backgroundColor: 'rgba(0,0,0,0.6)', animation: 'fadeIn 0.2s ease-out', zIndex: 10000 }}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '2rem', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid var(--border)', animation: 'slideUp 0.3s ease-out' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem', fontWeight: '600', color: '#0f172a' }}>Confirm Announcement</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-soft)' }}>
              Send this announcement to all {users.length} users?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-outline"
                onClick={() => setShowAnnounceConfirm(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  backgroundColor: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-2)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                disabled={isSendingAnnouncement} 
                onClick={async () => {
                  setShowAnnounceConfirm(false);
                  const success = await handleSendAnnouncement();
                  setAnnounceResult(success ? 'Announcement sent successfully.' : 'Failed to send announcement.');
                }} 
                style={{ 
                  flex: 1, 
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.95rem'
                }}
              >
                {isSendingAnnouncement ? (
                  <><i className="fas fa-circle-notch fa-spin" style={{ marginRight: '8px' }}></i> Sending...</>
                ) : (
                  <><i className="fas fa-paper-plane" style={{ marginRight: '8px' }}></i> Send</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Result Modal */}
      {announceResult && (
        <div className="modal active" onClick={() => setAnnounceResult(null)} style={{ backgroundColor: 'rgba(0,0,0,0.6)', animation: 'fadeIn 0.2s ease-out', zIndex: 10000 }}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '2rem', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid var(--border)', animation: 'slideUp 0.3s ease-out' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem', fontWeight: '600', color: '#0f172a' }}>Announcement Result</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-soft)' }}>{announceResult}</p>
           
          </div>
        </div>
      )}

    </div>
  );
};
