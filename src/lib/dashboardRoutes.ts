export type DashboardView = 'dashboard' | 'myItems' | 'mapview' | 'admin';

export const DASHBOARD_PATHS = {
  home: '/dashboard',
  items: '/dashboard/items',
  map: '/dashboard/map',
  admin: '/dashboard/admin',
  inbox: '/dashboard/inbox',
  profile: '/dashboard/profile',
  report: '/dashboard/report',
  item: (id: number | string) => `/dashboard/item/${id}`,
  itemEdit: (id: number | string) => `/dashboard/item/${id}/edit`,
  chat: (itemId: number | string) => `/dashboard/chat/${itemId}`,
} as const;

export function viewToPath(view: DashboardView): string {
  switch (view) {
    case 'dashboard':
      return DASHBOARD_PATHS.home;
    case 'myItems':
      return DASHBOARD_PATHS.items;
    case 'mapview':
      return DASHBOARD_PATHS.map;
    case 'admin':
      return DASHBOARD_PATHS.admin;
  }
}

export type DashboardPathParse =
  | { kind: 'view'; view: DashboardView }
  | { kind: 'inbox' }
  | { kind: 'profile' }
  | { kind: 'report' }
  | { kind: 'item'; itemId: number }
  | { kind: 'edit'; itemId: number }
  | { kind: 'chat'; itemId: number }
  | { kind: 'unknown' };

export function parseDashboardPath(pathname: string): DashboardPathParse {
  const path = pathname.replace(/\/+$/, '') || DASHBOARD_PATHS.home;

  if (path === DASHBOARD_PATHS.home) return { kind: 'view', view: 'dashboard' };
  if (path === DASHBOARD_PATHS.items) return { kind: 'view', view: 'myItems' };
  if (path === DASHBOARD_PATHS.map) return { kind: 'view', view: 'mapview' };
  if (path === DASHBOARD_PATHS.admin) return { kind: 'view', view: 'admin' };
  if (path === DASHBOARD_PATHS.inbox) return { kind: 'inbox' };
  if (path === DASHBOARD_PATHS.profile) return { kind: 'profile' };
  if (path === DASHBOARD_PATHS.report) return { kind: 'report' };

  let match = path.match(/^\/dashboard\/item\/(\d+)\/edit$/);
  if (match) return { kind: 'edit', itemId: Number(match[1]) };

  match = path.match(/^\/dashboard\/item\/(\d+)$/);
  if (match) return { kind: 'item', itemId: Number(match[1]) };

  match = path.match(/^\/dashboard\/chat\/(\d+)$/);
  if (match) return { kind: 'chat', itemId: Number(match[1]) };

  return { kind: 'unknown' };
}

export interface ChatLocationState {
  title: string;
  otherUserId: number;
}

export const DASHBOARD_PAGE_META: Record<
  DashboardView,
  { title: string; subtitle: string; icon: string }
> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Overview of platform activity and your recovery hub',
    icon: 'fa-chart-pie',
  },
  myItems: {
    title: 'My Items',
    subtitle: 'Manage your lost and found reports',
    icon: 'fa-box-open',
  },
  mapview: {
    title: 'Geo-Map',
    subtitle: 'Live heatmap of active claims across the area',
    icon: 'fa-map-marked-alt',
  },
  admin: {
    title: 'Admin Panel',
    subtitle: 'Users, verification, and platform moderation',
    icon: 'fa-shield-halved',
  },
};

export function overlayPageMeta(
  pathname: string,
): { title: string; subtitle: string; icon: string } | null {
  if (pathname.includes('/inbox'))
    return { title: 'Inbox', subtitle: 'Messages and match requests', icon: 'fa-envelope' };
  if (pathname.includes('/profile'))
    return { title: 'Profile', subtitle: 'Account and verification settings', icon: 'fa-user-cog' };
  if (pathname.includes('/report'))
    return { title: 'Report Item', subtitle: 'Submit a new lost or found post', icon: 'fa-plus-circle' };
  return null;
}
