import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { ClaimVerificationModal } from './ClaimVerificationModal';
import { ReturnTrackingPage } from './ReturnTrackingPage';

interface DashboardProps {
  token: string;
  currentUser: any;
  setCurrentUser: React.Dispatch<React.SetStateAction<any>>;
  apiBase: string;
  onLogout: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// Component definition
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
  // Always-loaded list of the current user's own items — used for sidebar stats
  const [myItems, setMyItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'lost' | 'found' | 'claimed' | 'solved'>('all');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [prevVerificationStatus, setPrevVerificationStatus] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; itemId: number | null; itemName: string; itemType: 'item' | 'user' }>({ show: false, itemId: null, itemName: '', itemType: 'item' });
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const announcements = notifications.filter(n => n.type === 'announcement' && !n.isRead);
  const regularNotifications = notifications.filter(n => n.type !== 'announcement');
  const unreadNotificationsCount = regularNotifications.filter(n => !n.isRead).length;

  // Track verification status changes and show notification
  useEffect(() => {
    const currentStatus = currentUser?.verificationStatus || (currentUser?.isVerified ? 'verified' : 'unverified');
    
    if (prevVerificationStatus !== null && prevVerificationStatus !== currentStatus) {
      if (currentStatus === 'verified') {
        setVerificationMessage({ text: ' Verification Successful! Your identity has been verified. You can now post and claim items.', type: 'success' });
      } else if (currentStatus === 'rejected') {
        setVerificationMessage({ text: ' Verification Failed. Your document did not match our records. Please re-upload in Profile Settings.', type: 'error' });
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
  const [openManageClaims, setOpenManageClaims] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeChat, setActiveChat] = useState<{ itemId: number; title: string; otherUserId: number } | null>(null);
  const activeChatRef = useRef(activeChat);
  const [showPlatformReview, setShowPlatformReview] = useState(false);
  const [showLeaveReviewModal, setShowLeaveReviewModal] = useState(false);
  const [reviewItemId, setReviewItemId] = useState<number | null>(null);
  const [verificationModalData, setVerificationModalData] = useState<{ show: boolean; code: string; itemTitle?: string; itemId?: number; otherUserId?: number } | null>(null);
  const [trackingClaimId, setTrackingClaimId] = useState<number | null>(null);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

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
    currentUser?.verificationStatus !== 'verified';

  const closeOverlay = useCallback(() => {
    setShowInbox(false);
    setShowProfile(false);
    setShowReport(false);
    setShowDetails(false);
    setDetailsItemId(null);
    setOpenManageClaims(false);
    setShowEdit(false);
    setEditItemId(null);
    setActiveChat(null);
    setShowNotifications(false);
    setShowPlatformReview(false);
    setReviewItemId(null);
    setTrackingClaimId(null);
    navigate(viewToPath(viewMode));
  }, [navigate, viewMode]);

  // Keep UI in sync with URL (browser back/forward, direct links, OAuth redirect)
  useEffect(() => {
    const parsed = parseDashboardPath(location.pathname);

    // Cleanly dismiss irrelevant overlays when switching routes
    if (parsed.kind !== 'inbox') setShowInbox(false);
    if (parsed.kind !== 'profile') setShowProfile(false);
    if (parsed.kind !== 'report') setShowReport(false);
    if (parsed.kind !== 'item' && parsed.kind !== 'itemClaims') {
      setShowDetails(false);
      setDetailsItemId(null);
      setOpenManageClaims(false);
    }
    if (parsed.kind !== 'edit') { setShowEdit(false); setEditItemId(null); }
    if (parsed.kind !== 'chat') setActiveChat(null);
    if (parsed.kind !== 'tracking') setTrackingClaimId(null);
    setShowNotifications(false);

    if (parsed.kind === 'unknown') {
      navigate(DASHBOARD_PATHS.home, { replace: true });
      return;
    }

    if (parsed.kind === 'view') {
      if (parsed.view === 'admin' && currentUser?.role !== 'admin') {
        navigate(DASHBOARD_PATHS.home, { replace: true });
        return;
      }
      if (parsed.view === 'dashboard') {
        setStatusFilter('all');
      }
      setViewMode(parsed.view);
      return;
    }

    if (parsed.kind === 'inbox') {
      setShowInbox(true);
      setUnreadMessagesCount(0); // Clear on open
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
      setOpenManageClaims(false);
      return;
    }

    if (parsed.kind === 'itemClaims') {
      setDetailsItemId(parsed.itemId);
      setShowDetails(true);
      setOpenManageClaims(true);
      return;
    }

    if (parsed.kind === 'edit') {
      setEditItemId(parsed.itemId);
      setShowEdit(true);
      return;
    }

    if (parsed.kind === 'tracking') {
      setTrackingClaimId(parsed.claimId);
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
        // High-end Swiss "Swish & Crystal Chime" Audio Synthesis
        // 1. Swish Noise sweep (air swoosh)
        const bufferSize = audioCtx.sampleRate * 0.08;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1600, t);
        filter.frequency.exponentialRampToValueAtTime(4200, t + 0.06);
        filter.Q.setValueAtTime(4, t);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.3, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);

        // 2. Crystal Swiss ping tone (pure harmonic pop)
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1560, t + 0.01);
        osc.frequency.exponentialRampToValueAtTime(980, t + 0.08);

        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(0.35, t + 0.012);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(oscGain);
        oscGain.connect(audioCtx.destination);

        noise.start(t);
        osc.start(t + 0.005);
        osc.stop(t + 0.09);
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
  const loadItems = useCallback(async () => {
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
  }, [apiBase, viewMode, token, showToast]);

  // Always load the current user's own items for sidebar stats (independent of view)
  const loadMyItems = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/items/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyItems(data);
      }
    } catch {
      // Silent — sidebar stats are non-critical
    }
  }, [apiBase, token]);

  // Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(prev => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
      }
    } catch (e) {}
  }, [apiBase, token]);

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

    const processInboxData = (data: any[]) => {
      if (!Array.isArray(data)) return;
      let pending = 0;
      let unread = 0;
      data.forEach(c => {
        if (
          c.conversation &&
          c.conversation.status === 'pending' &&
          Number(c.conversation.ownerId) === Number(currentUser.id)
        ) {
          pending++;
        }
        if (
          c.hasUnread ||
          (c.lastMessage &&
            c.lastMessageIsRead === false &&
            Number(c.lastMessageSenderId ?? c.lastMessage?.senderId) !== Number(currentUser.id))
        ) {
          unread++;
        }
      });
      setPendingRequestsCount(pending);
      setUnreadMessagesCount(unread);
    };

    const fetchInboxRest = async () => {
      try {
        const res = await fetch(`${apiBase}/chat/inbox`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          processInboxData(data);
        }
      } catch (e) {}
    };

    socket.on('inbox', processInboxData);
    socket.on('inboxData', processInboxData);

    socket.on('newMessage', (msg: any) => {
      const senderId = Number(msg.sender?.id ?? msg.senderId ?? msg.sender);
      const receiverId = Number(msg.receiver?.id ?? msg.receiverId ?? msg.receiver);
      const msgItemId = Number(msg.itemId);
      const viewingThisChat =
        activeChatRef.current &&
        Number(activeChatRef.current.itemId) === msgItemId &&
        Number(activeChatRef.current.otherUserId) === senderId;

      if (receiverId === Number(currentUser.id) && senderId !== Number(currentUser.id) && !viewingThisChat) {
        setUnreadMessagesCount(prev => prev + 1);
        playSound('receive');
        showToast(`New message from ${msg.sender?.name || 'User'}`, 'info');
      }
    });

    // Request initial inbox status
    socket.emit('getInbox');
    fetchInboxRest();

    // Fetch initial notifications and let background timer auto-sync
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchInboxRest();
    }, 20000);

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

  // Always keep myItems up-to-date for sidebar stats regardless of view
  useEffect(() => {
    loadMyItems();
    const myItemsInterval = setInterval(loadMyItems, 30000);
    return () => clearInterval(myItemsInterval);
  }, [token]);

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
    // Ensure map is created once
    if (!dashboardMapRef.current) {
      const mapContainer = document.getElementById('map');
      if (mapContainer) {
        const map = L.map('map', { zoomControl: false }).setView([27.7172, 85.3240], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
        dashboardMapRef.current = map;
        
        map.on('tileerror', (e) => {
          console.warn('Map tile error:', e);
        });
      }
    }

    if (viewMode === 'dashboard' && dashboardMapRef.current) {
      // Small timeout to allow display: block to apply before invalidating size
      setTimeout(() => {
        dashboardMapRef.current?.invalidateSize();
      }, 50);
    }
  }, [viewMode]);

  // Update Dashboard Markers when items change
  useEffect(() => {
    if (!dashboardMapRef.current) return;
    
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
              <div style="padding:5px; min-width:150px; font-family:'Inter', sans-serif;">
                <h4 style="margin-bottom:5px; font-family:'Inter', sans-serif; font-size:0.9rem; color:var(--text-main); font-weight:700;">${
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
  }, [items, navigate]);

  // Initialize and update Full Map View
  useEffect(() => {
    if (viewMode === 'mapview') {
      // Re-initialize every time the view becomes active
      // (the #fullMap div is unmounted when viewMode changes, so the old
      //  Leaflet instance is left dangling — destroy it first)
      if (fullMapRef.current) {
        fullMarkersRef.current.forEach(m => fullMapRef.current?.removeLayer(m));
        fullMarkersRef.current = [];
        fullMapRef.current.remove();
        fullMapRef.current = null;
      }

      // Small delay to let React flush the DOM before Leaflet reads it
      const timer = setTimeout(() => {
        const container = document.getElementById('fullMap');
        if (!container) return;

        const map = L.map('fullMap', { zoomControl: false }).setView([27.7172, 85.3240], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        fullMapRef.current = map;

        // Invalidate size after render
        setTimeout(() => map.invalidateSize(true), 50);
      }, 30);

      return () => clearTimeout(timer);
    } else {
      // Leaving mapview: destroy the map so the next visit gets a fresh one
      if (fullMapRef.current) {
        fullMarkersRef.current.forEach(m => fullMapRef.current?.removeLayer(m));
        fullMarkersRef.current = [];
        fullMapRef.current.remove();
        fullMapRef.current = null;
      }
    }
  }, [viewMode]);

  // Update Full Map Markers — re-run whenever items or viewMode changes
  useEffect(() => {
    if (!fullMapRef.current || viewMode !== 'mapview') return;

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
  }, [items, navigate, viewMode]);

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
  };

  // Filter and search (memoized)
  // When in myItems view, always source from myItems so status filters (claimed/solved)
  // only reflect the current user's data — not the entire public feed.
  const filteredItems = useMemo(() => {
    const sourceList = viewMode === 'myItems' ? myItems : items;
    const query = searchQuery.toLowerCase();
    return sourceList.filter(item => {
      const matchSearch =
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.location?.toLowerCase().includes(query);
      
      let matchFilter = true;
      if (statusFilter === 'lost' || statusFilter === 'found') {
        matchFilter = item.type === statusFilter;
      } else if (statusFilter === 'claimed') {
        matchFilter =
          item.status !== 'solved' &&
          (item.status === 'claimed' ||
            ['PENDING', 'APPROVED', 'RETURN_ARRANGED', 'ITEM_RECEIVED'].includes(item.activeClaim?.status));
      } else if (statusFilter === 'solved') {
        matchFilter = item.status === 'solved';
      }

      return matchSearch && matchFilter;
    });
  }, [items, myItems, viewMode, searchQuery, statusFilter]);

  // Sensitive details blur control state helper
  const [revealedSensitives, setRevealedSensitives] = useState<{ [key: number]: boolean }>({});





  // Stats computation (memoized)
  // activeCount/lostCount/foundCount reflect the current view (public or mine)
  // claimedCount/returnedCount ALWAYS use myItems so the sidebar only shows the current user's data
  const { activeCount, lostCount, foundCount, claimedCount, returnedCount } = useMemo(() => ({
    activeCount: items.filter(i => (i.status || 'active') === 'active').length,
    lostCount: items.filter(i => i.type?.toLowerCase() === 'lost').length,
    foundCount: items.filter(i => i.type?.toLowerCase() === 'found').length,
    claimedCount: myItems.filter(
      i =>
        i.status !== 'solved' &&
        (i.status === 'claimed' ||
          ['PENDING', 'APPROVED', 'RETURN_ARRANGED', 'ITEM_RECEIVED'].includes(i.activeClaim?.status)),
    ).length,
    returnedCount: myItems.filter(i => i.status === 'solved').length,
  }), [items, myItems]);

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
            onClick={() => {
              setStatusFilter('all');
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon"><i className="fas fa-chart-pie"></i></span>
            <span>Dashboard</span>
          </NavLink>

          <div className="nav-group">
            <NavLink
              to={DASHBOARD_PATHS.items}
              className={({ isActive }) => {
                const parentActive = isActive && statusFilter === 'all';
                const inSection = isActive && statusFilter !== 'all';
                return `nav-item${parentActive ? ' active' : inSection ? ' nav-item-in-section' : ''}`;
              }}
              onClick={() => {
                setStatusFilter('all');
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon"><i className="fas fa-box-open"></i></span>
              <span>My Items</span>
            </NavLink>

            <div className="nav-sub" role="group" aria-label="Item status filters">
              <button
                type="button"
                className={`nav-item nav-item-sub${statusFilter === 'claimed' && viewMode === 'myItems' ? ' active' : ''}`}
                onClick={() => {
                  setStatusFilter('claimed');
                  setSidebarOpen(false);
                  navigate(DASHBOARD_PATHS.items);
                }}
              >
                <span className="nav-icon nav-icon-transit"><i className="fas fa-truck-ramp-box"></i></span>
                <span>In Transit / Claimed</span>
                {claimedCount > 0 && (
                  <span className="nav-badge nav-badge-blue">{claimedCount}</span>
                )}
              </button>

              <button
                type="button"
                className={`nav-item nav-item-sub nav-item-success${statusFilter === 'solved' && viewMode === 'myItems' ? ' active' : ''}`}
                onClick={() => {
                  setStatusFilter('solved');
                  setSidebarOpen(false);
                  navigate(DASHBOARD_PATHS.items);
                }}
              >
                <span className="nav-icon nav-icon-success"><i className="fas fa-check-circle"></i></span>
                <span>Returned / Received</span>
                {returnedCount > 0 && (
                  <span className="nav-badge nav-badge-green">{returnedCount}</span>
                )}
              </button>
            </div>
          </div>

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
            onClick={() => {
              setSidebarOpen(false);
            }}
          >
            <span className="nav-icon"><i className="fas fa-envelope"></i></span>
            <span>Inbox</span>
            {(pendingRequestsCount > 0 || unreadMessagesCount > 0) && (
              <span className="nav-badge">
                {pendingRequestsCount + unreadMessagesCount}
              </span>
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
              <span className="nav-badge nav-badge-blue">
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

          <button
            type="button"
            className={`nav-item ${showLeaveReviewModal ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', outline: 'none' }}
            onClick={() => {
              setSidebarOpen(false);
              setShowLeaveReviewModal(true);
            }}
          >
            <span className="nav-icon"><i className="fas fa-star" style={{ color: '#f59e0b' }}></i></span>
            <span>Leave Review</span>
          </button>

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
        {/* Announcement Pop-up Alert */}
        {announcements.length > 0 && (
          <div
            className="dialog-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <div
              className="dialog-box"
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '24px',
                padding: '32px 28px',
                maxWidth: '440px',
                width: '90%',
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
                animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                position: 'relative',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            >
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 16px rgba(37, 99, 235, 0.15)',
              }}>
                <i className="fas fa-bullhorn" style={{ fontSize: '22px', color: '#2563eb' }}></i>
              </div>
              
              <h3 style={{ 
                fontSize: '1.3rem', 
                fontWeight: 800, 
                marginBottom: '12px',
                color: '#0f172a',
                fontFamily: "'Inter', sans-serif",
              }}>
                Important Announcement
              </h3>
              
              <p style={{ 
                fontSize: '0.95rem', 
                color: '#475569', 
                lineHeight: '1.6',
                marginBottom: '24px',
                fontWeight: 500,
                fontFamily: "'Inter', sans-serif",
              }}>
                {announcements[0].message}
              </p>

              <button
                onClick={() => markNotificationRead(announcements[0].id)}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '13px 24px',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(37, 99, 235, 0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.3)'; }}
              >
                Got it, Dismiss
              </button>
            </div>
          </div>
        )}
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
                      showToast(
                        currentUser?.verificationStatus === 'pending'
                          ? 'Your identity verification is under review. Posting will be enabled once approved.'
                          : 'Please verify your identity to post items.',
                        'error',
                      );
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
            ⚠️ <strong>Posting Restrictions Active:</strong>{' '}
            {currentUser?.verificationStatus === 'pending'
              ? 'Your identity document is under manual review. You will be able to post once an admin approves your verification.'
              : 'To prevent fraud, you must complete your identity document verification in Profile Settings before submitting reports.'}
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
        {(viewMode === 'dashboard' || viewMode === 'myItems') && trackingClaimId === null && (
          <div>
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
                <i className="fas fa-th-large"></i> {viewMode === 'myItems' ? 'My Reported Items' : 'Active Platform Feeds'}
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

                  const activeClaim = item.activeClaim;
                  const itemStatusLabel = isSolved
                    ? 'Returned / Delivered'
                    : activeClaim?.status === 'RETURN_ARRANGED'
                    ? '🚚 In Transit'
                    : activeClaim?.status === 'ITEM_RECEIVED'
                    ? '✅ Received'
                    : activeClaim?.status === 'APPROVED'
                    ? '📋 Claimed'
                    : activeClaim?.status === 'PENDING'
                    ? '⏳ Claim Pending'
                    : item.status === 'claimed'
                    ? '📋 Claimed'
                    : 'Active';

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

                        {/* Status Overlay Badge */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '10px',
                            left: '10px',
                            zIndex: 3,
                            display: 'flex',
                            gap: '6px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span className={`status-badge ${item.type === 'lost' ? 'lost-tag' : 'found-tag'}`}>
                            {item.type.toUpperCase()}
                          </span>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              background: isSolved
                                ? '#dcfce7'
                                : activeClaim
                                ? '#e0f2fe'
                                : '#f1f5f9',
                              color: isSolved
                                ? '#16a34a'
                                : activeClaim
                                ? '#0284c7'
                                : '#475569',
                              border: `1px solid ${
                                isSolved
                                  ? 'rgba(22,163,74,0.3)'
                                  : activeClaim
                                  ? 'rgba(2,132,199,0.3)'
                                  : 'rgba(71,85,105,0.2)'
                              }`,
                            }}
                          >
                            {itemStatusLabel}
                          </span>
                        </div>

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
                            {isOwner && (
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

                        <div className="card-actions" style={{ flexWrap: 'wrap', gap: '6px' }}>
                          <button
                            className="btn-details"
                            onClick={() => navigate(DASHBOARD_PATHS.item(item.id))}
                          >
                            <i className="fas fa-eye"></i> View Details
                          </button>

                          {activeClaim && (
                            <button
                              className="btn-details"
                              style={{ background: '#0284c7', color: '#fff', borderColor: '#0284c7' }}
                              onClick={() => navigate(DASHBOARD_PATHS.tracking(activeClaim.id))}
                            >
                              <i className="fas fa-truck-ramp-box"></i> Track Status
                            </button>
                          )}

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
          </div>
        )}

        {/* 2. FULL GEO-MAP SECTION */}
        {viewMode === 'mapview' && trackingClaimId === null && (
          <div>
            <section
              className="panel-card"
              style={{ height: 'calc(100vh - 180px)', width: '100%' }}
            >
              <div className="panel-header">
                <i className="fas fa-map-marked-alt"></i> Platform Active Claims Heatmap Tracker
              </div>
              <div className="map-wrapper">
                <div id="fullMap" style={{ height: '100%', width: '100%', borderRadius: 0 }}></div>
              </div>
            </section>
          </div>
        )}

        {/* 3. ADMIN INTERFACES */}
        {viewMode === 'admin' && currentUser?.role === 'admin' && trackingClaimId === null && (
          <AdminPanel
            token={token}
            apiBase={apiBase}
            allItems={items}
            showToast={showToast}
            openDeleteDialog={openDeleteDialog}
          />
        )}

        {/* 4. CLAIM RETURN TRACKING PAGE */}
        {trackingClaimId !== null && (
          <ReturnTrackingPage
            token={token}
            apiBase={apiBase}
            currentUser={currentUser}
            claimId={trackingClaimId}
            showToast={showToast}
            onOpenChat={(itemId, title, otherUserId) =>
              navigate(DASHBOARD_PATHS.chat(itemId), {
                state: { title, otherUserId } satisfies ChatLocationState,
              })
            }
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
          initialShowManageClaims={openManageClaims}
          onOpenTracking={(claimId) => navigate(DASHBOARD_PATHS.tracking(claimId))}
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
            setUnreadMessagesCount((prev) => Math.max(0, prev - 1));
            socketRef.current?.emit('getInbox');
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
                fontFamily: "'Inter', sans-serif",
              }}>
                Delete {deleteConfirm.itemType === 'user' ? 'User' : 'Item'}?
              </h3>
              <p style={{ 
                fontSize: '0.92rem', 
                color: '#475569', 
                marginBottom: '24px',
                lineHeight: '1.55',
                fontFamily: "'Inter', sans-serif",
              }}>
                Are you sure you want to permanently delete{' '}
                <strong style={{ color: '#0f172a', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                  "{deleteConfirm.itemName}"
                </strong>
                ?<br />
                <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', display: 'inline-block', marginTop: '6px' }}>
                  ⚠️ This action cannot be undone.
                </span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirm({ show: false, itemId: null, itemName: '', itemType: 'item' })}
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
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; }}
              >
                Cancel
              </button>
              <button
                onClick={deleteConfirm.itemType === 'user' ? confirmDeleteUser : confirmDeleteItem}
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
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)'; }}
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

      {showLeaveReviewModal && (
        <PlatformReviewModal
          token={token}
          apiBase={apiBase}
          itemId={0}
          onClose={() => setShowLeaveReviewModal(false)}
          onSuccess={() => setShowLeaveReviewModal(false)}
          showToast={showToast}
        />
      )}

      {showNotifications && (
        <NotificationsModal
          notifications={regularNotifications}
          onClose={() => setShowNotifications(false)}
          markNotificationRead={markNotificationRead}
          markAllNotificationsRead={markAllNotificationsRead}
          showToast={showToast}
          onOpenVerificationModal={(code, itemTitle, itemId) => {
            setShowNotifications(false);
            setVerificationModalData({ show: true, code, itemTitle, itemId });
          }}
          onNavigate={(link) => {
            setShowNotifications(false);
            const claimsMatch = link.match(/\/item(?:s)?\/(\d+)\/claims/);
            if (claimsMatch) {
              navigate(DASHBOARD_PATHS.itemClaims(claimsMatch[1]));
              return;
            }
            const trackingMatch = link.match(/\/tracking\/(\d+)/);
            if (trackingMatch) {
              navigate(DASHBOARD_PATHS.tracking(trackingMatch[1]));
              return;
            }
            if (link === '/dashboard/inbox' || link === '/inbox') {
              navigate(DASHBOARD_PATHS.inbox);
            } else if (link.startsWith('/items/')) {
              const itemId = link.split('/')[2];
              navigate(DASHBOARD_PATHS.item(itemId));
            } else {
              navigate(link);
            }
          }}
        />
      )}

      {verificationModalData?.show && (
        <ClaimVerificationModal
          verificationCode={verificationModalData.code}
          itemTitle={verificationModalData.itemTitle}
          itemId={verificationModalData.itemId}
          otherUserId={verificationModalData.otherUserId}
          onClose={() => setVerificationModalData(null)}
          onOpenChat={async (targetItemId, targetTitle, targetUserId) => {
            const currentData = verificationModalData;
            setVerificationModalData(null);
            
            const effectiveItemId = targetItemId || currentData?.itemId;
            const effectiveUserId = targetUserId || currentData?.otherUserId;
            const effectiveTitle = targetTitle || currentData?.itemTitle || 'Chat';

            if (effectiveItemId && effectiveUserId) {
              setActiveChat({
                itemId: Number(effectiveItemId),
                title: effectiveTitle,
                otherUserId: Number(effectiveUserId),
              });
              return;
            }

            // Fallback lookup from user's inbox threads
            try {
              const res = await fetch(`${apiBase}/chat/inbox`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                const chats = await res.json();
                const match = chats.find((c: any) => 
                  (effectiveItemId && Number(c.item?.id) === Number(effectiveItemId)) ||
                  (effectiveTitle && c.item?.title?.toLowerCase().includes(effectiveTitle.toLowerCase()))
                );

                if (match && match.item && match.otherUser) {
                  setActiveChat({
                    itemId: Number(match.item.id),
                    title: match.item.title || effectiveTitle,
                    otherUserId: Number(match.otherUser.id),
                  });
                  return;
                }
              }
            } catch (err) {
              console.warn('Failed to find matching chat thread', err);
            }

            // Final fallback
            setShowInbox(true);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};
