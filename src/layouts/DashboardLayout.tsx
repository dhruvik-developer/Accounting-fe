import { useEffect, useMemo, useState } from 'react';
import { api } from '@/app/api';
import { Outlet, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar, Avatar, Box, BottomNavigation, BottomNavigationAction,
  Button, Chip, Collapse, Divider, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Menu, MenuItem, Toolbar,
  Tooltip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

// Premium outlined icon set
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import AddIcon from '@mui/icons-material/Add';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';

import BusinessSwitcher from '@/components/BusinessSwitcher';
import BranchSwitcher from '@/components/BranchSwitcher';
import CommandPalette from '@/components/CommandPalette';
import NotificationsBell from '@/components/NotificationsBell';
import SubscriptionBanner from '@/features/billing/SubscriptionBanner';
import UpgradeModal from '@/features/billing/UpgradeModal';
import { useResponsive } from '@/hooks/useResponsive';
import { useBranchModules } from '@/hooks/useBranchModules';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useBillingAccess } from '@/hooks/useBillingAccess';
import { layout } from '@/app/tokens';
import { useBrand } from '@/app/brand';
import { exitImpersonation, impersonatingName, isImpersonating } from '@/app/impersonation';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';

type NavItem = {
  to?: string;
  label: string;
  icon: React.ReactNode;
  children?: {
    to: string; label: string;
    requiresFlag?: string;
    requiresBranchModule?: string;
    requiresPermission?: string;
    requiresAnyPermissionPrefix?: string;
  }[];
  badge?: string;
  /** Plan flag the module requires. Hidden if the customer's plan doesn't allow it. */
  requiresFlag?: string;
  /** Branch-level module that must be enabled for the active branch.
   *  Use when the same plan-flag covers the page but the page should also
   *  be hidden on retail/warehouse branches (e.g. `/team/roles` is gated
   *  by `rbac` plan flag but should follow Team's branch visibility). */
  requiresBranchModule?: string;
  /** RBAC permission code (e.g. `sales.invoice.view`). Hidden when the
   *  user's role doesn't grant it. The backend already 403s the request
   *  if they bypass the menu — this just prevents confusion. */
  requiresPermission?: string;
  /** Use for parent menu items: show when the user holds *any* code
   *  starting with the given prefix (e.g. `sales.` for the Sales group).
   *  Lets the menu open if they can do at least one child action. */
  requiresAnyPermissionPrefix?: string;
};

type NavGroup = { heading: string; items: NavItem[]; requiresAny?: string[] };

/** Grouped, curated nav. Headings appear only when the sidebar is expanded. */
const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: <SpaceDashboardOutlinedIcon /> }],
  },
  {
    heading: 'Sales',
    items: [
      {
        label: 'Sales', icon: <ReceiptLongOutlinedIcon />, requiresFlag: 'module_sales',
        requiresAnyPermissionPrefix: 'sales.',
        children: [
          { to: '/sales/estimates', label: 'Estimates', requiresFlag: 'sales.estimate', requiresPermission: 'sales.quotation.view' },
          { to: '/sales/orders', label: 'Sales Orders', requiresFlag: 'sales.sales_order', requiresPermission: 'sales.sales_order.view' },
          { to: '/sales/delivery-challans', label: 'Delivery Challans', requiresFlag: 'sales.delivery_challan', requiresPermission: 'sales.delivery_challan.view' },
          { to: '/sales/invoices', label: 'Sales Invoices', requiresFlag: 'sales.invoice', requiresPermission: 'sales.invoice.view' },
        ],
      },
      { to: '/payments', label: 'Payments', icon: <PaymentsOutlinedIcon />, requiresFlag: 'module_payments', requiresPermission: 'sales.payment_in.view' },
    ],
  },
  {
    heading: 'Purchases',
    items: [
      {
        label: 'Purchases', icon: <LocalMallOutlinedIcon />, requiresFlag: 'module_purchases',
        requiresAnyPermissionPrefix: 'purchase.',
        children: [
          { to: '/purchases/orders', label: 'Purchase Orders', requiresFlag: 'purchases.purchase_order', requiresPermission: 'purchase.purchase_order.view' },
          { to: '/purchases/bills', label: 'Purchase Bills', requiresFlag: 'purchases.bill', requiresPermission: 'purchase.bill.view' },
        ],
      },
      { to: '/expenses', label: 'Expenses', icon: <PaymentsOutlinedIcon />, requiresPermission: 'accounting.journal.view' },
    ],
  },
  {
    heading: 'Catalog',
    items: [
      { to: '/parties', label: 'Parties', icon: <PeopleAltOutlinedIcon />, requiresFlag: 'module_parties', requiresPermission: 'masters.parties.view' },
      { to: '/items', label: 'Items', icon: <Inventory2OutlinedIcon />, requiresFlag: 'module_items', requiresPermission: 'masters.items.view' },
      { to: '/inventory', label: 'Inventory', icon: <WarehouseOutlinedIcon />, requiresFlag: 'module_inventory', requiresPermission: 'inventory.stock_summary.view' },
      { to: '/warehouses', label: 'Warehouses', icon: <WarehouseOutlinedIcon />, requiresPermission: 'masters.warehouses.view' },
    ],
  },
  {
    heading: 'Insights',
    items: [
      { to: '/reports', label: 'Reports', icon: <BarChartOutlinedIcon />, requiresFlag: 'module_reports_basic', requiresAnyPermissionPrefix: 'reports.' },
    ],
  },
  {
    heading: 'Configuration',
    items: [
      { to: '/branches', label: 'Branches', icon: <HubOutlinedIcon />, requiresFlag: 'module_branches', requiresPermission: 'staff.branches.view' },
      { to: '/settings/import', label: 'Bulk Import', icon: <UploadFileOutlinedIcon />, requiresPermission: 'masters.items.create' },
      { to: '/templates', label: 'Templates', icon: <DescriptionOutlinedIcon />, requiresFlag: 'designer', requiresPermission: 'settings.pdf_template.view' },
      { to: '/team', label: 'Team', icon: <GroupsOutlinedIcon />, requiresFlag: 'module_team', requiresPermission: 'staff.users.view' },
      { to: '/team/roles', label: 'Roles', icon: <ShieldOutlinedIcon />, requiresFlag: 'rbac', requiresBranchModule: 'module_team', requiresPermission: 'staff.roles.view' },
      { to: '/settings', label: 'Settings', icon: <SettingsOutlinedIcon />, requiresFlag: 'module_settings', requiresPermission: 'settings.business.view' },
    ],
  },
];

const BOTTOM_NAV = [
  { to: '/dashboard', label: 'Home', icon: <SpaceDashboardOutlinedIcon /> },
  { to: '/sales/invoices', label: 'Sales', icon: <ReceiptLongOutlinedIcon /> },
  { to: '/parties', label: 'Parties', icon: <PeopleAltOutlinedIcon /> },
  { to: '/more', label: 'More', icon: <MoreHorizIcon /> },
];

export default function DashboardLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const { isMobile, isTablet, isDesktop, sidebarMode, toggleSidebar } = useResponsive();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Sales: true, Purchases: true });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [quickCreateEl, setQuickCreateEl] = useState<null | HTMLElement>(null);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [me, setMe] = useState<{ email?: string; first_name?: string; last_name?: string } | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  // null = not loaded yet → render optimistically (show all items).
  // Once the API resolves it becomes a dict and filtering kicks in.
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);
  const { brand, mode, toggleMode } = useBrand();
  const { isModuleAllowed } = useBranchModules();
  const { hasPermission, hasAnyPermissionStartingWith } = useMyPermissions();
  const { canManageBilling } = useBillingAccess();
  const impersonating = isImpersonating();
  const impName = impersonatingName();

  useEffect(() => {
    api.get('/auth/me/').then(r => {
      setIsSuperuser(!!r.data?.is_superuser);
      setMe(r.data || null);
    }).catch(() => {});
    // Plan-driven feature flags for the active business — drives nav visibility.
    // On error, leave as null so we keep showing the full sidebar (fail-open).
    api.get('/billing/feature-flags/')
      .then(r => setFlags(r.data?.flags || {}))
      .catch(() => { /* keep flags=null → optimistic */ });
    api.get('/billing/subscription/')
      .then(r => setSubscription(r.data))
      .catch(() => setSubscription(null));
  }, []);

  // Cmd/Ctrl + Shift + A → jump to platform console. Power-user shortcut
  // for staff so they don't have to thumb through the avatar menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const platform = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'A' || e.key === 'a');
      if (!platform) return;
      const isStaff = localStorage.getItem('is_superuser') === 'true'
        || !!localStorage.getItem('platform_role');
      if (!isStaff) return;
      e.preventDefault();
      nav('/platform');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  const collapsed = sidebarMode === 'collapsed';
  const sidebarWidth = collapsed ? layout.sidebarCollapsed : layout.sidebarExpanded;

  // Selectively clear auth + tenancy keys instead of nuking the whole store.
  // Keeps user-prefs (sidebar mode, dismissed banners, notification history)
  // available for the next session on this machine.
  const logout = () => {
    [
      'access', 'refresh', 'is_superuser', 'platform_role',
      'business_id', 'branch_id', 'impersonating_user', 'impersonating_name',
    ].forEach((k) => localStorage.removeItem(k));
    nav('/auth/login');
  };

  const userInitial = (
    (me?.first_name?.[0] || me?.email?.[0] || 'U')
  ).toUpperCase();

  const isActive = (to?: string) =>
    !!to && (loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to)));

  const renderItem = (n: NavItem) => {
    const active = isActive(n.to) || (n.children?.some(c => isActive(c.to)) ?? false);
    const row = (
      <ListItemButton
        key={n.label}
        component={n.children ? 'div' : RouterLink as any}
        to={n.children ? undefined : n.to}
        selected={!n.children && active}
        disableRipple
        onClick={n.children
          ? () => !collapsed && setExpanded(e => ({ ...e, [n.label]: !e[n.label] }))
          : () => isMobile && setMobileOpen(false)}
        sx={{
          mx: 1, my: 0.25,
          borderRadius: 1.5,
          minHeight: 38,
          justifyContent: collapsed ? 'center' : 'flex-start',
          position: 'relative',
          color: active ? 'text.primary' : 'text.secondary',
          backgroundColor: 'transparent',
          transition: 'background-color .18s ease, color .18s ease, transform .18s ease',
          // Belt + braces — never let MUI default state leak under our custom bg.
          '&.Mui-selected': { backgroundColor: 'transparent' },
          '&.Mui-selected:hover': { backgroundColor: 'transparent' },
          '&.Mui-focusVisible': { backgroundColor: 'transparent' },
          '&:focus, &:focus-visible': { backgroundColor: 'transparent' },
          // Hover state — subtle tinted glass
          '&:hover': {
            background: (t: Theme) => t.palette.mode === 'dark'
              ? alpha(t.palette.primary.main, 0.08)
              : alpha(t.palette.primary.main, 0.06),
            color: 'text.primary',
            '& .nav-icon': {
              color: (t: Theme) => t.palette.primary.main,
              transform: 'scale(1.05)',
            },
          },
          // Active state — gradient surface + inset glow + accent rail
          ...((!n.children && active) && {
            background: (t: Theme) => t.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.18)}, ${alpha(t.palette.primary.main, 0.06)})`
              : alpha(t.palette.primary.main, 0.10),
            boxShadow: (t: Theme) => t.palette.mode === 'dark'
              ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.22)} inset, 0 6px 16px ${alpha(t.palette.primary.main, 0.18)}`
              : `0 0 0 1px ${alpha(t.palette.primary.main, 0.18)} inset`,
            '&:hover': {
              background: (t: Theme) => t.palette.mode === 'dark'
                ? `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.22)}, ${alpha(t.palette.primary.main, 0.08)})`
                : alpha(t.palette.primary.main, 0.14),
            },
            '&::before': {
              content: '""',
              position: 'absolute',
              left: -8, top: 10, bottom: 10, width: 3,
              borderRadius: 2,
              background: (t: Theme) => `linear-gradient(180deg, ${t.palette.primary.main}, ${alpha(t.palette.primary.main, 0.4)})`,
              boxShadow: (t: Theme) => `0 0 12px ${t.palette.primary.main}`,
            },
            '& .nav-icon': {
              color: (t: Theme) => t.palette.primary.main,
            },
          }),
          // MUI's default `selected` background — kill it so our gradient shows through.
          '&.Mui-selected, &.Mui-selected:hover': { background: 'transparent !important' },
        }}
      >
        <ListItemIcon
          className="nav-icon"
          sx={{
            justifyContent: 'center',
            minWidth: collapsed ? 0 : 34,
            color: active ? 'primary.main' : 'text.secondary',
            transition: 'color .18s ease, transform .18s ease',
          }}
        >
          {n.icon}
        </ListItemIcon>
        {!collapsed && (
          <>
            <ListItemText
              primary={n.label}
              primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: 14 }}
            />
            {n.badge && (
              <Chip size="small" label={n.badge} sx={{
                ml: 0.5, height: 18,
                background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${alpha(t.palette.primary.main, 0.6)})`,
                color: '#fff',
                '& .MuiChip-label': { px: 0.75, fontSize: 10, fontWeight: 700 },
              }} />
            )}
            {n.children && (expanded[n.label] ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />)}
          </>
        )}
      </ListItemButton>
    );
    return (
      <Box key={n.label}>
        {collapsed ? <Tooltip title={n.label} placement="right" arrow>{row}</Tooltip> : row}
        {!collapsed && n.children && (
          <Collapse in={expanded[n.label]} unmountOnExit>
            <Box
              component="ul"
              sx={{
                listStyle: 'none', m: 0, p: 0,
                position: 'relative',
                mx: 1, mt: 0.25, mb: 0.5, pl: 2.25,
                bgcolor: 'transparent',
                // Hairline rail connecting children to parent.
                // NB: in MUI sx, `width: 1` means 100% — must use '1px' string.
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: '12px', top: '4px', bottom: '4px', width: '1px',
                  background: (t: Theme) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.5 : 0.4),
                },
              }}
            >
              {n.children
                .filter(c => {
                  if (c.requiresBranchModule && !isModuleAllowed(c.requiresBranchModule)) return false;
                  if (c.requiresPermission && !hasPermission(c.requiresPermission)) return false;
                  if (!c.requiresFlag) return true;
                  // Branch-level module gate. Plan flag is checked
                  // separately below — both must allow.
                  if (!isModuleAllowed(c.requiresFlag)) return false;
                  if (flags === null) return true;
                  return !!flags[c.requiresFlag];
                })
                .map((c) => {
                  const childActive = isActive(c.to);
                  return (
                    <Box
                      key={c.to}
                      component="li"
                      sx={{ listStyle: 'none', m: 0, p: 0, bgcolor: 'transparent' }}
                    >
                      <Box
                        component={RouterLink as any}
                        to={c.to}
                        onClick={() => isMobile && setMobileOpen(false)}
                        sx={{
                          // Plain anchor — no MUI defaults can leak through.
                          display: 'flex', alignItems: 'center',
                          textDecoration: 'none',
                          fontSize: 13,
                          fontWeight: childActive ? 600 : 500,
                          minHeight: 30,
                          px: 1.25, my: 0.25,
                          borderRadius: 1,
                          position: 'relative',
                          color: childActive ? 'primary.main' : 'text.secondary',
                          bgcolor: childActive
                            ? (t: Theme) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.12 : 0.10)
                            : 'transparent',
                          boxShadow: childActive
                            ? (t: Theme) => t.palette.mode === 'dark'
                              ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.24)} inset`
                              : 'none'
                            : 'none',
                          transition: 'color .18s ease, background-color .18s ease',
                          '&:hover': {
                            color: childActive ? 'primary.main' : 'text.primary',
                            bgcolor: (t: Theme) => alpha(
                              t.palette.primary.main,
                              t.palette.mode === 'dark'
                                ? (childActive ? 0.16 : 0.06)
                                : (childActive ? 0.14 : 0.04),
                            ),
                          },
                          ...(childActive && {
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              left: -10, top: '50%', transform: 'translateY(-50%)',
                              width: 6, height: 6, borderRadius: '50%',
                              background: (t: Theme) => t.palette.primary.main,
                              boxShadow: (t: Theme) => `0 0 8px ${t.palette.primary.main}`,
                            },
                          }),
                        }}
                      >
                        {c.label}
                      </Box>
                    </Box>
                  );
                })}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  const sidebarContent = useMemo(() => (
    <>
      {/*
       * Top spacer — matches the AppBar's height. Keeps the sidebar nav
       * content aligned with the page content below the topbar. The topbar
       * already shows the brand, so no logo/tagline here (avoids the
       * duplicate-brand leak we were seeing on certain GPU/zoom combos).
       */}
      <Toolbar
        disableGutters
        sx={{
          minHeight: { xs: layout.topbarHeightMobile, md: layout.topbarHeight } + 'px !important',
          flexShrink: 0,
          position: 'relative',
          '&::after': {
            content: '""', position: 'absolute',
            left: '12px', right: '12px', bottom: 0, height: '1px',
            background: (t: Theme) => t.palette.mode === 'dark'
              ? 'linear-gradient(90deg, transparent, rgba(0,230,118,0.22), rgba(79,195,247,0.18), transparent)'
              : `linear-gradient(90deg, transparent, ${alpha(t.palette.primary.main, 0.25)}, transparent)`,
          },
        }}
      />

      <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
        {NAV_GROUPS.map((g, gi) => {
          // Filter items by the active org's plan flags. Platform owners still
          // get the Platform Console entry from the user menu, but customer
          // navigation must reflect the selected customer's plan.
          const items = g.items.filter(it => {
            // Branch-level gate first — can hide a page even when the
            // plan flag allows it (e.g. Roles needs Team enabled at branch).
            if (it.requiresBranchModule && !isModuleAllowed(it.requiresBranchModule)) return false;
            // RBAC gate — what the user's *role* permits. Check explicit
            // code first, then the parent-prefix variant for groups.
            if (it.requiresPermission && !hasPermission(it.requiresPermission)) return false;
            if (it.requiresAnyPermissionPrefix && !hasAnyPermissionStartingWith(it.requiresAnyPermissionPrefix)) return false;
            if (!it.requiresFlag) return true;
            if (!isModuleAllowed(it.requiresFlag)) return false;
            if (flags === null) return true;        // optimistic
            return !!flags[it.requiresFlag];
          });
          if (items.length === 0) return null;
          return (
            <Box key={g.heading} sx={{ mt: gi === 0 ? 0.5 : 1 }}>
              {!collapsed && (
                <Typography
                  variant="caption"
                  sx={{ display: 'block', px: 2.5, pt: 1.25, pb: 0.5, color: 'text.secondary',
                    fontSize: 10.5, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase' }}
                >
                  {g.heading}
                </Typography>
              )}
              {collapsed && gi > 0 && <Divider sx={{ mx: 1.5, my: 0.75 }} />}
              <List disablePadding>
                {items.map(renderItem)}
              </List>
            </Box>
          );
        })}
      </Box>

      {canManageBilling && (
        <>
          {/* Plan badge */}
          <Divider />
          <Box sx={{ p: collapsed ? 1 : 1.5 }}>
            {collapsed ? (
              <Tooltip title={subscription?.plan?.name ? `${subscription.plan.name} plan` : 'No plan selected'} placement="right" arrow>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, mx: 'auto', borderRadius: 1.25,
                  background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}22, ${t.palette.secondary.main}22)`,
                  color: 'primary.main',
                }}>
                  <WorkspacePremiumOutlinedIcon fontSize="small" />
                </Box>
              </Tooltip>
            ) : (
              <Box sx={{
                borderRadius: 1.5, p: 1.25, display: 'flex', alignItems: 'center', gap: 1,
                background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}14, ${t.palette.secondary.main}14)`,
                border: 1, borderColor: 'divider',
              }}>
                <WorkspacePremiumOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ lineHeight: 1.1 }}>
                    {subscription?.plan?.name ? `${subscription.plan.name} plan` : 'No plan'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {subscription?.plan
                      ? `${subscription.status}${subscription.trial_ends_at ? ` · trial till ${subscription.trial_ends_at.slice(0, 10)}` : ''}`
                      : 'Choose a plan'}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </>
      )}

      {isDesktop && (
        <Box sx={{ p: 0.5, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
            <IconButton size="small" onClick={toggleSidebar}>
              {collapsed ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [canManageBilling, collapsed, expanded, flags, isDesktop, isMobile, loc.pathname, subscription, toggleSidebar]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Topbar */}
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, left: 0, right: 0 }}>
        <Toolbar sx={{ minHeight: { xs: layout.topbarHeightMobile, md: layout.topbarHeight } + 'px !important', gap: 1 }}>
          <IconButton edge="start" onClick={() => isMobile ? setMobileOpen(true) : toggleSidebar()}>
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 700, color: 'primary.main', mr: 2,
              display: { xs: 'none', sm: 'block' },
              flexShrink: 0,
            }}
          >
            {brand.app_name}
          </Typography>

          {/* Quick jump to /platform for superadmins. The avatar menu still
              has it; this saves them a click + telegraphs that this is an
              elevated session. Hidden on small screens to keep the toolbar
              clean. */}
          {isSuperuser && (
            <Tooltip title="Open Platform Console (⌘/Ctrl + Shift + A)">
              <Chip
                size="small"
                label="Platform"
                onClick={() => nav('/platform')}
                sx={{
                  display: { xs: 'none', md: 'inline-flex' },
                  fontWeight: 700,
                  cursor: 'pointer',
                  bgcolor: (t) => alpha(t.palette.warning.main, 0.18),
                  color: 'warning.main',
                  borderColor: 'warning.main',
                  '&:hover': {
                    bgcolor: (t) => alpha(t.palette.warning.main, 0.28),
                  },
                }}
              />
            </Tooltip>
          )}

          {/* Switchers — allowed to shrink and clip if space is tight, so the
              right-hand icons always stay visible. */}
          <Box sx={{
            display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center',
            flexShrink: 1, minWidth: 0, overflow: 'hidden',
          }}>
            <BranchSwitcher />
            <BusinessSwitcher />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }} />

          {/* Right action group — flexShrink: 0 guarantees the bell, avatar,
              and quick actions are never pushed off-screen by long business
              names or compact viewports. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Tooltip title="Search ( ⌘K )">
            <Button
              onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
              startIcon={<SearchOutlinedIcon fontSize="small" />}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                px: 1.25, mr: 0.5,
                color: 'text.secondary',
                background: (t: Theme) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
                border: 1, borderColor: 'divider', borderRadius: 1.5,
                fontWeight: 500,
                '&:hover': { background: (t: Theme) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' },
              }}
              endIcon={
                <Box component="span" sx={{
                  fontFamily: '"IBM Plex Mono", monospace', fontSize: 11,
                  px: 0.5, py: 0.25, ml: 0.5, borderRadius: 0.75,
                  background: (t: Theme) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                }}>⌘K</Box>
              }
            >
              Search
            </Button>
          </Tooltip>

          <Tooltip title="Quick create">
            <IconButton onClick={(e) => setQuickCreateEl(e.currentTarget)} color="primary">
              <AddIcon />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={quickCreateEl} open={!!quickCreateEl} onClose={() => setQuickCreateEl(null)}>
            <MenuItem onClick={() => { setQuickCreateEl(null); nav('/sales/invoices/new'); }}>New Invoice</MenuItem>
            <MenuItem onClick={() => { setQuickCreateEl(null); nav('/purchases/bills/new'); }}>New Bill</MenuItem>
            <MenuItem onClick={() => { setQuickCreateEl(null); nav('/expenses?new=1'); }}>New Expense</MenuItem>
            <MenuItem onClick={() => { setQuickCreateEl(null); nav('/payments?new=1'); }}>New Payment</MenuItem>
            <Divider />
            <MenuItem onClick={() => { setQuickCreateEl(null); nav('/parties?new=1'); }}>New Party</MenuItem>
            <MenuItem onClick={() => { setQuickCreateEl(null); nav('/items?new=1'); }}>New Item</MenuItem>
          </Menu>

          <Tooltip title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}>
            <IconButton onClick={toggleMode} size="small">
              {mode === 'dark' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <NotificationsBell />
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label="Account menu">
            <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main', fontSize: 13 }}>
              {userInitial}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <MenuItem onClick={() => { setAnchorEl(null); nav('/profile'); }}>Profile</MenuItem>
            {/* Billing & SaaS invoices live at HO only — branch users
                shouldn't see the upgrade / cancel UI. The matrix gate
                makes a /billing visit redirect anyway, but hiding the
                menu items keeps the surface area clean. */}
            {canManageBilling && isModuleAllowed('module_billing') && [
              <MenuItem key="bill" onClick={() => { setAnchorEl(null); nav('/billing/settings'); }}>Billing</MenuItem>,
              <MenuItem key="inv" onClick={() => { setAnchorEl(null); nav('/billing/invoices'); }}>Invoices</MenuItem>,
            ]}
            <MenuItem onClick={() => { setAnchorEl(null); nav('/settings'); }}>Settings</MenuItem>
            {isSuperuser && [
              <Divider key="d1" />,
              <MenuItem key="platform" onClick={() => { setAnchorEl(null); nav('/platform'); }}>Platform console</MenuItem>,
            ]}
            <Divider />
            <MenuItem onClick={logout}>Logout</MenuItem>
          </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              width: layout.sidebarExpanded,
              display: 'flex', flexDirection: 'column',
              position: 'relative', overflowX: 'hidden',
              backgroundColor: (t: Theme) => t.palette.mode === 'dark' ? '#0B0B0B' : t.palette.background.paper,
              backgroundImage: 'none',
              borderRight: (t: Theme) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : t.palette.divider}`,
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          PaperProps={{
            sx: {
              width: sidebarWidth,
              display: 'flex',
              flexDirection: 'column',
              overflowX: 'hidden',
              position: 'relative',
              transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.short }),
              // Flat surface — keeps focus on content. The gradient orbs were
              // creating a desaturated tint in the middle of the rail.
              backgroundColor: (t: Theme) => t.palette.mode === 'dark' ? '#0B0B0B' : t.palette.background.paper,
              backgroundImage: 'none',
              borderRight: (t: Theme) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : t.palette.divider}`,
              // Custom scrollbar — almost invisible until hover
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-thumb': {
                background: (t: Theme) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.10)',
                borderRadius: 3,
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: (t: Theme) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.18)',
              },
            },
          }}
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
            transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.short }),
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: `${layout.contentPaddingMobile}px`, sm: `${layout.contentPaddingTablet}px`, md: `${layout.contentPaddingDesktop}px` },
          pt: { xs: `${layout.topbarHeightMobile + 16}px`, md: `${layout.topbarHeight + 16}px` },
          pb: { xs: `${layout.bottomNavHeight + 24}px`, md: '32px' },
          minHeight: '100vh',
        }}
      >
        {/*
         * Banner stack — all top-of-page banners (impersonation, maintenance,
         * trial/subscription) live in a single bleed container so:
         *   1. They visually align with the full-width page hero below.
         *   2. The container's `mb` cancels the hero's negative `mt: -3`,
         *      preventing the hero from pulling up underneath the banners.
         */}
        <Box sx={{
          mx: { xs: -1.5, sm: -2, md: -3 },
          mt: { xs: -1.5, sm: -2, md: -3 },
          mb: { xs: 1.5, sm: 2, md: 3 },
          '&:empty': { display: 'none' },
        }}>
          {impersonating && (
            <Box sx={{
              position: 'sticky', top: { xs: layout.topbarHeightMobile, md: layout.topbarHeight },
              zIndex: (t) => t.zIndex.appBar - 1,
              px: { xs: 2, md: 3 }, py: 1,
              background: (t) => `linear-gradient(90deg, ${t.palette.secondary.main}, ${t.palette.secondary.dark || t.palette.secondary.main})`,
              color: '#fff',
              display: 'flex', alignItems: 'center', gap: 1,
              borderBottom: '2px solid rgba(0,0,0,0.18)',
            }}>
              <ShieldOutlinedIcon fontSize="small" />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                Viewing as <b>{impName || 'customer'}</b> · Super Admin · all actions are audited
              </Typography>
              <Tooltip title="Return to platform console">
                <IconButton
                  size="small"
                  sx={{ color: '#fff', bgcolor: 'rgba(0,0,0,0.12)', '&:hover': { bgcolor: 'rgba(0,0,0,0.22)' } }}
                  onClick={exitImpersonation}
                >
                  <LogoutOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          {brand.maintenance_mode && brand.maintenance_message && (
            <Box sx={{
              px: { xs: 2, md: 3 }, py: 1.25,
              bgcolor: 'warning.light', color: 'warning.contrastText',
              borderBottom: '1px solid', borderColor: 'warning.main',
              fontSize: 13, textAlign: 'center', fontWeight: 500,
            }}>
              ⚠ {brand.maintenance_message}
            </Box>
          )}
          {canManageBilling && <SubscriptionBanner />}
        </Box>
        <Outlet />
      </Box>
      {canManageBilling && <UpgradeModal />}
      <CommandPalette />

      {/* Mobile bottom nav */}
      {isMobile && (
        <Box sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: (t) => t.zIndex.appBar }}>
          <BottomNavigation
            showLabels
            value={BOTTOM_NAV.findIndex(b => isActive(b.to))}
            onChange={(_, v) => nav(BOTTOM_NAV[v].to)}
          >
            {BOTTOM_NAV.map((b) => (
              <BottomNavigationAction key={b.to} label={b.label} icon={b.icon} />
            ))}
          </BottomNavigation>
          <IconButton
            onClick={(e) => setQuickCreateEl(e.currentTarget)}
            sx={{
              position: 'absolute',
              left: '50%', transform: 'translate(-50%, -50%)',
              top: 0,
              bgcolor: 'primary.main', color: 'primary.contrastText',
              width: 48, height: 48,
              boxShadow: 4,
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <AddIcon />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
