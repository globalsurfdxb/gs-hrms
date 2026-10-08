export type Location = string;

export interface LocationDef {
  id: string;
  name: string;
  city: string;
  currency: string;
  phoneCode: string;
  phoneDigits: number;
  phoneExample?: string;
  workingHours: string;
  seating: string[];
  template: 'uae' | 'india';
  system: boolean;
}

export type Role = 'Super Admin' | 'HR' | 'Office Admin' | 'Team Lead' | 'Employee';

export type EmploymentStatus = 'Active' | 'Onboarding' | 'Offboarding' | 'Inactive';

export type ExpiryState = 'ok' | 'soon' | 'expired' | 'na';

export interface EmployeeDocument {
  id: string;
  type: string;
  expiryDate?: string;
  state: ExpiryState;
  fileName?: string;
}

export interface EmployeeProfile {
  gender: string;
  maritalStatus: string;
  bloodGroup: string;
  personalEmail: string;
  personalMobile: string;
  currentAddress: string;
  permanentAddress: string;
  extension: string;
  probationEnd: string;
  passportNumber: string;
  passportExpiry: string;
  emiratesIdExpiry?: string;
  labourCardIssue?: string;
  labourCardExpiry?: string;
  aadhaar?: string;
  pan?: string;
  uan?: string;
  paymentMode: string;
  emergency: { group: string; name: string; relationship: string; mobile: string }[];
  totalExperience: string;
  experience: { company: string; location: string; from: string; to: string; title: string; mode: string }[];
  education: { qualification: string; institution: string; course: string; field: string; startYear: string; endYear: string }[];
  family: { name: string; relationship: string; occupation: string }[];
  salary: { currency: string; earnings: { label: string; amount: number }[]; deductions: { label: string; amount: number }[]; total: number; net: number };
  uploadedDocs: string[];
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  bankName: string;
  branchCode: string; // IFSC for Kochi, IBAN/routing for Dubai
  currency: 'AED' | 'INR';
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  avatarInitials: string;
  email: string;
  phone: string;
  company: string;
  department: string;
  designation: string;
  location: Location;
  seatingLocation: string;
  reportingManagerId: string | null;
  dateOfJoining: string;
  employmentStatus: EmploymentStatus;
  employmentType: 'Permanent' | 'Contract' | 'Probation';
  nationality: string;
  dob: string;
  flags: string[];
  documents: EmployeeDocument[];
  bankDetails: BankDetails;
  profile: EmployeeProfile;
  visaExpiry?: string;
  visaState?: ExpiryState;
  emiratesId?: string;
  pfUan?: string;
  exitReason?: string;
  exitDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  shortCode: string;
  description: string;
  website: string;
  location: Location | 'Both';
  established: string;
  status: 'Active' | 'Inactive';
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  locations: string[];
  head: string;
}

export interface Designation {
  id: string;
  departmentId: string;
  title: string;
}

export interface OnboardingRequest {
  id: string;
  candidateName: string;
  location: Location;
  department: string;
  designation: string;
  step: number; // 1-10
  status: 'In Progress' | 'Pending Approval' | 'Approved';
  startDate: string;
  /** System role the new joiner will sign in with. */
  role: Role;
}

export interface OffboardingRequest {
  id: string;
  employeeId: string;
  reason: string;
  resignationDate: string;
  lastWorkingDay: string;
  noticeDays?: number;
  notes?: string;
  assets?: { assetId: string; returned: boolean }[];
  clearance: { item: string; done: boolean }[];
  status: 'Clearance Pending' | 'Pending Approval' | 'Completed';
}

export interface EmployeeRequest {
  id: string;
  employeeId: string;
  type: 'Information Update' | 'Document Request' | 'Address Change' | 'Bank Detail Update';
  details: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  raisedOn: string;
  routedTo: 'HR' | 'Manager';
  /** Proposed new values for the employee record (keys from the employee form, e.g. bankName). Applied only on approval. */
  changes?: Record<string, string>;
  decidedBy?: string;
  decidedOn?: string;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  cycle: string;
  status: 'Not Started' | 'Self Assessment' | 'Manager Review' | 'Completed';
  rating: number | null;
  dueDate: string;
  selfRating?: number;
  selfComments?: string;
  managerComments?: string;
  goals?: string;
  completedOn?: string;
}

export interface LearningRecord {
  id: string;
  employeeId: string;
  course: string;
  category: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  completedOn?: string;
  dueDate?: string;
  assignedOn?: string;
  score?: number;
  notes?: string;
}

export type LeaveType = 'Annual' | 'Sick' | 'Casual' | 'Unpaid';

export interface LeaveBalance {
  employeeId: string;
  type: LeaveType;
  entitled: number;
  taken: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export type AttendanceStatus = 'Present' | 'WFH' | 'Leave' | 'Absent';

export interface AttendanceDay {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
}

export interface Asset {
  id: string;
  type: string;
  name: string;
  serialNumber: string;
  assignedTo: string;
  assignedDate: string;
  warrantyExpiry: string;
  status: 'Active' | 'In Repair' | 'Returned';
}

export interface Payslip {
  id: string;
  employeeId: string;
  month: string;
  gross: number;
  deductions: number;
  net: number;
  currency: 'AED' | 'INR';
  status: 'Paid' | 'Processing';
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  limits: Record<string, number>;
  active: boolean;
}

export interface ExpenseClaim {
  id: string;
  employeeId: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  project: string;
  description: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedOn?: string;
  receipt?: string;
  decidedOn?: string;
  decidedBy?: string;
  note?: string;
}

export interface AuditEntry {
  id: string;
  employeeId: string;
  field: string;
  from: string;
  to: string;
  changedBy: string;
  changedOn: string;
  /** Area of the app the event belongs to (Employee, Access, Approvals, ...). Older entries omit it. */
  module?: string;
}
