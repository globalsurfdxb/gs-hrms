import { ADMIN, HOME_TABS, OPS, PERS, RailModule, Scope } from '@/lib/nav';
import { Role } from '@/lib/types';

/* Permission catalogue shared by every module: Module → Category → Feature.
   Roles & Permissions reads this to build its accordions; each module can check a grant by feature id. */

export interface AccessFeature {
  id: string;
  label: string;
  custom?: boolean;
}

export interface AccessCategory {
  id: string;
  label: string;
  /** Lowest built-in role rank that gets this category by default (1 Employee … 5 Super Admin). */
  rank: number;
  features: AccessFeature[];
}

export interface AccessModule {
  id: string;
  name: string;
  desc: string;
  /** Common modules (Administration) are shared by every other module. */
  common?: boolean;
  categories: AccessCategory[];
}

export const SYSTEM_ROLES: Role[] = ['Super Admin', 'HR', 'Office Admin', 'Team Lead', 'Employee'];
const RANK: Record<Role, number> = { Employee: 1, 'Team Lead': 2, 'Office Admin': 3, HR: 4, 'Super Admin': 5 };

const feats = (module: string, category: string, labels: string[]): AccessFeature[] =>
  labels.map((label) => ({ id: `${module}:${category}:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`, label }));

const cat = (module: string, id: string, label: string, rank: number, labels: string[]): AccessCategory => ({ id, label, rank, features: feats(module, id, labels) });

export function buildCatalog(): AccessModule[] {
  const employee: AccessModule = {
    id: 'employee',
    name: 'Employee Management',
    desc: 'Directory, onboarding, performance, expiry and expenses',
    categories: [
      { id: 'my', label: 'My Space', rank: 1, features: HOME_TABS.my.map((t) => ({ id: `employee:my:${t.key}`, label: t.label })) },
      { id: 'team', label: 'Team', rank: 2, features: HOME_TABS.team.map((t) => ({ id: `employee:team:${t.key}`, label: t.label })) },
      { id: 'org', label: 'Organization', rank: 3, features: HOME_TABS.org.map((t) => ({ id: `employee:org:${t.key}`, label: t.label })) },
      ...OPS.map((s) => ({
        id: `ops-${s.section.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: `Operations · ${s.section}`,
        rank: 4,
        features: s.items.map((i) => ({ id: `employee:ops:${i.key}`, label: i.label })),
      })),
      cat('employee', 'reports', 'Reports', 4, ['Reports & analytics']),
    ],
  };
  const asset: AccessModule = {
    id: 'asset-management',
    name: 'Asset Management',
    desc: 'Equipment register, assignment and warranty',
    categories: [
      cat('asset', 'register', 'Register & assignment', 3, ['Asset register', 'Assign & return', 'Warranty & AMC tracking']),
      cat('asset', 'reports', 'Reports', 3, ['Asset reports']),
    ],
  };
  const leave: AccessModule = {
    id: 'leave-attendance',
    name: 'Leave & Attendance Management',
    desc: 'Attendance, leave, approvals and payroll-ready output',
    categories: [
      cat('leave', 'my-space', 'My Space', 1, ['Overview & check-in', 'Dashboard', 'Calendar']),
      cat('leave', 'leave', 'Leave Tracker', 1, ['Leave summary', 'Leave requests', 'Compensatory request', 'Holiday calendar']),
      cat('leave', 'attendance', 'Attendance', 1, ['Attendance summary', 'Regularization requests']),
      cat('leave', 'team', 'Team', 2, ['Reportees', 'Approvals', 'Team attendance', 'Team leave calendar', 'Ex-employees']),
      cat('leave', 'org', 'Organization', 3, ['Organization overview', 'Announcements', 'Policies', 'New hires']),
      cat('leave', 'reports', 'Reports', 2, ['Reports & analytics']),
      cat('leave', 'ops-attendance', 'Operations · Attendance', 4, ['Attendance processing', 'Exceptions', 'Attendance statuses', 'Shift master', 'Ramadan schedule']),
      cat('leave', 'ops-leave', 'Operations · Leave', 4, ['Leave types', 'Document verification', 'Balance adjustment', 'Carry forward', 'Encashment', 'Maternity / parental', 'Holiday settings']),
      cat('leave', 'ops-compliance', 'Operations · Compliance', 4, ['Occurrences', 'Discipline cases', 'Approval workflows']),
      cat('leave', 'ops-payroll', 'Operations · Payroll & Output', 4, ['Overtime & comp-off', 'Finalize & lock', 'Payroll export', 'Audit logs']),
      cat('leave', 'ops-config', 'Operations · Configuration', 4, ['Policy settings']),
      cat('leave', 'ops-admin', 'Operations · Administration', 5, ['Companies & branches', 'Biometric devices', 'API & integrations', 'System audit']),
    ],
  };
  const payroll: AccessModule = {
    id: 'payroll',
    name: 'Payroll Management',
    desc: 'Monthly payroll runs and payslips',
    categories: [
      cat('payroll', 'self', 'Self service', 1, ['My payslips']),
      cat('payroll', 'processing', 'Payroll processing', 4, ['Payroll runs', 'Salary structure', 'Payslip distribution']),
      cat('payroll', 'reports', 'Reports', 4, ['Payroll reports']),
    ],
  };
  const renewals: AccessModule = {
    id: 'renewals',
    name: 'Renewal Management',
    desc: 'Employee and business renewals',
    categories: [
      cat('renewals', 'employee', 'Employee renewals', 4, ['Visa renewals', 'Emirates ID renewals', 'Passport & other documents']),
      cat('renewals', 'business', 'Business renewals', 5, ['Trade licence', 'Insurance policies', 'Contracts & subscriptions']),
      cat('renewals', 'reminders', 'Reminders', 4, ['Reminder rules', 'Reminder log']),
    ],
  };
  const admin: AccessModule = {
    id: 'administration',
    name: 'Administration',
    desc: 'Common to every module — organisation, access and system settings',
    common: true,
    categories: ADMIN.map((s) => ({
      id: `admin-${s.section.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      label: s.section,
      rank: 5,
      features: s.items.map((i) => ({ id: `administration:${i.key}`, label: i.label })),
    })),
  };
  return [admin, employee, leave, asset, payroll, renewals];
}

/** Default grants for the built-in roles, so the matrix starts from sensible access. */
export function defaultGrants(role: Role, catalog: AccessModule[]): string[] {
  const p = PERS[role];
  const out: string[] = [];
  catalog.forEach((m) => {
    m.categories.forEach((c) => {
      let allowed: boolean;
      if (m.id === 'employee') {
        if (c.id === 'my' || c.id === 'team' || c.id === 'org') allowed = p.scopes.includes(c.id as Scope);
        else if (c.id === 'reports') allowed = p.modules.includes('reports' as RailModule);
        else allowed = p.modules.includes('operations' as RailModule);
      } else if (m.id === 'administration') allowed = p.modules.includes('administration' as RailModule);
      else allowed = RANK[role] >= c.rank;
      if (allowed) c.features.forEach((f) => out.push(f.id));
    });
  });
  return out;
}
