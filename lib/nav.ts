import { Role } from './types';

export type RailModule = 'home' | 'operations' | 'reports' | 'administration';
export type Scope = 'my' | 'team' | 'org';
export type PageModule = RailModule | 'modules';

export interface AppModule {
  slug: string;
  name: string;
  desc: string;
  href: string;
}

export const APP_MODULES: AppModule[] = [
  { slug: 'employee', name: 'Employee Management', desc: 'Directory, onboarding, performance, expiry and expenses', href: '/dashboard' },
  { slug: 'asset-management', name: 'Asset Management', desc: 'Equipment register, assignment and warranty', href: '/modules/asset-management' },
  { slug: 'leave-attendance', name: 'Leave & Attendance Management', desc: 'Attendance today and leave requests', href: '/modules/leave-attendance' },
  { slug: 'payroll', name: 'Payroll Management', desc: 'Monthly payroll runs and payslips', href: '/modules/payroll' },
  { slug: 'renewals', name: 'Renewal Management', desc: 'Employee and business renewals', href: '/modules/renewals' },
];

export const RAIL_LABEL: Record<RailModule, string> = { home: 'Home', operations: 'Operations', reports: 'Reports', administration: 'Administration' };
export const SCOPE_LABEL: Record<Scope, string> = { my: 'My Space', team: 'Team', org: 'Organization' };

interface Persona {
  modules: RailModule[];
  scopes: Scope[];
}

export const PERS: Record<Role, Persona> = {
  Employee: { modules: ['home'], scopes: ['my'] },
  'Team Lead': { modules: ['home'], scopes: ['my', 'team'] },
  HR: { modules: ['home', 'operations', 'reports', 'administration'], scopes: ['my', 'org'] },
  'Office Admin': { modules: ['home', 'operations', 'reports', 'administration'], scopes: ['my', 'org'] },
  'Super Admin': { modules: ['home', 'operations', 'reports', 'administration'], scopes: ['my', 'team', 'org'] },
};

export interface TabDef {
  key: string;
  label: string;
  href: string;
}

export const HOME_TABS: Record<Scope, TabDef[]> = {
  my: [
    { key: 'overview', label: 'Overview', href: '/dashboard' },
    { key: 'profile', label: 'My Profile', href: '/profile' },
    { key: 'leave', label: 'Leave & Attendance', href: '/my/leave-attendance' },
    { key: 'requests', label: 'Requests', href: '/my/requests' },
    { key: 'files', label: 'Files', href: '/my/files' },
    { key: 'assets', label: 'Assets', href: '/my/assets' },
    { key: 'expiry', label: 'Expiry', href: '/my/expiry' },
    { key: 'payslips', label: 'Payslips', href: '/my/payslips' },
    { key: 'notifications', label: 'Notifications', href: '/my/notifications' },
  ],
  team: [
    { key: 'directory', label: 'Directory', href: '/team/directory' },
    { key: 'attendance', label: 'Attendance', href: '/team/attendance' },
    { key: 'leave', label: 'Leave', href: '/team/leave' },
    { key: 'visa', label: 'Visa', href: '/team/visa' },
    { key: 'separation', label: 'Separation', href: '/team/separation' },
    { key: 'expiry', label: 'Expiry', href: '/team/expiry' },
    { key: 'performance', label: 'Performance', href: '/performance' },
    { key: 'notifications', label: 'Notifications', href: '/team/notifications' },
  ],
  org: [
    { key: 'overview', label: 'Overview', href: '/organization' },
    { key: 'directory', label: 'Directory', href: '/directory' },
    { key: 'orgstructure', label: 'Org Structure', href: '/org-chart' },
    { key: 'files', label: 'Files', href: '/documents' },
    { key: 'requests', label: 'Requests', href: '/requests' },
  ],
};

export interface HubItem {
  key: string;
  label: string;
  href: string;
  color: string;
  icon: string;
  /** true = not yet built in this phase; renders a "coming soon" placeholder */
  soon?: boolean;
}

interface HubSection {
  section: string;
  items: HubItem[];
}

export const OPS: HubSection[] = [
  {
    section: 'Employee Lifecycle',
    items: [
      { key: 'directory', label: 'Employee Directory', href: '/directory', color: '#2f6fd6', icon: 'people' },
      { key: 'onboarding', label: 'Onboarding', href: '/onboarding', color: '#2f6fd6', icon: 'join' },
      { key: 'offboarding', label: 'Offboarding', href: '/offboarding', color: '#7a4bd0', icon: 'exit' },
      { key: 'performance', label: 'Performance Management', href: '/performance', color: '#1f9d63', icon: 'star' },
      { key: 'learning', label: 'Learning & Development', href: '/learning', color: '#c6851b', icon: 'book' },
    ],
  },
  {
    section: 'Documents & Compliance',
    items: [
      { key: 'visa', label: 'Visa Management', href: '/visa', color: '#2f6fd6', icon: 'id' },
      { key: 'expiry', label: 'Employee Expiry', href: '/employee-expiry', color: '#d5493f', icon: 'clock' },
    ],
  },
  {
    section: 'Expense Claims',
    items: [
      { key: 'exp-dashboard', label: 'Expense Dashboard', href: '/expense/dashboard', color: '#1f9d63', icon: 'grid' },
      { key: 'exp-claims', label: 'All Claims', href: '/expense/claims', color: '#2f6fd6', icon: 'receipt' },
      { key: 'exp-new', label: 'New Claim', href: '/expense/new', color: '#7a4bd0', icon: 'plus' },
      { key: 'exp-approvals', label: 'Approvals', href: '/expense/approvals', color: '#c6851b', icon: 'check' },
      { key: 'exp-cats', label: 'Categories & Policy', href: '/expense/categories', color: '#6b7690', icon: 'tag' },
    ],
  },
];

export const ADMIN: HubSection[] = [
  {
    section: 'Organization',
    items: [
      { key: 'admin-companies', label: 'Companies', href: '/admin/companies', color: '#2f6fd6', icon: 'building' },
      { key: 'admin-structure', label: 'Departments & Designations', href: '/admin/structure', color: '#7a4bd0', icon: 'tree' },
    ],
  },
  {
    section: 'Access & Automation',
    items: [
      { key: 'admin-roles', label: 'Roles & Permissions', href: '/admin/roles', color: '#7a4bd0', icon: 'key' },
      { key: 'admin-workflow', label: 'Workflow Settings', href: '/admin/workflow', color: '#2f6fd6', icon: 'flow' },
      { key: 'admin-notif', label: 'Notification Rules', href: '/admin/notifications', color: '#1f9d63', icon: 'bell' },
      { key: 'admin-reminders', label: 'Reminders', href: '/admin/reminders', color: '#c6851b', icon: 'bell' },
    ],
  },
  {
    section: 'System',
    items: [
      { key: 'admin-audit', label: 'Audit Logs', href: '/admin/audit', color: '#6b7690', icon: 'history' },
      { key: 'admin-settings', label: 'System Settings', href: '/admin/settings', color: '#6b7690', icon: 'gear' },
    ],
  },
];

/** Resolve a pathname to the scope/tab that should be highlighted in the chrome. */
export function resolveLocation(pathname: string): { module: PageModule; scope?: Scope; tab?: string } {
  if (pathname.startsWith('/modules/')) return { module: 'modules' };
  if (pathname === '/operations') return { module: 'operations' };
  if (pathname === '/reports' || pathname.startsWith('/reports/')) return { module: 'reports' };
  if (pathname === '/administration' || pathname.startsWith('/admin/')) return { module: 'administration' };
  for (const scope of Object.keys(HOME_TABS) as Scope[]) {
    for (const tab of HOME_TABS[scope]) {
      if (pathname === tab.href) return { module: 'home', scope, tab: tab.key };
    }
  }
  for (const section of OPS) {
    for (const item of section.items) {
      if (pathname === item.href) return { module: 'operations' };
    }
  }
  if (pathname.startsWith('/directory/')) return { module: 'home', scope: 'org', tab: 'directory' };
  return { module: 'home', scope: 'my', tab: 'overview' };
}
