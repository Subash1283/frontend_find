import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import {
  DASHBOARD_PATHS,
  DASHBOARD_PAGE_META,
  overlayPageMeta,
  parseDashboardPath,
  viewToPath,
  type ChatLocationState,
  type DashboardView,
} from '../lib/dashboardRoutes';
import { io, Socket } from 'socket.io-client';
import { ReportModal } from './ReportModal';
import { EditModal } from './EditModal';
import { ItemDetailsModal } from './ItemDetailsModal';
import { InboxModal } from './InboxModal';
import { ProfileModal } from './ProfileModal';
import { P2PChatModal } from './P2PChatModal';
import { AdminPanel } from './AdminPanel';
import { AIChatbot } from './AIChatbot';
import { NotificationsModal } from './NotificationsModal';
import { PlatformReviewModal } from './PlatformReviewModal';

interface DashboardProps {
  token: string;
  currentUser: any;
  setCurrentUser: React.Dispatch<React.SetStateAction<any>>;
  apiBase: string;
  onLogout: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  token,
  currentUser,
  setCurrentUser,
  apiBase,
  onLogout,
  showToast,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<DashboardView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [prevVerificationStatus, setPrevVerificationStatus] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; itemId: number | null; itemName: string; itemType: 'item' | 'user' }>({ show: false, itemId: null, itemName: '', itemType: 'item' });
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  // Track verification status changes and show notification
  useEffect(() => {
    const currentStatus = currentUser?.verificationStatus || (currentUser?.isVerified ? 'verified' : 'unverified');
    
    if (prevVerificationStatus !== null && prevVerificationStatus !== currentStatus) {
      if (currentStatus === 'verified') {
        setVerificationMessage({ text: '🎉 Verification Successful! Your identity has been verified. You can now post and claim items.', type: 'success' });
      } else if (currentStatus === 'rejected') {
        setVerificationMessage({ text: '❌ Verification Failed. Your document did not match our records. Please re-upload in Profile Settings.', type: 'error' });
      }
      
      // Auto-dismiss after 10 seconds
      setTimeout(() => setVerificationMessage(null), 10000);
    }
    
    setPrevVerificationStatus(currentStatus);
  }, [currentUser?.verificationStatus, currentUser?.isVerified]);

  // Modals state
  const [showReport, setShowReport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsItemId, setDetailsItemId] = useState<number | null>(null);
  const [showInbox, setShowInbox] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeChat, setActiveChat] = useState<{ itemId: number; title: string; otherUserId: number } | null>(null);
  const [showPlatformReview, setShowPlatformReview] = useState(false);
  const [reviewItemId, setReviewItemId] = useState<number | null>(null);

  // Map references
  const dashboardMapRef = useRef<L.Map | null>(null);
  const fullMapRef = useRef<L.Map | null>(null);
  const dashboardMarkersRef = useRef<L.Marker[]>([]);
  const fullMarkersRef = useRef<L.Marker[]>([]);

  // Socket reference
  const socketRef = useRef<Socket | null>(null);

  // Audio Context for sound alerts
  const audioCtxRef = useRef<AudioContext | null>(null);

  const isPostingLocked =
    currentUser?.role !== 'admin' &&
    (currentUser?.verificationStatus === 'rejected' || currentUser?.verificationStatus === 'unverified');

  const closeOverlay = useCallback(() => {
    navigate(viewToPath(viewMode));
  }, [navigate, viewMode]);

  // Keep UI in sync with URL (browser back/forward, direct links, OAuth redirect)
  useEffect(() => {
    const parsed = parseDashboardPath(location.pathname);

    if (parsed.kind === 'unknown') {
      navigate(DASHBOARD_PATHS.home, { replace: true });
      return;
    }

    if (parsed.kind === 'view') {
      if (parsed.view === 'admin' && currentUser?.role !== 'admin') {
        navigate(DASHBOARD_PATHS.home, { replace: true });
        return;
      }
      setViewMode(parsed.view);
      setShowInbox(false);
      setShowProfile(false);
      setShowReport(false);
      setShowDetails(false);
      setDetailsItemId(null);
      setShowEdit(false);
      setEditItemId(null);
      setActiveChat(null);
      setShowPlatformReview(false);
      setReviewItemId(null);
      return;
    }

    if (parsed.kind === 'inbox') {
      setShowInbox(true);
      return;
    }

    if (parsed.kind === 'profile') {
      setShowProfile(true);
      return;
    }

    if (parsed.kind === 'report') {
      setShowReport(true);
      return;
    }

    if (parsed.kind === 'item') {
      setDetailsItemId(parsed.itemId);
      setShowDetails(true);
      return;
    }

    if (parsed.kind === 'edit') {
      setEditItemId(parsed.itemId);
      setShowEdit(true);
      return;
    }

    if (parsed.kind === 'chat') {
      const state = location.state as ChatLocationState | null;
      if (state?.otherUserId) {
        setActiveChat({
          itemId: parsed.itemId,
          title: state.title || 'Chat',
          otherUserId: state.otherUserId,
        });
      } else {
        navigate(DASHBOARD_PATHS.home, { replace: true });
      }
    }
  }, [location.pathname, location.state, currentUser?.role, navigate]);

  const playSound = (type: 'send' | 'receive') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t = audioCtx.currentTime;

      if (type === 'send') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.start(t);
        osc.stop(t + 0.1);
      } else {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        const gain2 = audioCtx.createGain();
        osc1.connect(gain1);
        osc2.connect(gain2);
        gain1.connect(audioCtx.destination);
        gain2.connect(audioCtx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, t);
        gain1.gain.setValueAtTime(0, t);
        gain1.gain.linearRampToValueAtTime(0.3, t + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1760, t);
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.1, t + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc1.start(t);
        osc1.stop(t + 0.5);
        osc2.start(t);
        osc2.stop(t + 0.3);
      }
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  };

  // Fetch Items
  const loadItems = async () => {
    try {
      let url = `${apiBase}/items`;
      if (viewMode === 'myItems') {
        url = `${apiBase}/items/me`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      showToast('Error loading items list', 'error');
    }
  };

  // Fetch Notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${apiBase}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {}
  };

  const markNotificationRead = async (id: number) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      const res = await fetch(`${apiBase}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        fetchNotifications();
      }
    } catch (e) {
      fetchNotifications();
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      await Promise.all(
        notifications.filter(n => !n.isRead).map(n =>
          fetch(`${apiBase}/notifications/${n.id}/read`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
    } catch (e) {
      fetchNotifications();
    }
  };

  // Socket Connection Setup
  useEffect(() => {
    if (!token) return;

    const socketUrl = apiBase.replace('/api', '');
    const socket = io(socketUrl, {
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.io connected');
    });

    // Ensure inbox modal receives correct event and can stop loading.
    // Backend emits `inboxData` (not `inbox`).
    socket.removeAllListeners('inbox');
    socket.on('inboxData', (data: any) => {
      // Bubble up to whichever modal is listening via socket event.
      socket.emit('inbox', data);
    });


    socket.on('notification', (data: any) => {
      playSound('receive');
      showToast(`🔔 ${data.message || 'New notification!'}`, 'info');
      fetchNotifications();
      // Re-load profile status if user verification changed
      if (data.message && data.message.toLowerCase().includes('verification')) {
        // Reload user info
        fetchUser();
      }
    });

    socket.on('inbox', (data: any[]) => {
      // Calculate pending request counts
      let pending = 0;
      data.forEach(c => {
        if (
          c.conversation &&
          c.conversation.status === 'pending' &&
          Number(c.conversation.ownerId) === Number(currentUser.id)
        ) {
          pending++;
        }
      });
      setPendingRequestsCount(pending);
    });

    // Request initial inbox status
    socket.emit('getInbox');

    // Fetch notifications interval (every 15s)
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [currentUser?.id]);

  // Fetch items & notification on load and views change
  useEffect(() => {
    loadItems();
    // Poll items every 20 seconds to auto-refresh without reload
    const itemsInterval = setInterval(loadItems, 20000);
    return () => clearInterval(itemsInterval);
  }, [viewMode, token]);

  const fetchUser = async () => {
    try {
      const res = await fetch(`${apiBase}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.isSuspended) {
          showToast(
            data.suspendReason
              ? `Your account has been suspended. Reason: ${data.suspendReason}`
              : 'Your account has been suspended.',
            'error',
          );
          onLogout();
          return;
        }
        setCurrentUser(data);
        return;
      }
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (String(data.message || '').toLowerCase().includes('suspended')) {
          showToast(data.message || 'Your account has been suspended.', 'error');
          onLogout();
        }
      }
    } catch (e) {}
  };

  // Initialize and update Dashboard Card Map
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    
    if (viewMode === 'dashboard' && !showReport && !showEdit && !showDetails && !showInbox && !showProfile && !activeChat) {
      // Use double setTimeout to ensure DOM is fully rendered
      timeouts.push(setTimeout(() => {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        // Check if container has valid dimensions
        const rect = mapContainer.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          // Container not visible yet, retry after a short delay
          timeouts.push(setTimeout(() => {
            const retryContainer = document.getElementById('map');
            if (retryContainer) {
              if (dashboardMapRef.current) {
                dashboardMapRef.current.invalidateSize();
              }
            }
          }, 100));
          return;
        }

        if (!dashboardMapRef.current) {
          const map = L.map('map', { zoomControl: false }).setView([27.7172, 85.3240], 13);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO',
            maxZoom: 19,
          }).addTo(map);
          L.control.zoom({ position: 'topright' }).addTo(map);
          dashboardMapRef.current = map;
          
          // Handle map load errors
          map.on('tileerror', (e) => {
            console.warn('Map tile error:', e);
          });
          
          // Fix for white map issue - re-invalidate after tiles load
          map.once('load', () => {
            map.invalidateSize();
          });
        } else {
          dashboardMapRef.current.invalidateSize();
        }

        // Render markers
        dashboardMarkersRef.current.forEach(m => dashboardMapRef.current?.removeLayer(m));
        dashboardMarkersRef.current = [];

        items
          .filter(i => i.latitude && i.longitude)
          .forEach(item => {
            const icon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div class="${item.type === 'lost' ? 'map-marker-lost' : 'map-marker-found'}"><i class="fas ${
                item.type === 'lost' ? 'fa-search' : 'fa-check'
              }"></i></div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            });

            const popupHtml = `
              <div style="padding:5px; min-width:150px; font-family:'Outfit', sans-serif;">
                <h4 style="margin-bottom:5px; font-family:'Syne'; font-size:0.9rem; color:var(--text-main); font-weight:700;">${
                  item.title
                }</h4>
                <p style="font-size:0.75rem; color:var(--text-soft); margin-bottom:10px;">${item.location}</p>
                <button class="btn-primary" style="padding:4px 8px; font-size:0.7rem; width:100%; justify-content:center;" id="btn-popup-${item.id}">View Details</button>
              </div>
            `;

            const marker = L.marker([parseFloat(item.latitude), parseFloat(item.longitude)], { icon }).addTo(
              dashboardMapRef.current!
            );
            marker.bindPopup(popupHtml);
            
            marker.on('popupopen', () => {
              document.getElementById(`btn-popup-${item.id}`)?.addEventListener('click', () => {
                navigate(DASHBOARD_PATHS.item(item.id));
              });
            });

            dashboardMarkersRef.current.push(marker);
          });
      }, 200));
    }
    
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [viewMode, items, navigate, showReport, showEdit, showDetails, showInbox, showProfile, activeChat]);

  // Initialize and update Full Map View
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    if (viewMode !== 'mapview') return;

    timeouts.push(setTimeout(() => {
      const container = document.getElementById('fullMap');
      if (!container) return;

      // CREATE MAP ONLY ONCE
      if (!fullMapRef.current) {
        fullMapRef.current = L.map('fullMap', {
          zoomControl: false,
        }).setView([27.7172, 85.3240], 13);

        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          {
            attribution: '&copy; CARTO',
            maxZoom: 19,
          }
        ).addTo(fullMapRef.current);

        L.control.zoom({ position: 'topright' }).addTo(fullMapRef.current);
      }

      // FIX WHITE MAP ISSUE (trigger multiple reflows + redraw)
      timeouts.push(setTimeout(() => fullMapRef.current?.invalidateSize(true), 50));
      timeouts.push(setTimeout(() => fullMapRef.current?.invalidateSize(true), 150));
      timeouts.push(setTimeout(() => {
        // Force Leaflet to recompute view and re-render
        fullMapRef.current?.invalidateSize(true);
        fullMapRef.current?.panTo(fullMapRef.current.getCenter(), { animate: false });
      }, 300));

      // CLEAR OLD MARKERS
      fullMarkersRef.current.forEach(m => fullMapRef.current?.removeLayer(m));
      fullMarkersRef.current = [];

      // ADD MARKERS
      items
        .filter(i => i.latitude && i.longitude)
        .forEach(item => {
          const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `
              <div class="${item.type === 'lost' ? 'map-marker-lost' : 'map-marker-found'}">
                <i class="fas ${item.type === 'lost' ? 'fa-search' : 'fa-check'}"></i>
              </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });

          const popupHtml = `
            <div style="padding:5px; min-width:150px;">
              <h4 style="margin-bottom:5px;">${item.title}</h4>
              <p style="font-size:0.75rem;">${item.location}</p>
              <button id="btn-popup-full-${item.id}">View Details</button>
            </div>
          `;

          const marker = L.marker(
            [parseFloat(item.latitude), parseFloat(item.longitude)],
            { icon }
          ).addTo(fullMapRef.current!);

          marker.bindPopup(popupHtml);

          marker.on('popupopen', () => {
            document
              .getElementById(`btn-popup-full-${item.id}`)
              ?.addEventListener('click', () => {
                navigate(DASHBOARD_PATHS.item(item.id));
              });
          });

          fullMarkersRef.current.push(marker);
        });
    }, 200));

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [viewMode, items, navigate]);

  // Item card deletion - opens confirmation dialog
  const openDeleteDialog = (id: number, name: string, itemType: 'item' | 'user' = 'item') => {
    setDeleteConfirm({ show: true, itemId: id, itemName: name, itemType });
  };

  // Execute item deletion after confirmation
  const confirmDeleteItem = async () => {
    if (!deleteConfirm.itemId) return;
    try {
      const res = await fetch(`${apiBase}/items/${deleteConfirm.itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('Item deleted successfully', 'success');
        loadItems();
      } else {
        showToast('Failed to delete item', 'error');
      }
    } catch {
      showToast('Error trying to delete item', 'error');
    } finally {
      setDeleteConfirm({ show: false, itemId: null, itemName: '', itemType: 'item' });
    }
  };

  // Execute user deletion after confirmation (admin only)
  const confirmDeleteUser = async () => {
    if (!deleteConfirm.itemId) return;
    try {
      const res = await fetch(`${apiBase}/users/${deleteConfirm.itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('User deleted successfully', 'success');
        // Reload admin panel data if needed
        window.location.reload();
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to delete user', 'error');
      }
    } catch {
      showToast('Error trying to delete user', 'error');
    } finally {
      setDeleteConfirm({ show: false, itemId: null, itemName: '', itemType: 'item' });
    }
  };



  // Item status toggle (mark resolved)
  const handleResolveItem = async (item: any) => {
  const isCurrentlyActive = (item.status || 'active') === 'active';
  const nextStatus = isCurrentlyActive ? 'solved' : 'active';
  try {
    const res = await fetch(`${apiBase}/items/${item.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!res.ok) {
      const data = await res.json();
      showToast(data.message || 'Failed to update status', 'error');
      return;
    }

    showToast(`Item ${nextStatus === 'solved' ? 'solved' : 'reopened'} successfully`, 'success');
    loadItems();

    if (nextStatus === 'solved') {
      setReviewItemId(item.id);
      setShowPlatformReview(true);
    }
  } catch (error) {
    console.error('Error updating item status:', error);
    showToast('Error updating status', 'error');
  }


    try {
      const res = await fetch(`${apiBase}/items/${item.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.message || 'Failed to update status', 'error');
        return;
      }

      showToast(`Item ${nextStatus === 'solved' ? 'solved' : 'reopened'} successfully`, 'success');
      loadItems();

      if (nextStatus === 'solved') {
        setReviewItemId(item.id);
        setShowPlatformReview(true);
      }
    } catch (error) {
      console.error('Error updating item status:', error);
      showToast('Error updating status', 'error');
    }
  };

  // Filter and search
  const filteredItems = items.filter(item => {
    const matchSearch =
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = statusFilter === 'all' || item.type === statusFilter;
    return matchSearch && matchFilter;
  });

  // Sensitive details blur control state helper
  const [revealedSensitives, setRevealedSensitives] = useState<{ [key: number]: boolean }>({});





  // Stats computation
  const activeCount = items.filter(i => (i.status || 'active') === 'active').length;
  const lostCount = items.filter(i => i.type?.toLowerCase() === 'lost').length;
  const foundCount = items.filter(i => i.type?.toLowerCase() === 'found').length;

  const getVerificationStatusLabel = () => {
    const status = currentUser?.verificationStatus || (currentUser?.isVerified ? 'verified' : 'unverified');
    if (currentUser?.role === 'admin') return { label: 'Administrator 🛡️', color: 'var(--found)' };
    if (status === 'verified') return { label: 'Verified Profile ✓', color: 'var(--found)' };
    if (status === 'pending') return { label: 'Review Pending ⏳', color: 'var(--reward)' };
    return { label: 'Unverified Profile ⚠️', color: 'var(--lost)' };
  };

  const verStatus = getVerificationStatusLabel();
  const overlayMeta = overlayPageMeta(location.pathname);
  const pageMeta = overlayMeta ?? DASHBOARD_PAGE_META[viewMode];

  return (
    <div className={`dashboard-root${sidebarOpen ? ' sidebar-open' : ''}`}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close menu"
        onClick={() => setSidebarOpen(false)}
      />
      {/* SIDEBAR */}
      <aside className="sidebar">
        <Link to={DASHBOARD_PATHS.home} className="sidebar-logo">
          <div className="logo-mark">
            <i className="fas fa-search"></i>
          </div>
          <span className="logo-text">
            FIND<span>IT</span>
          </span>
        </Link>

        <div className="nav-section">
          <div className="nav-label">Navigation</div>

          <NavLink
            to={DASHBOARD_PATHS.home}
            end
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon"><i className="fas fa-chart-pie"></i></span>
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to={DASHBOARD_PATHS.items}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon"><i className="fas fa-user-tag"></i></span>
            <span>My Items</span>
          </NavLink>

          <NavLink
            to={DASHBOARD_PATHS.map}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon"><i className="fas fa-map-marked-alt"></i></span>
            <span>Geo-Map View</span>
          </NavLink>

          <NavLink
            to={DASHBOARD_PATHS.inbox}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon"><i className="fas fa-envelope"></i></span>
            <span>Inbox</span>
            {pendingRequestsCount > 0 && (
              <span className="nav-badge">{pendingRequestsCount}</span>
            )}
          </NavLink>

          <button
            type="button"
            className={`nav-item ${showNotifications ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', outline: 'none' }}
            onClick={() => {
              setSidebarOpen(false);
              setShowNotifications(true);
            }}
          >
            <span className="nav-icon"><i className="fas fa-bell"></i></span>
            <span>Notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="nav-badge" style={{ background: 'var(--reward)', color: 'white' }}>
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <NavLink
            to={DASHBOARD_PATHS.profile}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon"><i className="fas fa-user-cog"></i></span>
            <span>Profile Settings</span>
          </NavLink>

          {currentUser?.role === 'admin' && (
            <>
              <div className="nav-label">Management</div>
              <NavLink
                to={DASHBOARD_PATHS.admin}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon"><i className="fas fa-shield-alt"></i></span>
                <span>Admin Panel</span>
              </NavLink>
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="avatar">
              {(currentUser?.name || currentUser?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <div className="name">{currentUser?.name || 'User'}</div>
              <div className="role">{currentUser?.role || 'user'}</div>
            </div>
            <button className="logout-btn" onClick={onLogout} title="Log Out">
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="main">
        <header className="top-header dash-header-v2">
          <div className="dash-header-left">
            <button
              type="button"
              className="sidebar-toggle"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <i className="fas fa-bars" />
            </button>
            <div className="page-heading">
              <div className="page-heading-icon">
                <i className={`fas ${pageMeta.icon}`} />
              </div>
              <div>
                <p className="page-eyebrow">Findit · {currentUser?.name || 'User'}</p>
                <h1>{pageMeta.title}</h1>
                <p className="page-subtitle">{pageMeta.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="action-group dash-actions">
                {(viewMode === 'dashboard' || viewMode === 'myItems') && (
                  <>

                    <div className="search-wrapper">
                  <i className="fas fa-search"></i>
                  <input
                    id="dashboard-search"
                    name="search"
                    type="text"
                    placeholder="Search titles or locations..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <button
                    className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All
                  </button>
                  <button
                    className={`filter-pill ${statusFilter === 'lost' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('lost')}
                  >
                    Lost
                  </button>
                  <button
                    className={`filter-pill ${statusFilter === 'found' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('found')}
                  >
                    Found
                  </button>
                </div>

                <button
                  className={`btn-primary ${isPostingLocked ? 'posting-locked' : ''}`}
                  onClick={() => {
                    if (isPostingLocked) {
                      showToast('⚠️ Verify your identity to post items.', 'error');
                    } else {
                      navigate(DASHBOARD_PATHS.report);
                    }
                  }}
                >
                  <i className="fas fa-plus"></i> Report Item
                </button>
              </>
            )}
          </div>
        </header>

        {isPostingLocked && viewMode === 'dashboard' && (
          <div className="posting-locked-banner visible">
            ⚠️ <strong>Posting Restrictions Active:</strong> To prevent fraud, you must complete your identity document verification in Profile Settings before submitting reports.
          </div>
        )}

        {/* Verification Status Banner */}
        {verificationMessage && viewMode === 'dashboard' && (
          <div 
            className={`verification-status-banner ${verificationMessage.type}`}
            style={{
              padding: '12px 20px',
              borderRadius: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.9rem',
              fontWeight: 500,
              animation: 'fadeInUp 0.4s ease-out',
              background: verificationMessage.type === 'success' 
                ? 'var(--found-bg)' 
                : verificationMessage.type === 'error'
                ? 'var(--lost-bg)'
                : 'var(--reward-bg)',
              color: verificationMessage.type === 'success'
                ? 'var(--found)'
                : verificationMessage.type === 'error'
                ? 'var(--lost)'
                : 'var(--reward)',
              border: `1px solid ${
                verificationMessage.type === 'success'
                  ? 'rgba(16,185,129,0.3)'
                  : verificationMessage.type === 'error'
                  ? 'rgba(244,63,94,0.3)'
                  : 'rgba(245,158,11,0.3)'
              }`,
            }}
          >
            <span>{verificationMessage.text}</span>
            <button 
              onClick={() => setVerificationMessage(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                opacity: 0.7,
                padding: '0 4px',
                color: 'inherit',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* 1. MAIN DASHBOARD VIEW */}
    {(viewMode === 'dashboard' || viewMode === 'myItems') && (
          <>
            {/* STATS PANEL */}
            <section className="stats-grid stats-grid-v2">
              <div className="stat-card-v2 stat-accent">
                <div className="stat-card-top">
                  <span className="stat-chip">Live</span>
                  <i className="fas fa-layer-group stat-fa" />
                </div>
                <div className="stat-number">{activeCount}</div>
                <div className="stat-title">Active Items</div>
              </div>
              <div className="stat-card-v2 stat-lost">
                <div className="stat-card-top">
                  <span className="stat-chip">Lost</span>
                  <i className="fas fa-search stat-fa" />
                </div>
                <div className="stat-number">{lostCount}</div>
                <div className="stat-title">Lost Claims</div>
              </div>
              <div className="stat-card-v2 stat-found">
                <div className="stat-card-top">
                  <span className="stat-chip">Found</span>
                  <i className="fas fa-hand-holding-heart stat-fa" />
                </div>
                <div className="stat-number">{foundCount}</div>
                <div className="stat-title">Found Reports</div>
              </div>
              <div
                className="stat-card-v2 stat-verify"
                onClick={() => navigate(DASHBOARD_PATHS.profile)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(DASHBOARD_PATHS.profile)}
                role="button"
                tabIndex={0}
              >
                <div className="stat-card-top">
                  <span className="stat-chip">Trust</span>
                  <i className="fas fa-shield-halved stat-fa" />
                </div>
                <div className="stat-number stat-number-sm" style={{ color: verStatus.color }}>
                  {verStatus.label}
                </div>
                <div className="stat-title">Verification</div>
              </div>
            </section>



            {/* ITEMS LISTING SECTION */}
            <section className="section-title">
              <h3>
                <i className="fas fa-th-large"></i> Active Platform Feeds
              </h3>
              <span id="itemCountSpan">{filteredItems.length} feeds found</span>
            </section>

            <section className="items-grid">
              {filteredItems.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '4rem 2rem' }}>
                  <div className="empty-state">
                    <i className="fas fa-search"></i>
                    <p>No reports match your filters.</p>
                  </div>
                </div>
              ) : (
                filteredItems.map(item => {
                  const isOwner = Number(item.user?.id) === Number(currentUser?.id);
                  const isSolved = (item.status || 'active') === 'solved';
                  const showSensitive =
                    item.sensitive && !revealedSensitives[item.id] && item.sensitiveBlur;

                  return (
                    <article key={item.id} className="item-card">
                      <div
                        className="card-image-box"
                        style={{ position: 'relative', overflow: 'hidden' }}
                      >
                        {item.imageFront ? (
                          <img
                            src={`${apiBase}/uploads/items/${item.imageFront}`}
                            alt={item.title}
                            className="card-img"
                            style={{
                              filter: showSensitive ? 'blur(20px) brightness(0.6)' : 'none',
                              transition: 'filter 0.3s',
                            }}
                          />
                        ) : (
                          <div className="card-img">
                            <i className="fas fa-image" style={{ opacity: 0.1 }}></i>
                          </div>
                        )}

                        {showSensitive && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              background: 'rgba(0,0,0,0.4)',
                              color: 'white',
                              padding: '12px',
                              zIndex: 2,
                            }}
                          >
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                              ⚠️ Sensitive Content
                            </span>
                            {(isOwner || currentUser?.role === 'admin') && (
                              <button
                                className="reveal-btn"
                                onClick={() =>
                                  setRevealedSensitives(prev => ({ ...prev, [item.id]: true }))
                                }
                              >
                                Reveal Photo
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="card-content">
                        <div className="card-title">
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </span>
                          <span className={`status-badge ${item.type === 'lost' ? 'lost-tag' : 'found-tag'}`}>
                            {item.type.toUpperCase()}
                          </span>
                        </div>

                        <div className="location-line">
                          <i className="fas fa-map-marker-alt"></i>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.location}
                          </span>
                        </div>

                        {item.type === 'lost' && item.reward && Number(item.reward) > 0 && (
                          <div>
                            <span className="reward-chip">
                              💰 Reward: {item.reward} {item.currency || 'NPR'}
                            </span>
                          </div>
                        )}

                        <p className="desc-preview">
                          {item.description && item.description.length > 120
                            ? `${item.description.slice(0, 120)}...`
                            : item.description || 'No description provided.'}
                        </p>

                        <div className="card-actions">
                          <button
                            className="icon-btn"
                            onClick={() => navigate(DASHBOARD_PATHS.item(item.id))}
                          >
                            <i className="fas fa-info-circle"></i> Info
                          </button>

                          {isOwner && (
                            <>
                              <button
                                className="icon-btn"
                                onClick={() => navigate(DASHBOARD_PATHS.itemEdit(item.id))}
                              >
                                <i className="fas fa-edit"></i> Edit
                              </button>

                              <button
                                className={`icon-btn ${isSolved ? 'resolve' : ''}`}
                                onClick={() => handleResolveItem(item)}
                              >
                                <i className={`fas ${isSolved ? 'fa-envelope-open' : 'fa-check-circle'}`}></i>{' '}
                                {isSolved ? 'Reopen' : 'Solve'}
                              </button>
                            </>
                          )}

                          {(isOwner || currentUser?.role === 'admin') && (
                            <button
                              className="icon-btn del"
                              onClick={() => openDeleteDialog(item.id, item.title || 'this item')}
                            >
                              <i className="fas fa-trash"></i> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          </>
        )}

        {/* 2. FULL GEO-MAP SECTION */}
        {viewMode === 'mapview' && (

          <section
            className="panel-card"
            style={{ height: 'calc(100vh - 120px)', width: '100%' }}
          >
            <div className="panel-header">
              <i className="fas fa-map-marked-alt"></i> Platform Active Claims Heatmap Tracker
            </div>
            <div className="map-wrapper">
              <div id="fullMap" style={{ height: '100%', width: '100%', borderRadius: 0 }}></div>
            </div>
          </section>
        )}

        {/* 3. ADMIN INTERFACES */}
        {viewMode === 'admin' && currentUser?.role === 'admin' && (
          <AdminPanel
            token={token}
            apiBase={apiBase}
            allItems={items}
            showToast={showToast}
            openDeleteDialog={openDeleteDialog}
          />
        )}
      </main>

      {/* CHATBOT - Only for non-admin users */}
      {currentUser?.role !== 'admin' && (
        <AIChatbot
          token={token}
          apiBase={apiBase}
          showToast={showToast}
          isLocked={isPostingLocked}
          onOpenItemDetails={(id) => navigate(DASHBOARD_PATHS.item(id))}
          onOpenChat={(itemId, title, otherUserId) =>
            navigate(DASHBOARD_PATHS.chat(itemId), {
              state: { title, otherUserId } satisfies ChatLocationState,
            })
          }
        />
      )}

      {/* MODALS */}
      {showReport && (
        <ReportModal
          token={token}
          apiBase={apiBase}
          onClose={closeOverlay}
          onSuccess={() => {
            closeOverlay();
            loadItems();
          }}
          showToast={showToast}
        />
      )}

      {showEdit && editItemId !== null && (
        <EditModal
          token={token}
          apiBase={apiBase}
          itemId={editItemId}
          onClose={closeOverlay}
          onSuccess={() => {
            closeOverlay();
            loadItems();
          }}
          showToast={showToast}
        />
      )}

      {showDetails && detailsItemId !== null && (
        <ItemDetailsModal
          token={token}
          apiBase={apiBase}
          itemId={detailsItemId}
          currentUserId={currentUser?.id}
          onClose={closeOverlay}
          showToast={showToast}
          onOpenChat={(itemId, title, otherUserId) =>
            navigate(DASHBOARD_PATHS.chat(itemId), {
              state: { title, otherUserId } satisfies ChatLocationState,
            })
          }
        />
      )}

      {showInbox && (
        <InboxModal
          token={token}
          apiBase={apiBase}
          currentUser={currentUser}
          socket={socketRef.current}
          onClose={closeOverlay}
          onOpenChat={(itemId, title, otherUserId) => {
            navigate(DASHBOARD_PATHS.chat(itemId), {
              state: { title, otherUserId } satisfies ChatLocationState,
            });
          }}
        />
      )}

      {showProfile && (
        <ProfileModal
          token={token}
          apiBase={apiBase}
          currentUser={currentUser}
          onClose={closeOverlay}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
          }}
          showToast={showToast}
        />
      )}

      {activeChat && (
        <P2PChatModal
          token={token}
          apiBase={apiBase}
          currentUser={currentUser}
          itemId={activeChat.itemId}
          chatTitle={activeChat.title}
          otherUserId={activeChat.otherUserId}
          socket={socketRef.current}
          onClose={closeOverlay}
          playSound={playSound}
        />
      )}

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
        onClick={() => setDeleteConfirm({ show: false, itemId: null, itemName: '', itemType: 'item' })}
        >
          <div 
            className="dialog-box"
            style={{
              background: 'var(--bg)',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              animation: 'scaleIn 0.3s ease-out',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--lost-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <i className="fas fa-trash-alt" style={{ fontSize: '24px', color: 'var(--lost)' }}></i>
              </div>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 700, 
                marginBottom: '8px',
                color: '#000',
              }}>
                Delete {deleteConfirm.itemType === 'user' ? 'User' : 'Item'}?
              </h3>
              <p style={{ 
                fontSize: '0.9rem', 
                color: '#333', 
                marginBottom: '24px',
                lineHeight: '1.5',
              }}>
                Are you sure you want to permanently delete <strong style={{ color: '#000' }}>"{deleteConfirm.itemName}"</strong>? This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirm({ show: false, itemId: null, itemName: '', itemType: 'item' })}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--bg-secondary)',
                  color: '#000',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minWidth: '100px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={deleteConfirm.itemType === 'user' ? confirmDeleteUser : confirmDeleteItem}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--lost)',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minWidth: '100px',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlatformReview && reviewItemId && (
        <PlatformReviewModal
          token={token}
          apiBase={apiBase}
          itemId={reviewItemId}
          onClose={async () => {
            try {
              await fetch(`${apiBase}/items/${reviewItemId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              loadItems();
            } catch (e) {
              console.warn('Failed to auto-delete solved item', e);
            }
            setShowPlatformReview(false);
            setReviewItemId(null);
          }}
          onSuccess={async () => {
            try {
              await fetch(`${apiBase}/items/${reviewItemId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              loadItems();
            } catch (e) {
              console.warn('Failed to auto-delete solved item', e);
            }
            setShowPlatformReview(false);
            setReviewItemId(null);
          }}
          showToast={showToast}
        />
      )}

      {showNotifications && (
        <NotificationsModal
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          markNotificationRead={markNotificationRead}
          markAllNotificationsRead={markAllNotificationsRead}
        />
      )}
    </div>
  );
};
