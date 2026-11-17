import { api } from '@/lib/api';

/* The backend employee profile (GET/PATCH /api/employees/:code/profile, signed in). Reading follows the caller's data
   scope (out of scope = 404); saving needs Directory → Edit (403 otherwise) and writes one Audit Log entry per save
   that changes something. Identity documents, bank and salary are not part of it yet. Local development only — see
   API_ENABLED. */

export interface ServerEmergencyContact {
  group: string;
  name: string;
  relationship: string;
  mobile: string;
}

export interface ServerExperience {
  company: string;
  location: string;
  /** YYYY-MM-DD or null */
  fromDate: string | null;
  toDate: string | null;
  title: string;
  /** Onsite | Remote | Hybrid, or "" */
  workMode: string;
}

export interface ServerEducation {
  qualification: string;
  institution: string;
  course: string;
  field: string;
  startYear: number | null;
  endYear: number | null;
}

export interface ServerFamilyMember {
  name: string;
  relationship: string;
  occupation: string;
  dateOfBirth: string | null;
}

/** Text fields of the profile; null = not on file. */
export const PROFILE_TEXT = [
  'firstName',
  'middleName',
  'lastName',
  'dateOfBirth',
  'nationality',
  'gender',
  'maritalStatus',
  'bloodGroup',
  'personalEmail',
  'personalMobile',
  'currentAddress',
  'permanentAddress',
  'workPhone',
  'extension',
  'seatingLocation',
  'probationEnd',
  'totalExperience',
] as const;
export type ProfileTextKey = (typeof PROFILE_TEXT)[number];

export type ServerProfileData = Record<ProfileTextKey, string | null> & {
  employeeCode: string;
  emergencyContacts: ServerEmergencyContact[];
  experience: ServerExperience[];
  education: ServerEducation[];
  family: ServerFamilyMember[];
  /** Whether the caller may save changes. */
  canEdit: boolean;
};

/** PATCH body: a field left out stays; "" or null clears it; a list that is sent replaces the whole list. */
export type ProfileUpdate = Partial<Record<ProfileTextKey, string | null>> & {
  emergencyContacts?: ServerEmergencyContact[];
  experience?: Partial<ServerExperience>[];
  education?: Partial<ServerEducation>[];
  family?: Partial<ServerFamilyMember>[];
};

/** BR-EMP-010: emergency contact groups follow the work location's template (same lists as the backend). */
export const EMERGENCY_GROUPS = {
  uae: ['Local Emergency Contact (UAE)', 'Home Country Emergency Contact'],
  india: ['Primary Emergency Contact', 'Alternate Emergency Contact'],
} as const;

export const profilesApi = {
  get: (code: string) => api<ServerProfileData>('GET', `/employees/${encodeURIComponent(code)}/profile`),
  update: (code: string, body: ProfileUpdate) => api<ServerProfileData>('PATCH', `/employees/${encodeURIComponent(code)}/profile`, body),
};
