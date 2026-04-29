import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Box, LinearProgress } from '@mui/material';

import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import RequireAuth from '@/routes/RequireAuth';
import FeatureGate from '@/routes/FeatureGate';
import BillingOwnerGate from '@/routes/BillingOwnerGate';
import BranchModuleGate from '@/components/BranchModuleGate';
import PermissionGate from '@/components/PermissionGate';
import ErrorBoundary from '@/components/ErrorBoundary';

// ─── Code-split routes via React.lazy ────────────────────────────────────
// Each call below becomes its own JS chunk. The hero bundle now contains
// only the shell (router + layouts + theme + auth guard) — feature pages
// load on demand the first time the user navigates to them.

const Login            = lazy(() => import('@/features/auth/Login'));
const Register         = lazy(() => import('@/features/auth/Register'));
const Onboarding       = lazy(() => import('@/features/business/Onboarding'));

const Dashboard        = lazy(() => import('@/features/dashboard/Dashboard'));
const Parties          = lazy(() => import('@/features/parties/Parties'));
const Items            = lazy(() => import('@/features/items/Items'));

const Invoices         = lazy(() => import('@/features/sales/Invoices'));
const InvoiceForm      = lazy(() => import('@/features/sales/InvoiceForm'));
const Bills            = lazy(() => import('@/features/purchases/Bills'));
const BillForm         = lazy(() => import('@/features/purchases/BillForm'));

const DocumentList     = lazy(() => import('@/features/documents/DocumentList'));
const DocumentForm     = lazy(() => import('@/features/documents/DocumentForm'));

const Payments         = lazy(() => import('@/features/payments/Payments'));
const Stock            = lazy(() => import('@/features/inventory/Stock'));
const Reports          = lazy(() => import('@/features/reports/Reports'));
const Settings         = lazy(() => import('@/features/settings/Settings'));
const BulkImport       = lazy(() => import('@/features/imports/BulkImport'));
const Warehouses       = lazy(() => import('@/features/warehouse/Warehouses'));
const Branches         = lazy(() => import('@/features/branches/Branches'));
const Expenses         = lazy(() => import('@/features/expense/Expenses'));
const TemplateCenter   = lazy(() => import('@/features/templates/TemplateCenter'));
const TemplateEditor   = lazy(() => import('@/features/templates/TemplateEditor'));
const Team             = lazy(() => import('@/features/team/Team'));
const Roles            = lazy(() => import('@/features/team/Roles'));
const Profile          = lazy(() => import('@/features/profile/Profile'));

const InvoicesList     = lazy(() => import('@/features/billing/InvoicesList'));
const UpgradeCheckout  = lazy(() => import('@/features/billing/UpgradeCheckout'));
const BillingSettings  = lazy(() => import('@/features/billing/BillingSettings'));

// Platform admin — its own bundle since most users never load it
const PlatformLayout         = lazy(() => import('@/features/platform/PlatformLayout'));
const PlatformOverview       = lazy(() => import('@/features/platform/PlatformOverview'));
const PlatformOrganizations  = lazy(() => import('@/features/platform/PlatformOrganizations'));
const PlatformOrgDetail      = lazy(() => import('@/features/platform/PlatformOrgDetail'));
const PlatformSubscriptions  = lazy(() => import('@/features/platform/PlatformSubscriptions'));
const PlatformInvoices       = lazy(() => import('@/features/platform/PlatformInvoices'));
const PlatformPlans          = lazy(() => import('@/features/platform/PlatformPlans'));
const PlatformCoupons        = lazy(() => import('@/features/platform/PlatformCoupons'));
const PlatformDunning        = lazy(() => import('@/features/platform/PlatformDunning'));
const PlatformFeatureFlags   = lazy(() => import('@/features/platform/PlatformFeatureFlags'));
const PlatformTeam           = lazy(() => import('@/features/platform/PlatformTeam'));
const PlatformSettings       = lazy(() => import('@/features/platform/PlatformSettings'));
const PlatformEmailTemplates = lazy(() => import('@/features/platform/PlatformEmailTemplates'));

// Marketing pages — biggest individual chunks (LandingPage especially)
const LandingPage = lazy(() => import('@/features/marketing/LandingPage'));
const Pricing     = lazy(() => import('@/features/marketing/Pricing'));
const SignupWizard = lazy(() => import('@/features/onboarding/SignupWizard'));

// ─── Suspense fallback ───────────────────────────────────────────────────
function RouteFallback() {
  return (
    <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1300 }}>
      <LinearProgress />
    </Box>
  );
}

/**
 * Wrap children in an ErrorBoundary keyed by pathname so navigating away
 * from a crashed page automatically resets the boundary.
 */
function Guarded({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <ErrorBoundary resetKey={loc.pathname}>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public marketing + signup (no auth) */}
      <Route path="/" element={<Guarded><LandingPage /></Guarded>} />
      <Route path="/pricing" element={<Guarded><Pricing /></Guarded>} />
      <Route path="/signup" element={<Guarded><SignupWizard /></Guarded>} />

      <Route path="/auth" element={<AuthLayout />}>
        <Route path="login" element={<Guarded><Login /></Guarded>} />
        <Route path="register" element={<Guarded><Register /></Guarded>} />
      </Route>
      <Route path="/onboarding" element={<RequireAuth><Guarded><Onboarding /></Guarded></RequireAuth>} />
      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<Guarded><Dashboard /></Guarded>} />
        <Route path="parties" element={<Guarded><FeatureGate feature="module_parties"><PermissionGate code="masters.parties.view"><Parties /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="items" element={<Guarded><FeatureGate feature="module_items"><PermissionGate code="masters.items.view"><Items /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="sales/invoices" element={<Guarded><FeatureGate feature="sales.invoice"><PermissionGate code="sales.invoice.view"><Invoices /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="sales/estimates" element={<Guarded><FeatureGate feature="sales.estimate"><DocumentList title="Estimates / Quotations" endpoint="/sales/estimates/" createPath="/sales/estimates/new" detailBasePath="/sales/estimates" /></FeatureGate></Guarded>} />
        <Route path="sales/estimates/new" element={<Guarded><FeatureGate feature="sales.estimate"><DocumentForm title="Estimate" endpoint="/sales/estimates/" backPath="/sales/estimates" partyRole="customer" docKind="estimate" /></FeatureGate></Guarded>} />
        <Route path="sales/estimates/:id" element={<Guarded><FeatureGate feature="sales.estimate"><DocumentForm title="Estimate" endpoint="/sales/estimates/" backPath="/sales/estimates" partyRole="customer" docKind="estimate" /></FeatureGate></Guarded>} />
        <Route path="sales/orders" element={<Guarded><FeatureGate feature="sales.sales_order"><DocumentList title="Sales Orders" endpoint="/sales/orders/" createPath="/sales/orders/new" detailBasePath="/sales/orders" /></FeatureGate></Guarded>} />
        <Route path="sales/orders/new" element={<Guarded><FeatureGate feature="sales.sales_order"><DocumentForm title="Sales Order" endpoint="/sales/orders/" backPath="/sales/orders" partyRole="customer" docKind="sales_order" /></FeatureGate></Guarded>} />
        <Route path="sales/orders/:id" element={<Guarded><FeatureGate feature="sales.sales_order"><DocumentForm title="Sales Order" endpoint="/sales/orders/" backPath="/sales/orders" partyRole="customer" docKind="sales_order" /></FeatureGate></Guarded>} />
        <Route path="sales/delivery-challans" element={<Guarded><FeatureGate feature="sales.delivery_challan"><DocumentList title="Delivery Challans" endpoint="/sales/delivery-challans/" createPath="/sales/delivery-challans/new" detailBasePath="/sales/delivery-challans" /></FeatureGate></Guarded>} />
        <Route path="sales/delivery-challans/new" element={<Guarded><FeatureGate feature="sales.delivery_challan"><DocumentForm title="Delivery Challan" endpoint="/sales/delivery-challans/" backPath="/sales/delivery-challans" partyRole="customer" docKind="delivery_challan" /></FeatureGate></Guarded>} />
        <Route path="sales/delivery-challans/:id" element={<Guarded><FeatureGate feature="sales.delivery_challan"><DocumentForm title="Delivery Challan" endpoint="/sales/delivery-challans/" backPath="/sales/delivery-challans" partyRole="customer" docKind="delivery_challan" /></FeatureGate></Guarded>} />
        <Route path="sales/invoices/new" element={<Guarded><FeatureGate feature="sales.invoice"><InvoiceForm /></FeatureGate></Guarded>} />
        <Route path="sales/invoices/:id" element={<Guarded><FeatureGate feature="sales.invoice"><InvoiceForm /></FeatureGate></Guarded>} />
        <Route path="purchases/orders" element={<Guarded><FeatureGate feature="purchases.purchase_order"><DocumentList title="Purchase Orders" endpoint="/purchases/orders/" partyLabel="Supplier" createPath="/purchases/orders/new" detailBasePath="/purchases/orders" /></FeatureGate></Guarded>} />
        <Route path="purchases/orders/new" element={<Guarded><FeatureGate feature="purchases.purchase_order"><DocumentForm title="Purchase Order" endpoint="/purchases/orders/" backPath="/purchases/orders" partyRole="supplier" docKind="purchase_order" /></FeatureGate></Guarded>} />
        <Route path="purchases/orders/:id" element={<Guarded><FeatureGate feature="purchases.purchase_order"><DocumentForm title="Purchase Order" endpoint="/purchases/orders/" backPath="/purchases/orders" partyRole="supplier" docKind="purchase_order" /></FeatureGate></Guarded>} />
        <Route path="purchases/bills" element={<Guarded><FeatureGate feature="purchases.bill"><PermissionGate code="purchase.bill.view"><Bills /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="purchases/bills/new" element={<Guarded><FeatureGate feature="purchases.bill"><PermissionGate code="purchase.bill.create"><BillForm /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="purchases/bills/:id" element={<Guarded><FeatureGate feature="purchases.bill"><PermissionGate code="purchase.bill.view"><BillForm /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="payments" element={<Guarded><FeatureGate feature="module_payments"><PermissionGate code="sales.payment_in.view"><Payments /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="inventory" element={<Guarded><FeatureGate feature="module_inventory"><PermissionGate code="inventory.stock_summary.view"><Stock /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="warehouses" element={<Guarded><PermissionGate code="masters.warehouses.view"><Warehouses /></PermissionGate></Guarded>} />
        <Route path="branches" element={<Guarded><BranchModuleGate module="module_branches"><PermissionGate code="staff.branches.view"><Branches /></PermissionGate></BranchModuleGate></Guarded>} />
        <Route path="expenses" element={<Guarded><PermissionGate code="accounting.journal.view"><Expenses /></PermissionGate></Guarded>} />
        <Route path="reports" element={<Guarded><FeatureGate feature="module_reports_basic"><Reports /></FeatureGate></Guarded>} />
        <Route path="templates" element={<Guarded><FeatureGate feature="designer"><PermissionGate code="settings.pdf_template.view"><TemplateCenter /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="templates/:id/edit" element={<Guarded><FeatureGate feature="designer"><PermissionGate code="settings.pdf_template.edit"><TemplateEditor /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="settings" element={<Guarded><FeatureGate feature="module_settings"><PermissionGate code="settings.business.view"><Settings /></PermissionGate></FeatureGate></Guarded>} />
        <Route path="settings/import" element={<Guarded><PermissionGate code="masters.items.create"><BulkImport /></PermissionGate></Guarded>} />
        <Route path="team" element={<Guarded><FeatureGate feature="module_team"><BranchModuleGate module="module_team"><PermissionGate code="staff.users.view"><Team /></PermissionGate></BranchModuleGate></FeatureGate></Guarded>} />
        <Route path="team/roles" element={<Guarded><FeatureGate feature="rbac"><BranchModuleGate module="module_team"><PermissionGate code="staff.roles.view"><Roles /></PermissionGate></BranchModuleGate></FeatureGate></Guarded>} />
        <Route path="profile" element={<Guarded><Profile /></Guarded>} />
        <Route path="billing/invoices" element={<Guarded><BranchModuleGate module="module_billing"><BillingOwnerGate><InvoicesList /></BillingOwnerGate></BranchModuleGate></Guarded>} />
        <Route path="billing/settings" element={<Guarded><BranchModuleGate module="module_billing"><BillingOwnerGate><BillingSettings /></BillingOwnerGate></BranchModuleGate></Guarded>} />
        <Route path="billing/checkout" element={<Guarded><BranchModuleGate module="module_billing"><BillingOwnerGate><UpgradeCheckout /></BillingOwnerGate></BranchModuleGate></Guarded>} />
        <Route path="billing/checkout/:id" element={<Guarded><BranchModuleGate module="module_billing"><BillingOwnerGate><UpgradeCheckout /></BillingOwnerGate></BranchModuleGate></Guarded>} />
        <Route path="platform" element={<Guarded><PlatformLayout /></Guarded>}>
          <Route index element={<Guarded><PlatformOverview /></Guarded>} />
          <Route path="organizations" element={<Guarded><PlatformOrganizations /></Guarded>} />
          <Route path="organizations/:id" element={<Guarded><PlatformOrgDetail /></Guarded>} />
          <Route path="subscriptions" element={<Guarded><PlatformSubscriptions /></Guarded>} />
          <Route path="invoices" element={<Guarded><PlatformInvoices /></Guarded>} />
          <Route path="plans" element={<Guarded><PlatformPlans /></Guarded>} />
          <Route path="coupons" element={<Guarded><PlatformCoupons /></Guarded>} />
          <Route path="dunning" element={<Guarded><PlatformDunning /></Guarded>} />
          <Route path="feature-flags" element={<Guarded><PlatformFeatureFlags /></Guarded>} />
          <Route path="team" element={<Guarded><PlatformTeam /></Guarded>} />
          <Route path="settings" element={<Guarded><PlatformSettings /></Guarded>} />
          <Route path="email-templates" element={<Guarded><PlatformEmailTemplates /></Guarded>} />
        </Route>
      </Route>
      {/* Alternate platform-admin entrypoints — typing /admin or /console
          in the address bar is faster than the user-menu, and matches what
          most SaaS products do. Both require an authenticated session. */}
      <Route path="/admin" element={<RequireAuth><Navigate to="/platform" replace /></RequireAuth>} />
      <Route path="/console" element={<RequireAuth><Navigate to="/platform" replace /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
