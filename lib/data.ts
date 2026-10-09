import { shiftSeed, todayISO } from '@/lib/dates';
import {
  AttendanceDay,
  AuditEntry,
  Asset,
  Company,
  Department,
  Designation,
  Employee,
  EmployeeRequest,
  ExpenseCategory,
  ExpenseClaim,
  LearningRecord,
  LeaveBalance,
  LeaveRequest,
  Location,
  LocationDef,
  OffboardingRequest,
  OnboardingRequest,
  Payslip,
  PerformanceReview,
  Role,
} from './types';
import { buildProfile, seedDigits } from './profiles';

const initials = (name: string) => {
  const words = name.trim().split(/\s+/);
  return (words.length === 1 ? words[0].slice(0, 2) : words.map((w) => w[0]).slice(0, 2).join('')).toUpperCase();
};

/** A structurally valid UAE IBAN (AE + check digits + 3-digit bank code 026 + 16-digit account) for the sample data. */
const aeIban = (account16: string) => {
  const bban = `026${account16.padStart(16, '0').slice(-16)}`;
  const mod97 = (str: string) => str.split('').reduce((r, ch) => (r * 10 + Number(ch)) % 97, 0);
  const check = String(98 - mod97(`${bban}101400`)).padStart(2, '0');
  return `AE${check}${bban}`;
};

const dubaiBank = (accountName: string): Employee['bankDetails'] => ({
  accountName,
  accountNumber: aeIban(seedDigits(accountName, 16)),
  bankName: 'Emirates NBD',
  branchCode: 'EBILAEAD',
  currency: 'AED',
});

const kochiBank = (accountName: string): Employee['bankDetails'] => ({
  accountName,
  accountNumber: seedDigits(accountName, 12),
  bankName: 'HDFC Bank',
  branchCode: 'HDFC0001234',
  currency: 'INR',
});

const RAW_EMPLOYEES: Omit<Employee, 'profile'>[] = [
  {
    id: 'GS-120',
    employeeCode: 'GS-120',
    name: 'Muneer',
    avatarInitials: initials('Muneer'),
    email: 'muneer@gs-it.ae',
    phone: '+971 50 111 2020',
    company: 'GS IT',
    department: 'Management & Administration',
    designation: 'General Manager',
    location: 'Dubai',
    seatingLocation: '901, SIT Tower, Dubai',
    reportingManagerId: null,
    dateOfJoining: '2019-01-05',
    employmentStatus: 'Active',
    employmentType: 'Permanent',
    nationality: 'UAE',
    dob: '1989-03-18',
    flags: ['HR', 'Management'],
    documents: [
      { id: 'd1', type: 'Passport', expiryDate: '2029-04-11', state: 'ok' },
      { id: 'd2', type: 'Emirates ID', expiryDate: '2026-10-15', state: 'ok' },
      { id: 'd3', type: 'Residence Visa', expiryDate: '2026-10-15', state: 'ok' },
    ],
    bankDetails: dubaiBank('Muneer'),
    visaExpiry: '2026-10-15',
    visaState: 'ok',
    emiratesId: '784-1989-100200-3',
    createdAt: '2019-01-05',
    updatedAt: '2026-06-01',
  },
  {
    id: 'GS-058',
    employeeCode: 'GS-058',
    name: 'Harsha',
    avatarInitials: initials('Harsha'),
    email: 'harsha@gs-it.ae',
    phone: '+971 55 771 3300',
    company: 'GS IT',
    department: 'Cloud & Infra',
    designation: 'Solutions Architect',
    location: 'Dubai',
    seatingLocation: '901, SIT Tower, Dubai',
    reportingManagerId: 'GS-120',
    dateOfJoining: '2018-08-14',
    employmentStatus: 'Active',
    employmentType: 'Permanent',
    nationality: 'Brazil',
    dob: '1987-04-26',
    flags: ['Management', 'IT Support'],
    documents: [
      { id: 'd1', type: 'Passport', expiryDate: '2028-02-02', state: 'ok' },
      { id: 'd2', type: 'Emirates ID', expiryDate: '2026-08-09', state: 'soon' },
      { id: 'd3', type: 'Residence Visa', expiryDate: '2026-08-09', state: 'soon' },
    ],
    bankDetails: dubaiBank('Harsha'),
    visaExpiry: '2026-08-09',
    visaState: 'soon',
    emiratesId: '784-1987-905147-0',
    createdAt: '2018-08-14',
    updatedAt: '2026-05-20',
  },
  {
    id: 'GS-119',
    employeeCode: 'GS-119',
    name: 'Aslima',
    avatarInitials: initials('Aslima'),
    email: 'aslima@gs-it.ae',
    phone: '+971 50 442 8830',
    company: 'GS IT',
    department: 'HR',
    designation: 'HR Executive',
    location: 'Dubai',
    seatingLocation: '901, SIT Tower, Dubai',
    reportingManagerId: 'GS-120',
    dateOfJoining: '2023-06-02',
    employmentStatus: 'Active',
    employmentType: 'Permanent',
    nationality: 'UAE',
    dob: '1995-12-05',
    flags: ['HR'],
    documents: [
      { id: 'd1', type: 'Passport', expiryDate: '2027-09-01', state: 'ok' },
      { id: 'd2', type: 'Emirates ID', expiryDate: '2026-11-22', state: 'ok' },
      { id: 'd3', type: 'Residence Visa', expiryDate: '2026-11-22', state: 'ok' },
    ],
    bankDetails: dubaiBank('Aslima'),
    visaExpiry: '2026-11-22',
    visaState: 'ok',
    emiratesId: '784-1995-220981-3',
    createdAt: '2023-06-02',
    updatedAt: '2026-04-11',
  },
  {
    id: 'GS-101',
    employeeCode: 'GS-101',
    name: 'Navami',
    avatarInitials: initials('Navami'),
    email: 'navami@gs-it.ae',
    phone: '+971 56 220 4419',
    company: 'GS IT',
    department: 'Procurement',
    designation: 'Procurement Officer',
    location: 'Dubai',
    seatingLocation: 'Warehouse Office, Dubai',
    reportingManagerId: 'GS-120',
    dateOfJoining: '2021-09-19',
    employmentStatus: 'Active',
    employmentType: 'Permanent',
    nationality: 'Egypt',
    dob: '1992-06-30',
    flags: ['Procurement'],
    documents: [
      { id: 'd1', type: 'Passport', expiryDate: '2027-01-14', state: 'ok' },
      { id: 'd2', type: 'Emirates ID', expiryDate: '2027-01-28', state: 'ok' },
      { id: 'd3', type: 'Residence Visa', expiryDate: '2027-01-28', state: 'ok' },
    ],
    bankDetails: dubaiBank('Navami'),
    visaExpiry: '2027-01-28',
    visaState: 'ok',
    emiratesId: '784-1992-118240-2',
    createdAt: '2021-09-19',
    updatedAt: '2026-03-02',
  },
  {
    id: 'GS-114',
    employeeCode: 'GS-114',
    name: 'Zayd Rahman',
    avatarInitials: initials('Zayd Rahman'),
    email: 'zayd.r@gs-it.ae',
    phone: '+971 50 118 4420',
    company: 'GS IT',
    department: 'Network Engineering',
    designation: 'Network Engineer',
    location: 'Dubai',
    seatingLocation: '901, SIT Tower, Dubai',
    reportingManagerId: 'GS-058',
    dateOfJoining: '2026-07-06',
    employmentStatus: 'Onboarding',
    employmentType: 'Permanent',
    nationality: 'Pakistan',
    dob: '1994-03-14',
    flags: [],
    documents: [{ id: 'd1', type: 'Passport', expiryDate: '2030-01-01', state: 'ok' }],
    bankDetails: dubaiBank('Zayd Rahman'),
    visaExpiry: '2026-08-12',
    visaState: 'soon',
    emiratesId: '784-1994-552031-4',
    createdAt: '2026-06-20',
    updatedAt: '2026-07-01',
  },
  {
    id: 'GS-087',
    employeeCode: 'GS-087',
    name: 'Nived',
    avatarInitials: initials('Nived'),
    email: 'nived@gs-it.ae',
    phone: '+971 55 902 7781',
    company: 'GS Digital',
    department: 'Sales',
    designation: 'Account Manager',
    location: 'Dubai',
    seatingLocation: '703, SIT Tower, Dubai',
    reportingManagerId: 'GS-058',
    dateOfJoining: '2022-01-11',
    employmentStatus: 'Active',
    employmentType: 'Permanent',
    nationality: 'India',
    dob: '1990-08-22',
    flags: ['Account Manager'],
    documents: [
      { id: 'd1', type: 'Passport', expiryDate: '2028-05-19', state: 'ok' },
      { id: 'd2', type: 'Emirates ID', expiryDate: '2027-03-03', state: 'ok' },
      { id: 'd3', type: 'Residence Visa', expiryDate: '2027-03-03', state: 'ok' },
    ],
    bankDetails: dubaiBank('Nived'),
    visaExpiry: '2027-03-03',
    visaState: 'ok',
    emiratesId: '784-1990-338217-1',
    createdAt: '2022-01-11',
    updatedAt: '2026-02-14',
  },
  {
    id: 'GS-042',
    employeeCode: 'GS-042',
    name: 'Omar Haddad',
    avatarInitials: initials('Omar Haddad'),
    email: 'omar.h@gs-it.ae',
    phone: '+971 50 773 1120',
    company: 'GS AV',
    department: 'Sales',
    designation: 'Senior Sales Executive',
    location: 'Dubai',
    seatingLocation: '703, SIT Tower, Dubai',
    reportingManagerId: 'GS-058',
    dateOfJoining: '2019-05-03',
    employmentStatus: 'Active',
    employmentType: 'Permanent',
    nationality: 'Jordan',
    dob: '1988-02-09',
    flags: ['Sales Person'],
    documents: [
      { id: 'd1', type: 'Passport', expiryDate: '2027-07-08', state: 'ok' },
      { id: 'd2', type: 'Emirates ID', expiryDate: '2026-06-25', state: 'expired' },
      { id: 'd3', type: 'Residence Visa', expiryDate: '2026-06-25', state: 'expired' },
    ],
    bankDetails: dubaiBank('Omar Haddad'),
    visaExpiry: '2026-06-25',
    visaState: 'expired',
    emiratesId: '784-1988-771903-6',
    createdAt: '2019-05-03',
    updatedAt: '2026-06-30',
  },
  {
    id: 'GS-063',
    employeeCode: 'GS-063',
    name: 'Fatima Yusuf',
    avatarInitials: initials('Fatima Yusuf'),
    email: 'fatima.y@gs-it.ae',
    phone: '+971 50 908 1122',
    company: 'GS AV',
    department: 'Sales',
    designation: 'Account Manager',
    location: 'Dubai',
    seatingLocation: '703, SIT Tower, Dubai',
    reportingManagerId: 'GS-058',
    dateOfJoining: '2021-03-07',
    employmentStatus: 'Inactive',
    employmentType: 'Permanent',
    nationality: 'Sudan',
    dob: '1993-07-11',
    flags: ['Account Manager'],
    documents: [{ id: 'd1', type: 'Passport', expiryDate: '2027-04-01', state: 'ok' }],
    bankDetails: dubaiBank('Fatima Yusuf'),
    visaExpiry: '2027-02-02',
    visaState: 'ok',
    emiratesId: '784-1993-447820-5',
    exitReason: 'Resignation',
    exitDate: '2026-06-30',
    createdAt: '2021-03-07',
    updatedAt: '2026-06-30',
  },
  {
    id: 'GS-076',
    employeeCode: 'GS-076',
    name: 'Daniel Costa',
    avatarInitials: initials('Daniel Costa'),
    email: 'daniel.c@gs-it.ae',
    phone: '+91 98470 11220',
    company: 'GS IT',
    department: 'Managed Services',
    designation: 'Support Lead',
    location: 'Kochi',
    seatingLocation: 'Kochi Office - Onsite',
    reportingManagerId: 'GS-058',
    dateOfJoining: '2020-02-28',
    employmentStatus: 'Active',
    employmentType: 'Permanent',
    nationality: 'India',
    dob: '1991-10-17',
    flags: ['IT Support'],
    documents: [
      { id: 'd1', type: 'Passport', expiryDate: '2028-08-12', state: 'ok' },
      { id: 'd2', type: 'PAN Card', state: 'ok' },
      { id: 'd3', type: 'Aadhaar', state: 'ok' },
    ],
    // Still on the previous bank until the pending Bank Detail Update (req-4) is approved.
    bankDetails: { ...kochiBank('Daniel Costa'), bankName: 'State Bank of India', branchCode: 'SBIN0070231' },
    pfUan: '1001 2233 4455',
    createdAt: '2020-02-28',
    updatedAt: '2026-01-19',
  },
  {
    id: 'GS-142',
    employeeCode: 'GS-142',
    name: 'Anjali Menon',
    avatarInitials: initials('Anjali Menon'),
    email: 'anjali.m@gs-it.ae',
    phone: '+91 98950 33210',
    company: 'GS IT',
    department: 'Managed Services',
    designation: 'Support Engineer',
    location: 'Kochi',
    seatingLocation: 'Kochi Office - Onsite',
    reportingManagerId: 'GS-076',
    dateOfJoining: '2024-11-04',
    employmentStatus: 'Active',
    employmentType: 'Permanent',
    nationality: 'India',
    dob: '1997-05-09',
    flags: [],
    documents: [
      { id: 'd1', type: 'Passport', expiryDate: '2029-03-20', state: 'ok' },
      { id: 'd2', type: 'PAN Card', state: 'ok' },
      { id: 'd3', type: 'Aadhaar', state: 'ok' },
    ],
    bankDetails: kochiBank('Anjali Menon'),
    pfUan: '1002 3344 5566',
    createdAt: '2024-11-04',
    updatedAt: '2025-12-01',
  },
  {
    id: 'GS-150',
    employeeCode: 'GS-150',
    name: 'Rahul Pillai',
    avatarInitials: initials('Rahul Pillai'),
    email: 'rahul.p@gs-it.ae',
    phone: '+91 90480 11987',
    company: 'GS IT',
    department: 'Finance',
    designation: 'Accounts Executive',
    location: 'Kochi',
    seatingLocation: 'Kochi Office - Onsite',
    reportingManagerId: 'GS-120',
    dateOfJoining: '2026-09-01',
    employmentStatus: 'Onboarding',
    employmentType: 'Probation',
    nationality: 'India',
    dob: '1998-01-27',
    flags: [],
    documents: [{ id: 'd1', type: 'Passport', expiryDate: '2031-06-01', state: 'ok' }],
    bankDetails: kochiBank('Rahul Pillai'),
    pfUan: '1003 4455 6677',
    createdAt: '2026-08-15',
    updatedAt: '2026-09-01',
  },
  {
    id: 'GS-133',
    employeeCode: 'GS-133',
    name: 'Sneha Varma',
    avatarInitials: initials('Sneha Varma'),
    email: 'sneha.v@gs-it.ae',
    phone: '+91 96335 22110',
    company: 'GS Security',
    department: 'Management & Administration',
    designation: 'Admin Executive',
    location: 'Kochi',
    seatingLocation: 'Kochi Office - WFH',
    reportingManagerId: 'GS-120',
    dateOfJoining: '2022-10-10',
    employmentStatus: 'Active',
    employmentType: 'Permanent',
    nationality: 'India',
    dob: '1994-09-02',
    flags: ['Admin'],
    documents: [
      { id: 'd1', type: 'Passport', expiryDate: '2027-12-12', state: 'ok' },
      { id: 'd2', type: 'PAN Card', state: 'ok' },
    ],
    bankDetails: kochiBank('Sneha Varma'),
    pfUan: '1004 5566 7788',
    createdAt: '2022-10-10',
    updatedAt: '2025-11-05',
  },
];

export const EMPLOYEES: Employee[] = RAW_EMPLOYEES.map((e) => ({ ...e, profile: buildProfile(e) }));

export const COMPANIES: Company[] = [
  { id: 'co-1', name: 'GS IT', shortCode: 'GSIT', description: 'Managed IT services, cloud infrastructure and network engineering — the parent entity.', website: 'www.gs-it.ae', location: 'Both', established: '2015', status: 'Active' },
  { id: 'co-2', name: 'GS Digital', shortCode: 'GSD', description: 'Digital marketing, e-commerce platforms and software solutions.', website: 'www.gsdigital.ae', location: 'Dubai', established: '2019', status: 'Active' },
  { id: 'co-3', name: 'GS AV', shortCode: 'GSAV', description: 'Audio-visual systems integration and event technology.', website: 'www.gsav.ae', location: 'Dubai', established: '2017', status: 'Active' },
  { id: 'co-4', name: 'GS Security', shortCode: 'GSS', description: 'Security systems, CCTV and access control solutions.', website: 'www.gssecurity.ae', location: 'Both', established: '2021', status: 'Active' },
];

export const companyHeadcount = (companyName: string) => EMPLOYEES.filter((e) => e.company === companyName && e.employmentStatus !== 'Inactive').length;

export const nextEmployeeCode = (offset = 0) => {
  const max = EMPLOYEES.reduce((m, e) => Math.max(m, parseInt(e.employeeCode.replace(/\D/g, ''), 10) || 0), 0);
  return `GS-${String(max + 1 + offset).padStart(3, '0')}`;
};

export const departmentHeadcount = (companyName: string, departmentName: string) =>
  EMPLOYEES.filter((e) => e.company === companyName && e.department === departmentName && e.employmentStatus !== 'Inactive').length;

export const LOCATIONS: LocationDef[] = [
  { id: 'Dubai', name: 'United Arab Emirates', city: 'Dubai', currency: 'AED', phoneCode: '+971', phoneDigits: 9, phoneExample: '50 123 4567', workingHours: '09:00 – 18:00, Mon–Fri', seating: ['901, SIT Tower, Dubai', '703, SIT Tower, Dubai', 'Warehouse Office, Dubai'], template: 'uae', system: true },
  { id: 'Kochi', name: 'India', city: 'Kochi', currency: 'INR', phoneCode: '+91', phoneDigits: 10, phoneExample: '98765 43210', workingHours: '09:30 – 18:30, Mon–Fri', seating: ['Kochi Office - Onsite', 'Kochi Office - WFH'], template: 'india', system: true },
];

export const DEPARTMENTS: Department[] = [
  { id: 'dep-11', companyId: 'co-1', name: 'Management & Administration', locations: ['Dubai', 'Kochi'], head: 'Muneer' },
  { id: 'dep-12', companyId: 'co-2', name: 'Management & Administration', locations: ['Dubai'], head: 'Unassigned' },
  { id: 'dep-13', companyId: 'co-3', name: 'Management & Administration', locations: ['Dubai'], head: 'Unassigned' },
  { id: 'dep-14', companyId: 'co-4', name: 'Management & Administration', locations: ['Dubai', 'Kochi'], head: 'Unassigned' },
  { id: 'dep-1', companyId: 'co-1', name: 'HR', locations: ['Dubai', 'Kochi'], head: 'Aslima' },
  { id: 'dep-2', companyId: 'co-1', name: 'Sales', locations: ['Dubai'], head: 'Harsha' },
  { id: 'dep-3', companyId: 'co-1', name: 'Cloud & Infra', locations: ['Dubai'], head: 'Harsha' },
  { id: 'dep-4', companyId: 'co-1', name: 'Network Engineering', locations: ['Dubai'], head: 'Harsha' },
  { id: 'dep-5', companyId: 'co-1', name: 'Procurement', locations: ['Dubai'], head: 'Navami' },
  { id: 'dep-6', companyId: 'co-1', name: 'Managed Services', locations: ['Kochi'], head: 'Daniel Costa' },
  { id: 'dep-7', companyId: 'co-1', name: 'Finance', locations: ['Kochi'], head: 'Muneer' },
  { id: 'dep-8', companyId: 'co-2', name: 'Sales', locations: ['Dubai'], head: 'Unassigned' },
  { id: 'dep-9', companyId: 'co-3', name: 'Sales', locations: ['Dubai'], head: 'Unassigned' },
  { id: 'dep-10', companyId: 'co-4', name: 'HR', locations: ['Dubai', 'Kochi'], head: 'Unassigned' },
];

export const DESIGNATIONS: Designation[] = [
  { id: 'des-1', departmentId: 'dep-1', title: 'HR Manager' },
  { id: 'des-2', departmentId: 'dep-1', title: 'HR Executive' },
  { id: 'des-4', departmentId: 'dep-3', title: 'Solutions Architect' },
  { id: 'des-5', departmentId: 'dep-4', title: 'Network Engineer' },
  { id: 'des-6', departmentId: 'dep-2', title: 'Account Manager' },
  { id: 'des-7', departmentId: 'dep-2', title: 'Senior Sales Executive' },
  { id: 'des-8', departmentId: 'dep-5', title: 'Procurement Officer' },
  { id: 'des-9', departmentId: 'dep-6', title: 'Support Lead' },
  { id: 'des-10', departmentId: 'dep-6', title: 'Support Engineer' },
  { id: 'des-11', departmentId: 'dep-7', title: 'Accounts Executive' },
  { id: 'des-12', departmentId: 'dep-8', title: 'Account Manager' },
  { id: 'des-13', departmentId: 'dep-9', title: 'Senior Sales Executive' },
  { id: 'des-14', departmentId: 'dep-9', title: 'Account Manager' },
  { id: 'des-16', departmentId: 'dep-11', title: 'General Manager' },
  { id: 'des-17', departmentId: 'dep-11', title: 'Admin Manager' },
  { id: 'des-18', departmentId: 'dep-11', title: 'Admin Executive' },
  { id: 'des-19', departmentId: 'dep-12', title: 'Admin Executive' },
  { id: 'des-20', departmentId: 'dep-13', title: 'Admin Executive' },
  { id: 'des-21', departmentId: 'dep-14', title: 'Admin Manager' },
  { id: 'des-22', departmentId: 'dep-14', title: 'Admin Executive' },
];

export const ONBOARDING_REQUESTS: OnboardingRequest[] = [
  {
    id: 'onb-1',
    candidateName: 'Zayd Rahman',
    location: 'Dubai',
    department: 'Network Engineering',
    designation: 'Network Engineer',
    step: 8,
    status: 'Pending Approval',
    startDate: '2026-07-06',
    role: 'Employee',
  },
  {
    id: 'onb-2',
    candidateName: 'Rahul Pillai',
    location: 'Kochi',
    department: 'Finance',
    designation: 'Accounts Executive',
    step: 4,
    status: 'In Progress',
    startDate: '2026-09-01',
    role: 'Employee',
  },
];

export const OFFBOARDING_REQUESTS: OffboardingRequest[] = [
  {
    id: 'off-1',
    employeeId: 'GS-063',
    reason: 'Resignation',
    resignationDate: '2026-05-15',
    lastWorkingDay: '2026-06-30',
    clearance: [
      { item: 'IT assets returned', done: true },
      { item: 'Finance clearance', done: true },
      { item: 'HR exit interview', done: true },
      { item: 'Access revoked', done: true },
    ],
    status: 'Completed',
  },
];

export const EMPLOYEE_REQUESTS: EmployeeRequest[] = [
  {
    id: 'req-1',
    employeeId: 'GS-087',
    type: 'Address Change',
    details: 'Update residential address to new apartment in Al Barsha.',
    status: 'Pending',
    raisedOn: '2026-07-02',
    routedTo: 'HR',
    changes: { currentAddress: 'Flat 1204, Al Barsha Heights Tower, Al Barsha, Dubai, PO Box 51873' },
  },
  {
    id: 'req-2',
    employeeId: 'GS-142',
    type: 'Document Request',
    details: 'Salary certificate for visa application (spouse).',
    status: 'Pending',
    raisedOn: '2026-07-05',
    routedTo: 'HR',
  },
  {
    id: 'req-3',
    employeeId: 'GS-114',
    type: 'Information Update',
    details: 'Correct spelling of nationality on record.',
    status: 'Approved',
    raisedOn: '2026-06-20',
    routedTo: 'HR',
  },
  {
    id: 'req-4',
    employeeId: 'GS-076',
    type: 'Bank Detail Update',
    details: 'Change salary account to HDFC Bank, Kochi branch (IFSC HDFC0001234).',
    status: 'Pending',
    raisedOn: '2026-07-08',
    routedTo: 'Manager',
    changes: { bankName: 'HDFC Bank', branchCode: 'HDFC0001234' },
  },
];

export const AUDIT_LOG: AuditEntry[] = [
  { id: 'a1', employeeId: 'GS-087', field: 'Mobile', from: '+971 55 900 1111', to: '+971 55 902 7781', changedBy: 'Nived', changedOn: '2026-02-14' },
  { id: 'a2', employeeId: 'GS-042', field: 'Employment Status', from: 'Probation', to: 'Active', changedBy: 'Muneer', changedOn: '2019-11-03' },
  { id: 'a3', employeeId: 'GS-063', field: 'Employment Status', from: 'Active', to: 'Inactive', changedBy: 'Muneer', changedOn: '2026-06-30' },
];

export const PERFORMANCE_CYCLE = 'H1 2026';

export const PERFORMANCE_REVIEWS: PerformanceReview[] = [
  { id: 'pr-1', employeeId: 'GS-120', cycle: PERFORMANCE_CYCLE, status: 'Completed', rating: 5, dueDate: '2026-06-30', selfRating: 4, selfComments: 'Delivered the Dubai office expansion and the new regional HR policy set on schedule.', managerComments: 'Outstanding half: strong delivery and clear ownership across both locations.' },
  { id: 'pr-2', employeeId: 'GS-058', cycle: PERFORMANCE_CYCLE, status: 'Completed', rating: 4, dueDate: '2026-06-30', selfRating: 4, selfComments: 'Led two cloud migrations and mentored the network engineering team.', managerComments: 'Reliable technical leadership; next step is broader stakeholder reporting.' },
  { id: 'pr-3', employeeId: 'GS-119', cycle: PERFORMANCE_CYCLE, status: 'Manager Review', rating: null, dueDate: '2026-07-15', selfRating: 4, selfComments: 'Closed the onboarding backlog and introduced a checklist that cut new-joiner paperwork time.' },
  { id: 'pr-4', employeeId: 'GS-101', cycle: PERFORMANCE_CYCLE, status: 'Self Assessment', rating: null, dueDate: '2026-07-15' },
  { id: 'pr-5', employeeId: 'GS-087', cycle: PERFORMANCE_CYCLE, status: 'Completed', rating: 5, dueDate: '2026-06-30', selfRating: 4, selfComments: 'Exceeded the half-year account renewal target and onboarded three new clients.', managerComments: 'Top performer on renewals; excellent client relationships.' },
  { id: 'pr-6', employeeId: 'GS-042', cycle: PERFORMANCE_CYCLE, status: 'Not Started', rating: null, dueDate: '2026-07-31' },
  { id: 'pr-7', employeeId: 'GS-076', cycle: PERFORMANCE_CYCLE, status: 'Manager Review', rating: null, dueDate: '2026-07-15', selfRating: 3, selfComments: 'Met support SLAs for the half; want to take on more escalation ownership.' },
  { id: 'pr-8', employeeId: 'GS-142', cycle: PERFORMANCE_CYCLE, status: 'Self Assessment', rating: null, dueDate: '2026-07-15' },
  { id: 'pr-9', employeeId: 'GS-133', cycle: PERFORMANCE_CYCLE, status: 'Not Started', rating: null, dueDate: '2026-07-31' },
];

export const LEARNING_RECORDS: LearningRecord[] = [
  { id: 'lr-1', employeeId: 'GS-114', course: 'UAE Labour Law Essentials', category: 'Compliance', status: 'In Progress', dueDate: '2026-07-31', assignedOn: '2026-07-06' },
  { id: 'lr-2', employeeId: 'GS-087', course: 'Customer Service Excellence', category: 'Sales', status: 'Completed', completedOn: '2026-03-01' },
  { id: 'lr-3', employeeId: 'GS-042', course: 'Customer Service Excellence', category: 'Sales', status: 'In Progress', dueDate: '2026-06-30', assignedOn: '2026-05-15' },
  { id: 'lr-4', employeeId: 'GS-119', course: 'Information Security Awareness', category: 'Compliance', status: 'Completed', completedOn: '2026-01-15' },
  { id: 'lr-5', employeeId: 'GS-101', course: 'Procurement Ethics & Compliance', category: 'Compliance', status: 'Not Started', dueDate: '2026-08-15', assignedOn: '2026-07-01' },
  { id: 'lr-6', employeeId: 'GS-058', course: 'Leadership Foundations', category: 'Management', status: 'Completed', completedOn: '2025-11-20' },
  { id: 'lr-7', employeeId: 'GS-120', course: 'Leadership Foundations', category: 'Management', status: 'Completed', completedOn: '2025-11-20' },
  { id: 'lr-8', employeeId: 'GS-076', course: 'Information Security Awareness', category: 'Compliance', status: 'In Progress', dueDate: '2026-08-15', assignedOn: '2026-07-01' },
  { id: 'lr-9', employeeId: 'GS-142', course: 'Information Security Awareness', category: 'Compliance', status: 'Not Started', dueDate: '2026-08-31', assignedOn: '2026-07-01' },
  { id: 'lr-10', employeeId: 'GS-150', course: 'Finance Onboarding Essentials', category: 'Finance', status: 'In Progress', dueDate: '2026-09-30', assignedOn: '2026-09-01' },
  { id: 'lr-11', employeeId: 'GS-133', course: 'Workplace Diversity & Inclusion', category: 'Culture', status: 'Completed', completedOn: '2026-02-10' },
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-1', name: 'Travel', description: 'Flights, taxis, fuel and mileage for business travel.', limits: { AED: 3000, INR: 30000 }, active: true },
  { id: 'cat-2', name: 'Accommodation', description: 'Hotel stays for client visits and business trips.', limits: { AED: 2000, INR: 20000 }, active: true },
  { id: 'cat-3', name: 'Meals & Entertainment', description: 'Client meals and team entertainment.', limits: { AED: 500, INR: 5000 }, active: true },
  { id: 'cat-4', name: 'Office Supplies', description: 'Stationery, consumables and small equipment.', limits: { AED: 300, INR: 3000 }, active: true },
  { id: 'cat-5', name: 'Client Entertainment', description: 'Gifts and hospitality for client relationships.', limits: { AED: 800, INR: 8000 }, active: true },
];

export const EXPENSE_CLAIMS: ExpenseClaim[] = [
  { id: 'exp-1', employeeId: 'GS-042', category: 'Travel', amount: 1240, currency: 'AED', date: '2026-07-08', project: 'Client onsite — Sales', description: 'Taxi and fuel for client visits across Dubai.', status: 'Pending' },
  { id: 'exp-2', employeeId: 'GS-087', category: 'Client Entertainment', amount: 620, currency: 'AED', date: '2026-07-05', project: 'Sales — Q3', description: 'Client dinner, Al Barsha account renewal.', status: 'Pending' },
  { id: 'exp-3', employeeId: 'GS-058', category: 'Travel', amount: 2100, currency: 'AED', date: '2026-06-28', project: 'Cloud tooling', description: 'Flight to review a client data centre migration.', status: 'Approved' },
  { id: 'exp-4', employeeId: 'GS-101', category: 'Office Supplies', amount: 180, currency: 'AED', date: '2026-06-20', project: 'General & Admin', description: 'Warehouse office consumables restock.', status: 'Approved' },
  { id: 'exp-5', employeeId: 'GS-076', category: 'Travel', amount: 3400, currency: 'INR', date: '2026-07-02', project: 'Client onsite — Kochi', description: 'Round trip to Bangalore for a managed services client.', status: 'Pending' },
  { id: 'exp-6', employeeId: 'GS-142', category: 'Meals & Entertainment', amount: 1200, currency: 'INR', date: '2026-06-25', project: 'Client onsite — Kochi', description: 'Team lunch during an on-site incident.', status: 'Approved' },
  { id: 'exp-7', employeeId: 'GS-119', category: 'Office Supplies', amount: 90, currency: 'AED', date: '2026-06-10', project: 'HR certification', description: 'Printing for onboarding packs.', status: 'Rejected' },
  { id: 'exp-8', employeeId: 'GS-133', category: 'Accommodation', amount: 4500, currency: 'INR', date: '2026-05-30', project: 'HR certification', description: 'Hotel for an HR compliance workshop in Chennai.', status: 'Approved' },
];

/** Today, from the live clock. (Kept under its old name; every screen reads the date from here.) */
export const REFERENCE_TODAY = todayISO();

export interface BusinessRenewal {
  id: string;
  label: string;
  owner: string;
  offsetDays: number;
  location: Location | 'Both';
}

export const BUSINESS_RENEWALS: BusinessRenewal[] = [
  { id: 'br-1', label: 'Trade Licence — Global Surf IT LLC', owner: 'Admin', offsetDays: 5, location: 'Dubai' },
  { id: 'br-2', label: 'Parking ×4', owner: 'Admin', offsetDays: -7, location: 'Dubai' },
  { id: 'br-3', label: 'Mulkiya (Vehicle Registration)', owner: 'Admin', offsetDays: 17, location: 'Dubai' },
  { id: 'br-4', label: 'Ejari Tenancy Contract', owner: 'Admin', offsetDays: 43, location: 'Dubai' },
  { id: 'br-5', label: 'Microsoft 365 · 48 seats', owner: 'Admin', offsetDays: 54, location: 'Both' },
  { id: 'br-6', label: 'Group Medical Insurance ×12', owner: 'HR', offsetDays: 83, location: 'Both' },
  { id: 'br-7', label: 'Kochi Office Lease', owner: 'Admin', offsetDays: 61, location: 'Kochi' },
  { id: 'br-8', label: 'GST Registration Renewal', owner: 'Finance', offsetDays: 29, location: 'Kochi' },
];

export const PAYROLL_TREND: { month: string; amount: number }[] = [
  { month: 'Feb', amount: 540000 },
  { month: 'Mar', amount: 558000 },
  { month: 'Apr', amount: 572000 },
  { month: 'May', amount: 565000 },
  { month: 'Jun', amount: 590000 },
  { month: 'Jul', amount: 612000 },
];

export const ASSET_DISTRIBUTION: { label: string; count: number; color: string }[] = [
  { label: 'Laptop', count: 52, color: '#28469A' },
  { label: 'Monitor', count: 31, color: '#3B82F6' },
  { label: 'Phone', count: 22, color: '#22C55E' },
  { label: 'Vehicle', count: 6, color: '#F59E0B' },
  { label: 'Other', count: 29, color: '#9CA3AF' },
];

const ACTIVE_EMPLOYEES = EMPLOYEES.filter((e) => e.employmentStatus === 'Active');

export const LEAVE_BALANCES: LeaveBalance[] = ACTIVE_EMPLOYEES.flatMap((e, i) => [
  { employeeId: e.id, type: 'Annual' as const, entitled: 21, taken: (i * 3) % 12 },
  { employeeId: e.id, type: 'Sick' as const, entitled: 10, taken: (i * 2) % 6 },
  { employeeId: e.id, type: 'Casual' as const, entitled: 7, taken: i % 4 },
]);

export const LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'lv-1', employeeId: 'GS-076', type: 'Annual', fromDate: '2026-07-14', toDate: '2026-07-16', days: 3, reason: 'Family visit', status: 'Pending' },
  { id: 'lv-2', employeeId: 'GS-087', type: 'Sick', fromDate: '2026-06-30', toDate: '2026-06-30', days: 1, reason: 'Fever', status: 'Approved' },
  { id: 'lv-3', employeeId: 'GS-042', type: 'Casual', fromDate: '2026-07-20', toDate: '2026-07-20', days: 1, reason: 'Personal errand', status: 'Pending' },
  { id: 'lv-4', employeeId: 'GS-142', type: 'Annual', fromDate: '2026-08-03', toDate: '2026-08-07', days: 5, reason: 'Onam festival travel', status: 'Pending' },
  { id: 'lv-5', employeeId: 'GS-119', type: 'Sick', fromDate: '2026-06-15', toDate: '2026-06-16', days: 2, reason: 'Migraine', status: 'Approved' },
  { id: 'lv-6', employeeId: 'GS-101', type: 'Annual', fromDate: '2026-05-20', toDate: '2026-05-22', days: 3, reason: 'Personal', status: 'Rejected' },
];

/* Move the sample transactions so they sit around the real "today" instead of a frozen July 2026.
   Document expiries stay as written (they are facts: an expired visa is expired), except for people who are
   still onboarding, whose joining and paperwork dates move with them. */
{
  const sh = <T extends string | undefined>(d: T): T => (d ? (shiftSeed(d) as T) : d);
  ONBOARDING_REQUESTS.forEach((r) => (r.startDate = sh(r.startDate)));
  EMPLOYEE_REQUESTS.forEach((r) => (r.raisedOn = sh(r.raisedOn)));
  PERFORMANCE_REVIEWS.forEach((r) => ((r.dueDate = sh(r.dueDate)), (r.completedOn = sh(r.completedOn))));
  LEARNING_RECORDS.forEach((r) => ((r.dueDate = sh(r.dueDate)), (r.assignedOn = sh(r.assignedOn)), (r.completedOn = sh(r.completedOn))));
  EXPENSE_CLAIMS.forEach((c) => ((c.date = sh(c.date)), (c.submittedOn = sh(c.submittedOn)), (c.decidedOn = sh(c.decidedOn))));
  LEAVE_REQUESTS.forEach((r) => ((r.fromDate = sh(r.fromDate)), (r.toDate = sh(r.toDate))));
  EMPLOYEES.filter((e) => e.employmentStatus === 'Onboarding').forEach((e) => {
    e.dateOfJoining = sh(e.dateOfJoining);
    e.createdAt = sh(e.createdAt);
    e.updatedAt = sh(e.updatedAt);
    e.visaExpiry = sh(e.visaExpiry);
    e.profile.probationEnd = sh(e.profile.probationEnd);
    e.profile.emiratesIdExpiry = sh(e.profile.emiratesIdExpiry);
    e.profile.labourCardIssue = sh(e.profile.labourCardIssue);
    e.profile.labourCardExpiry = sh(e.profile.labourCardExpiry);
    e.documents.forEach((d) => d.type !== 'Passport' && (d.expiryDate = sh(d.expiryDate)));
  });
}

export const ATTENDANCE_TODAY: AttendanceDay[] = ACTIVE_EMPLOYEES.map((e, i) => {
  let status: AttendanceDay['status'] = 'Present';
  if (LEAVE_REQUESTS.some((r) => r.employeeId === e.id && r.status === 'Approved' && REFERENCE_TODAY >= r.fromDate && REFERENCE_TODAY <= r.toDate)) status = 'Leave';
  else if (i % 5 === 3) status = 'WFH';
  else if (i % 7 === 6) status = 'Absent';
  return {
    employeeId: e.id,
    date: REFERENCE_TODAY,
    status,
    checkIn: status === 'Present' || status === 'WFH' ? `0${8 + (i % 2)}:${(i * 7) % 60 < 10 ? '0' : ''}${(i * 7) % 60}` : undefined,
    checkOut: status === 'Present' || status === 'WFH' ? `1${7 + (i % 2)}:${(i * 11) % 60 < 10 ? '0' : ''}${(i * 11) % 60}` : undefined,
  };
});

export const ASSETS: Asset[] = [
  { id: 'as-1', type: 'Laptop', name: 'MacBook Pro 14"', serialNumber: 'FVFG1A2B3C', assignedTo: 'GS-120', assignedDate: '2023-02-01', warrantyExpiry: '2027-02-01', status: 'Active' },
  { id: 'as-2', type: 'Laptop', name: 'Dell Latitude 5440', serialNumber: 'DL5440-0091', assignedTo: 'GS-058', assignedDate: '2022-08-14', warrantyExpiry: '2026-08-14', status: 'Active' },
  { id: 'as-3', type: 'Monitor', name: 'Dell UltraSharp 27"', serialNumber: 'U2723-4471', assignedTo: 'GS-058', assignedDate: '2022-08-14', warrantyExpiry: '2025-08-14', status: 'Active' },
  { id: 'as-4', type: 'Phone', name: 'iPhone 14', serialNumber: 'IP14-88213', assignedTo: 'GS-087', assignedDate: '2023-01-11', warrantyExpiry: '2025-01-11', status: 'Active' },
  { id: 'as-5', type: 'Laptop', name: 'MacBook Air M2', serialNumber: 'FVMB2X9Y1Z', assignedTo: 'GS-119', assignedDate: '2023-06-02', warrantyExpiry: '2027-06-02', status: 'Active' },
  { id: 'as-6', type: 'Laptop', name: 'HP EliteBook 840', serialNumber: 'HP840-3312', assignedTo: 'GS-076', assignedDate: '2020-02-28', warrantyExpiry: '2024-02-28', status: 'In Repair' },
  { id: 'as-7', type: 'Vehicle', name: 'Toyota Hilux — Warehouse', serialNumber: 'VEH-DXB-118', assignedTo: 'GS-101', assignedDate: '2021-09-19', warrantyExpiry: '2026-09-19', status: 'Active' },
  { id: 'as-8', type: 'Phone', name: 'iPhone 13', serialNumber: 'IP13-55019', assignedTo: 'GS-042', assignedDate: '2022-05-03', warrantyExpiry: '2024-05-03', status: 'Active' },
  { id: 'as-9', type: 'Monitor', name: 'LG 24" FHD', serialNumber: 'LG24-9021', assignedTo: 'GS-142', assignedDate: '2024-11-04', warrantyExpiry: '2027-11-04', status: 'Active' },
];

/** A payslip's figures come from the employee's own salary structure (profile.salary), so they always tie to the Salary tab:
    gross = total earnings, deductions = the structure's deductions, net = gross - deductions. */
export const payslipFigures = (e: Employee) => {
  const s = e.profile.salary;
  const gross = s.earnings.reduce((n, x) => n + x.amount, 0);
  const deductions = s.deductions.reduce((n, x) => n + x.amount, 0);
  return { gross, deductions, net: gross - deductions, currency: s.currency };
};

/** The last three pay months ending with the current one (the current month is still processing). */
const PAY_MONTHS = [2, 1, 0].map((back, i) => {
  const [y, m] = REFERENCE_TODAY.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return { key: d.toISOString().slice(0, 7), label: `${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`, status: (i === 2 ? 'Processing' : 'Paid') as Payslip['status'] };
});

export const PAYSLIPS: Payslip[] = ACTIVE_EMPLOYEES.flatMap((e) =>
  PAY_MONTHS.filter((pm) => pm.key >= e.dateOfJoining.slice(0, 7)).map((pm) => {
    const f = payslipFigures(e);
    return { id: `${e.id}-${pm.key}`, employeeId: e.id, month: pm.label, gross: f.gross, deductions: f.deductions, net: f.net, currency: f.currency as Payslip['currency'], status: pm.status };
  })
);

/** Where an approval queue opens: HR and Super Admin see every location, everyone else their own. */
export const defaultScope = (role: Role, ownLocation: string) => (role === 'HR' || role === 'Super Admin' ? 'All' : ownLocation);

export const PERSONAS: Record<Role, { employeeId: string }> = {
  'Super Admin': { employeeId: 'GS-120' },
  HR: { employeeId: 'GS-119' },
  'Office Admin': { employeeId: 'GS-101' },
  'Team Lead': { employeeId: 'GS-058' },
  Employee: { employeeId: 'GS-087' },
};

export const ROLE_SCOPE: Record<Role, string> = {
  'Super Admin': 'Full system access — every module, role & permission management, settings.',
  HR: 'Full HR scope — directory, onboarding, offboarding, visa, documents, requests, reports.',
  'Office Admin': 'Org structure, files, requests, document expiry and admin operations.',
  'Team Lead': 'Your own workspace plus your direct reports — team directory, visa and requests.',
  Employee: 'Your own profile, documents, expiry and requests.',
};

export const employeeById = (id: string) => EMPLOYEES.find((e) => e.id === id);

export const matchesEmployee = (e: Employee, q: string) => {
  const needle = q.trim().toLowerCase();
  return !needle || `${e.name} ${e.employeeCode} ${e.department} ${e.designation}`.toLowerCase().includes(needle);
};

export const directReports = (managerId: string) =>
  EMPLOYEES.filter((e) => e.reportingManagerId === managerId);

export const managerOf = (e: Employee) =>
  e.reportingManagerId ? employeeById(e.reportingManagerId) : undefined;
