import { useSyncExternalStore } from 'react';
import { logAudit } from '@/lib/employeeStore';
import { ENTITY_NAME } from '@/lib/org';
import { COMPANIES, EMPLOYEES } from '@/lib/data';
import { appById, candById, getHiring, jobById } from '@/lib/hiringStore';
import { HiringState, Interview, Offer } from '@/lib/hiringTypes';

/* Candidate email for Hiring Management: templates, which stage sends which template, the integration settings
   (Outlook, Teams) and a log of every message. There is no mail server behind this yet, so every message is
   written to the log in "sandbox" mode and nothing is delivered. The functions below are the seam a real
   EmailProvider (Microsoft Graph or SMTP) plugs into. */

/* ---------------------------------------------------------------------- types */

export const MERGE_FIELDS: { key: string; label: string; sample: string }[] = [
  { key: 'candidate.firstName', label: 'Candidate first name', sample: 'Hamza' },
  { key: 'candidate.fullName', label: 'Candidate full name', sample: 'Hamza Farouk' },
  { key: 'job.title', label: 'Job title', sample: 'Network Engineer' },
  { key: 'job.location', label: 'Job location', sample: 'Dubai, UAE' },
  { key: 'job.department', label: 'Department', sample: 'Network Engineering' },
  { key: 'interview.round', label: 'Interview round', sample: 'Technical Interview' },
  { key: 'interview.date', label: 'Interview date', sample: '14 Oct 2026' },
  { key: 'interview.time', label: 'Interview time', sample: '10:00' },
  { key: 'interview.mode', label: 'Interview mode', sample: 'Teams' },
  { key: 'interview.link', label: 'Interview link', sample: 'https://teams.microsoft.com/l/meetup-join/…' },
  { key: 'offer.joiningDate', label: 'Joining date', sample: '11 Nov 2026' },
  { key: 'offer.expiryDate', label: 'Offer expiry date', sample: '19 Oct 2026' },
  { key: 'onboarding.link', label: 'Link to the joining form', sample: 'https://…/onboarding/form/…' },
  { key: 'onboarding.dueDate', label: 'Joining form: complete by', sample: '15 Nov 2026' },
  { key: 'onboarding.documents', label: 'Joining form: what to have ready', sample: '- Passport …' },
  { key: 'offer.link', label: 'Link to read and answer the offer', sample: 'https://…/offer/respond/…' },
  { key: 'recruiter.name', label: 'Recruiter name', sample: 'Aslima' },
  { key: 'company.name', label: 'Company name', sample: ENTITY_NAME },
  { key: 'portal.link', label: 'Careers page link', sample: 'https://…/careers/JOB-0001' },
];

export const TEMPLATE_CATEGORIES = ['Application', 'Screening', 'Interview', 'Rejection', 'Offer', 'Onboarding', 'Other'] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export const ATTACHMENT_OPTIONS = ['CV', 'Job description', 'Offer letter (PDF)', 'Company profile', 'Pre-joining documents checklist'];

export interface EmailTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  /** 'Both' or a location id. */
  location: string;
  attachments: string[];
  /** Shipped with the app: it can be edited and reset, but not deleted. */
  system: boolean;
  updatedAt: string;
  updatedBy: string;
}

/** Moments that can send a template: each pipeline stage, plus interview and offer events. */
export const RULE_KEYS = ['Applied', 'Screening', 'Technical Interview', 'HR Interview', 'Offer', 'Offer sent', 'Hired', 'Rejected', 'Interview scheduled', 'Interview rescheduled'] as const;
export type RuleKey = (typeof RULE_KEYS)[number];
export const RULE_HELP: Record<RuleKey, string> = {
  Applied: 'When a candidate applies through the careers page',
  Screening: 'When a candidate moves to Screening',
  'Technical Interview': 'When a candidate moves to the Technical Interview stage',
  'HR Interview': 'When a candidate moves to the HR Interview stage',
  Offer: 'When a candidate moves to the Offer stage',
  'Offer sent': 'When an offer is marked as sent',
  Hired: 'When onboarding is started from an accepted offer',
  Rejected: 'When a candidate is rejected',
  'Interview scheduled': 'When an interview is scheduled',
  'Interview rescheduled': 'When an interview is moved to a new time',
};

export type RuleMode = 'ask' | 'auto' | 'off';
export interface StageRule {
  key: RuleKey;
  templateId: string;
  /** ask = show the email first (Send / Edit / Skip); auto = send straight away; off = no email. */
  mode: RuleMode;
}

export interface MailSettings {
  fromName: string;
  fromAddress: string;
  signature: string;
  outlook: { connected: boolean; tenant: string; mailbox: string; connectedAt?: string; by?: string };
  teams: { connected: boolean; createLinks: boolean; connectedAt?: string; by?: string };
}

export interface MailMessage {
  id: string;
  candidateId: string;
  applicationId?: string;
  templateName?: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  from: string;
  /** Sandbox: written to the log only; nothing leaves the system. */
  status: 'Sent' | 'Failed';
  provider: string;
  at: string;
  by: string;
  trigger: string;
}

export interface MailState {
  templates: EmailTemplate[];
  rules: StageRule[];
  messages: MailMessage[];
  settings: MailSettings;
}

/* ---------------------------------------------------------------------- defaults */

const SIGN = '\n\nKind regards,\n{{recruiter.name}}\n{{company.name}} · Talent Acquisition';

const T = (id: string, name: string, category: TemplateCategory, subject: string, body: string, attachments: string[] = [], location = 'Both'): EmailTemplate => ({
  id,
  name,
  category,
  subject,
  body,
  location,
  attachments,
  system: true,
  updatedAt: '',
  updatedBy: 'System',
});

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  T('tpl-received', 'Application received', 'Application', 'We received your application for {{job.title}}', 'Hi {{candidate.firstName}},\n\nThank you for applying for the {{job.title}} role in {{job.location}}. We have received your application and our team will review it. If your profile is a fit we will contact you about the next step.' + SIGN),
  T('tpl-shortlisted', 'Shortlisted', 'Screening', 'You are shortlisted for {{job.title}}', 'Hi {{candidate.firstName}},\n\nGood news: your profile has been shortlisted for the {{job.title}} role. A member of our team will be in touch shortly to talk through the next steps.' + SIGN),
  T('tpl-interview', 'Interview invitation', 'Interview', 'Interview invitation: {{job.title}} ({{interview.round}})', 'Hi {{candidate.firstName}},\n\nWe would like to invite you to a {{interview.round}} for the {{job.title}} role.\n\nDate: {{interview.date}}\nTime: {{interview.time}}\nFormat: {{interview.mode}}\nLink / location: {{interview.link}}\n\nPlease reply to confirm that the time works for you.' + SIGN, ['Job description']),
  T('tpl-resched', 'Interview rescheduled', 'Interview', 'Interview rescheduled: {{job.title}}', 'Hi {{candidate.firstName}},\n\nYour {{interview.round}} for the {{job.title}} role has been moved.\n\nNew date: {{interview.date}}\nNew time: {{interview.time}}\nFormat: {{interview.mode}}\nLink / location: {{interview.link}}\n\nSorry for the change, and please let us know if the new time does not work.' + SIGN),
  T('tpl-reminder', 'Interview reminder', 'Interview', 'Reminder: your interview for {{job.title}}', 'Hi {{candidate.firstName}},\n\nA quick reminder of your {{interview.round}} on {{interview.date}} at {{interview.time}} ({{interview.mode}}).\nLink / location: {{interview.link}}' + SIGN),
  T('tpl-assignment', 'Assignment / test', 'Screening', 'Next step for {{job.title}}: short assessment', 'Hi {{candidate.firstName}},\n\nAs the next step for the {{job.title}} role, please complete the short assessment attached. Send it back to us within 3 working days.' + SIGN),
  T('tpl-reject', 'Rejection (polite)', 'Rejection', 'Your application for {{job.title}}', 'Hi {{candidate.firstName}},\n\nThank you for the time you spent with us for the {{job.title}} role. After careful consideration we have decided not to move forward with your application at this time.\n\nWe will keep your details on file and will get in touch if a suitable role opens up. We wish you every success.' + SIGN),
  T('tpl-discuss', 'Offer discussion', 'Offer', 'Next steps for the {{job.title}} role', 'Hi {{candidate.firstName}},\n\nWe enjoyed meeting you and would like to move to the offer stage for the {{job.title}} role. We will share the details of the package shortly.' + SIGN),
  T('tpl-offer', 'Offer letter', 'Offer', 'Your offer: {{job.title}} at {{company.name}}', 'Hi {{candidate.firstName}},\n\nWe are delighted to offer you the {{job.title}} role in {{job.department}}. The proposed joining date is {{offer.joiningDate}} and the offer is valid until {{offer.expiryDate}}.\n\nPlease open the link below to read your offer letter and download a copy. Once you have downloaded it you can accept or decline the offer on the same page.\n\n{{offer.link}}\n\nPlease respond before the offer expires.' + SIGN),
  T('tpl-offer-rem', 'Offer reminder', 'Offer', 'Reminder: your offer for {{job.title}} expires on {{offer.expiryDate}}', 'Hi {{candidate.firstName}},\n\nJust a reminder that your offer for the {{job.title}} role is valid until {{offer.expiryDate}}. Please read the letter and give us your decision here:\n\n{{offer.link}}\n\nLet us know if you have any questions.' + SIGN),
  T('tpl-joining', 'Joining form', 'Onboarding', 'Welcome to {{company.name}}: please complete your joining details', 'Hi {{candidate.firstName}},\n\nWelcome to {{company.name}}! We are looking forward to you joining us as {{job.title}} on {{offer.joiningDate}}.\n\nBefore your first day, please fill in your joining details using the private link below. It takes about 10 minutes, your answers are saved as you type, and you can come back to the same link.\n\n{{onboarding.link}}\n\nPlease have these ready:\n{{onboarding.documents}}\n\nPlease complete it by {{onboarding.dueDate}}. If you have any trouble, reply to this email.\n\nKind regards,\n{{recruiter.name}}\n{{company.name}} · HR'),
  T('tpl-welcome', 'Welcome / pre-joining documents', 'Onboarding', 'Welcome to {{company.name}}', 'Hi {{candidate.firstName}},\n\nWelcome to {{company.name}}! We are looking forward to you joining us on {{offer.joiningDate}}.\n\nTo get you set up, please send us the documents on the attached checklist before your first day.' + SIGN, ['Pre-joining documents checklist']),
];

const rule = (key: RuleKey, templateId: string, mode: RuleMode): StageRule => ({ key, templateId, mode });

export const DEFAULT_RULES: StageRule[] = [
  rule('Applied', 'tpl-received', 'auto'),
  rule('Screening', 'tpl-shortlisted', 'ask'),
  rule('Technical Interview', 'tpl-interview', 'ask'),
  rule('HR Interview', 'tpl-interview', 'ask'),
  rule('Offer', 'tpl-discuss', 'ask'),
  rule('Offer sent', 'tpl-offer', 'ask'),
  rule('Hired', 'tpl-welcome', 'auto'),
  rule('Rejected', 'tpl-reject', 'ask'),
  rule('Interview scheduled', 'tpl-interview', 'ask'),
  rule('Interview rescheduled', 'tpl-resched', 'ask'),
];

export const DEFAULT_SETTINGS: MailSettings = {
  fromName: `${ENTITY_NAME} Careers`,
  fromAddress: 'careers@globalsurf.ae',
  signature: '',
  outlook: { connected: false, tenant: '', mailbox: 'careers@globalsurf.ae' },
  teams: { connected: false, createLinks: true },
};

const seedMail = (): MailState => ({ templates: structuredClone(DEFAULT_TEMPLATES), rules: structuredClone(DEFAULT_RULES), messages: [], settings: structuredClone(DEFAULT_SETTINGS) });

/* ---------------------------------------------------------------------- store */

const KEY = 'gsit.hiring.mail.v1';
const SERVER: MailState = seedMail();
let state: MailState = SERVER;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Partial<MailState>;
    // Templates and rules added in a later release are filled in rather than lost.
    // A stored copy of a built-in template that was never edited follows the new default (offer emails now carry the link).
    const templates = (p.templates ?? SERVER.templates).map((t) => {
      const d = DEFAULT_TEMPLATES.find((x) => x.id === t.id);
      return d && t.system && !t.updatedAt && t.body !== d.body ? { ...d } : t;
    });
    DEFAULT_TEMPLATES.forEach((d) => {
      if (!templates.some((t) => t.id === d.id)) templates.push({ ...d });
    });
    const rules = RULE_KEYS.map((k) => p.rules?.find((r) => r.key === k) ?? DEFAULT_RULES.find((r) => r.key === k)!);
    state = { templates, rules, messages: p.messages ?? [], settings: { ...DEFAULT_SETTINGS, ...p.settings, outlook: { ...DEFAULT_SETTINGS.outlook, ...p.settings?.outlook }, teams: { ...DEFAULT_SETTINGS.teams, ...p.settings?.teams } } };
  } catch {
    /* unreadable: keep the defaults */
  }
}

function commit(next: MailState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function useHiringMail(): MailState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      load();
      return state;
    },
    () => SERVER,
  );
}

export function getMail(): MailState {
  load();
  return state;
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const nowIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

/* ---------------------------------------------------------------------- templates */

export interface TemplateInput {
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  location: string;
  attachments: string[];
}

export function saveTemplate(id: string | null, input: TemplateInput, by: string): EmailTemplate {
  const stamp = nowIso();
  if (id) {
    const next = state.templates.map((t) => (t.id === id ? { ...t, ...input, updatedAt: stamp, updatedBy: by } : t));
    commit({ ...state, templates: next });
    logAudit({ employeeId: `hiring:${id}`, field: 'Email template edited', to: input.name, changedBy: by, module: 'Hiring' });
    return next.find((t) => t.id === id)!;
  }
  const t: EmailTemplate = { id: uid('tpl'), ...input, system: false, updatedAt: stamp, updatedBy: by };
  commit({ ...state, templates: [...state.templates, t] });
  logAudit({ employeeId: `hiring:${t.id}`, field: 'Email template created', to: t.name, changedBy: by, module: 'Hiring' });
  return t;
}

export function deleteTemplate(id: string, by: string): { ok: boolean; error?: string } {
  const t = state.templates.find((x) => x.id === id);
  if (!t) return { ok: false, error: 'Template not found.' };
  if (t.system) return { ok: false, error: 'Built-in templates can be edited but not deleted.' };
  const used = state.rules.filter((r) => r.templateId === id && r.mode !== 'off');
  if (used.length) return { ok: false, error: `It is used by: ${used.map((r) => r.key).join(', ')}. Choose another template there first.` };
  commit({ ...state, templates: state.templates.filter((x) => x.id !== id), rules: state.rules.map((r) => (r.templateId === id ? { ...r, templateId: '', mode: 'off' } : r)) });
  logAudit({ employeeId: `hiring:${id}`, field: 'Email template deleted', to: t.name, changedBy: by, module: 'Hiring' });
  return { ok: true };
}

export function resetTemplate(id: string, by: string) {
  const d = DEFAULT_TEMPLATES.find((t) => t.id === id);
  if (!d) return;
  commit({ ...state, templates: state.templates.map((t) => (t.id === id ? { ...d, updatedAt: nowIso(), updatedBy: by } : t)) });
}

export function setRule(key: RuleKey, patch: Partial<Pick<StageRule, 'templateId' | 'mode'>>, by: string) {
  const before = state.rules.find((r) => r.key === key);
  commit({ ...state, rules: state.rules.map((r) => (r.key === key ? { ...r, ...patch } : r)) });
  logAudit({ employeeId: `hiring:rule-${key}`, field: 'Stage email rule', from: before ? `${before.mode}` : undefined, to: `${patch.mode ?? before?.mode}${patch.templateId ? ` · ${patch.templateId}` : ''}`, changedBy: by, module: 'Hiring' });
}

export function saveSettings(patch: Partial<MailSettings>, by: string, what: string) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
  logAudit({ employeeId: 'hiring:mail-settings', field: what, to: 'Updated', changedBy: by, module: 'Hiring' });
}

/* ---------------------------------------------------------------------- merge and send */

export interface MailContext {
  candidateId: string;
  applicationId?: string;
  interview?: Interview;
  offer?: Offer;
  recruiter: string;
  /** Extra field values for this message (for example the joining form link). */
  extra?: Record<string, string>;
}

const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** Values for the merge fields. A field with no value is left out, so the preview can flag it. */
export function mergeValues(s: HiringState, ctx: MailContext): Record<string, string> {
  const c = candById(s, ctx.candidateId);
  const app = ctx.applicationId ? appById(s, ctx.applicationId) : undefined;
  const job = app ? jobById(s, app.jobId) : undefined;
  const iv = ctx.interview ?? (app ? s.interviews.filter((i) => i.applicationId === app.id && i.status === 'Scheduled').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0] : undefined);
  const offer = ctx.offer ?? (app ? s.offers.find((o) => o.applicationId === app.id && o.status !== 'Revoked') : undefined);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const v: Record<string, string> = { 'recruiter.name': ctx.recruiter, 'company.name': ENTITY_NAME };
  if (c) {
    v['candidate.fullName'] = c.name;
    v['candidate.firstName'] = c.name.split(/\s+/)[0];
  }
  if (job) {
    // The company named in the email is the one issuing the offer (UAE offers can come from any of the group companies).
    const co = COMPANIES.find((x) => x.id === (offer?.companyId ?? job.companyId));
    if (co && co.id !== 'co-1') v['company.name'] = co.name;
    v['job.title'] = job.title;
    v['job.location'] = job.location === 'Kochi' ? 'Kochi, India' : 'Dubai, UAE';
    v['job.department'] = job.department;
    v['portal.link'] = `${origin}/careers/${job.code}`;
  }
  if (iv) {
    v['interview.round'] = iv.round;
    v['interview.date'] = fmt(iv.date);
    v['interview.time'] = iv.time;
    v['interview.mode'] = iv.mode;
    if (iv.link) v['interview.link'] = iv.link;
    else if (iv.mode === 'In-person') v['interview.link'] = 'Our office (we will share the directions)';
  }
  if (offer) {
    v['offer.joiningDate'] = fmt(offer.joiningDate);
    v['offer.expiryDate'] = fmt(offer.expiryDate);
    if (offer.token) v['offer.link'] = `${origin}/offer/respond/${offer.token}`;
  }
  return { ...v, ...ctx.extra };
}

/** Fills the {{fields}} it has values for; the rest stay as they are and are listed in `missing`. */
export function renderText(text: string, values: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const out = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => {
    if (values[key] !== undefined && values[key] !== '') return values[key];
    missing.add(key);
    return `{{${key}}}`;
  });
  return { text: out, missing: [...missing] };
}

export const sampleValues = (): Record<string, string> => Object.fromEntries(MERGE_FIELDS.map((f) => [f.key, f.sample]));

export interface Prepared {
  template: EmailTemplate;
  to: string;
  subject: string;
  body: string;
  missing: string[];
  attachments: string[];
}

/** The email a template would send to a candidate right now. */
export function prepareMail(templateId: string, ctx: MailContext): Prepared | null {
  const m = getMail();
  const t = m.templates.find((x) => x.id === templateId);
  const s = getHiring();
  const c = candById(s, ctx.candidateId);
  if (!t || !c) return null;
  const values = mergeValues(s, ctx);
  const subject = renderText(t.subject, values);
  const sig = m.settings.signature.trim() ? `\n\n${m.settings.signature.trim()}` : '';
  const body = renderText(t.body + sig, values);
  return { template: t, to: c.email, subject: subject.text, body: body.text, missing: [...new Set([...subject.missing, ...body.missing])], attachments: t.attachments };
}

export const RULE_FOR_STAGE = (key: string): RuleKey | null => ((RULE_KEYS as readonly string[]).includes(key) ? (key as RuleKey) : null);

export interface SendInput {
  candidateId: string;
  applicationId?: string;
  templateName?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  by: string;
  trigger: string;
}

/** "Sends" a message. In sandbox mode (the only mode until a server exists) it is written to the log and nothing
    is delivered. A Microsoft Graph or SMTP provider replaces the body of this function. */
export function sendMail(input: SendInput): MailMessage {
  const st = state.settings;
  const msg: MailMessage = {
    id: uid('mail'),
    candidateId: input.candidateId,
    applicationId: input.applicationId,
    templateName: input.templateName,
    to: input.to,
    cc: input.cc ?? '',
    bcc: input.bcc ?? '',
    subject: input.subject,
    body: input.body,
    from: `${st.fromName} <${st.outlook.connected ? st.outlook.mailbox || st.fromAddress : st.fromAddress}>`,
    status: 'Sent',
    provider: st.outlook.connected ? 'Microsoft 365 (sandbox: not delivered)' : 'Sandbox (not delivered)',
    at: nowIso(),
    by: input.by,
    trigger: input.trigger,
  };
  commit({ ...state, messages: [msg, ...state.messages] });
  logAudit({ employeeId: `hiring:${msg.id}`, field: 'Email sent', to: `${msg.subject} → ${msg.to}`, changedBy: input.by, module: 'Hiring' });
  return msg;
}

/** Sends the template a rule points at, without asking. Used where nobody is at a screen to confirm (a candidate
    applying on the careers page, onboarding starting). Returns whether a message was logged. */
export function sendRuleMail(key: RuleKey, applicationId: string, by: string, opts: { includeAsk?: boolean; offer?: Offer; interview?: Interview } = {}): boolean {
  const rule = state.rules.find((r) => r.key === key);
  if (!rule?.templateId || rule.mode === 'off' || (rule.mode === 'ask' && !opts.includeAsk)) return false;
  const a = appById(getHiring(), applicationId);
  if (!a) return false;
  const p = prepareMail(rule.templateId, { candidateId: a.candidateId, applicationId, offer: opts.offer, interview: opts.interview, recruiter: by });
  if (!p || p.missing.length) return false;
  sendMail({ candidateId: a.candidateId, applicationId, templateName: p.template.name, to: p.to, subject: p.subject, body: p.body, by, trigger: key });
  return true;
}

export const messagesFor = (m: MailState, candidateId: string) => m.messages.filter((x) => x.candidateId === candidateId);

export const recruiterName = (id: string) => EMPLOYEES.find((e) => e.id === id)?.name ?? id;

/* ---------------------------------------------------------------------- integrations (sandbox) */

export function connectOutlook(tenant: string, mailbox: string, by: string) {
  saveSettings({ outlook: { connected: true, tenant: tenant.trim(), mailbox: mailbox.trim(), connectedAt: nowIso(), by } }, by, 'Outlook connected');
}
export function disconnectOutlook(by: string) {
  const s = state.settings;
  saveSettings({ outlook: { ...s.outlook, connected: false, connectedAt: undefined, by: undefined }, teams: { ...s.teams, connected: false, connectedAt: undefined, by: undefined } }, by, 'Outlook disconnected');
}
export function connectTeams(createLinks: boolean, by: string) {
  saveSettings({ teams: { connected: true, createLinks, connectedAt: nowIso(), by } }, by, 'Teams connected');
}
export function disconnectTeams(by: string) {
  saveSettings({ teams: { ...state.settings.teams, connected: false, connectedAt: undefined, by: undefined } }, by, 'Teams disconnected');
}

/** A placeholder meeting link used while Teams is only connected in sandbox mode. */
export const sandboxTeamsLink = () => `https://teams.microsoft.com/l/meetup-join/sandbox-${Math.random().toString(36).slice(2, 10)}`;
