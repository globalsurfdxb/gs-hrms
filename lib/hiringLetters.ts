import { useSyncExternalStore } from 'react';
import { logAudit } from '@/lib/employeeStore';
import { ENTITY_NAME, legalEntityFor } from '@/lib/org';
import { employeeById } from '@/lib/data';
import { GS_LOGO } from '@/lib/brandAssets';
import { candById, appById, jobById, offerById } from '@/lib/hiringStore';
import { HiringState, Offer } from '@/lib/hiringTypes';

/* Offer letters. HR keeps one letter template per location; an uploaded Word, HTML or text
   file replaces the built-in one. "Prepare" merges the template with an offer and keeps that exact version on the offer,
   so the candidate reads what was sent even if the template changes later. The candidate downloads it as a PDF. */

export const LETTER_FIELDS: { key: string; label: string; sample: string; html?: boolean }[] = [
  { key: 'candidate.fullName', label: 'Candidate full name', sample: 'Hamza Farouk' },
  { key: 'candidate.firstName', label: 'Candidate first name', sample: 'Hamza' },
  { key: 'job.title', label: 'Job title', sample: 'Network Engineer' },
  { key: 'job.department', label: 'Department', sample: 'Network Engineering' },
  { key: 'job.location', label: 'Work location', sample: 'Dubai, United Arab Emirates' },
  { key: 'job.employmentType', label: 'Employment type', sample: 'Full-time' },
  { key: 'job.responsibilities', label: 'Job responsibilities (bullet list)', sample: '[list]', html: true },
  { key: 'manager.name', label: 'Reporting manager', sample: 'Harsha' },
  { key: 'offer.reference', label: 'Offer reference', sample: 'OFF-0003' },
  { key: 'offer.joiningDate', label: 'Joining date', sample: '11 November 2026' },
  { key: 'offer.probation', label: 'Probation period', sample: '6 months' },
  { key: 'offer.expiryDate', label: 'Offer valid until', sample: '19 October 2026' },
  { key: 'offer.currency', label: 'Currency', sample: 'AED' },
  { key: 'offer.total', label: 'Total package', sample: '13,000' },
  { key: 'offer.monthlyCtc', label: 'Monthly cost to company', sample: 'INR 85,000.00' },
  { key: 'offer.payUnit', label: 'Per month / per year', sample: 'per month' },
  { key: 'offer.salaryTable', label: 'Salary breakdown (table)', sample: '[salary table]', html: true },
  { key: 'company.name', label: 'Company name', sample: ENTITY_NAME },
  { key: 'company.entity', label: 'Legal entity', sample: 'Global Surf IT LLC' },
  { key: 'letter.date', label: 'Letter date', sample: '12 October 2026' },
  { key: 'letter.dateShort', label: 'Letter date (dd/mm/yyyy)', sample: '12/10/2026' },
  { key: 'recruiter.name', label: 'Recruiter name', sample: 'Aslima' },
  { key: 'signatory.name', label: 'Signatory name', sample: 'Shilpa Viswanath' },
  { key: 'signatory.title', label: 'Signatory title', sample: 'HR Coordinator' },
];

export interface LetterSlot {
  html: string;
  source: 'upload' | 'edited';
  fileName?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface LetterState {
  /** One template per work location (the id of a location). A missing slot means the built-in letter. */
  slots: Record<string, LetterSlot | undefined>;
  /** Who signs the letter, per work location (the id of a location). */
  signatories: Record<string, Signatory>;
}

export interface Signatory {
  name: string;
  title: string;
}

export const SIGNATORY_DEFAULTS: Record<string, Signatory> = {
  Dubai: { name: 'Muneer', title: 'General Manager' },
  Kochi: { name: 'Shilpa Viswanath', title: 'HR Coordinator' },
};

/** The signatory for a location, falling back to the UAE one for any other site. */
export const signatoryFor = (s: Pick<LetterState, 'signatories'>, location: string): Signatory => s.signatories[location] ?? SIGNATORY_DEFAULTS[location] ?? s.signatories.Dubai ?? SIGNATORY_DEFAULTS.Dubai;

/* ---------------------------------------------------------------------- the built-in letters */

/** Everywhere except India. */
export const DEFAULT_LETTER_HTML = `<p style="text-align:right">{{letter.date}}</p>
<p><strong>{{company.entity}}</strong><br>Strictly private and confidential</p>
<p>Dear {{candidate.firstName}},</p>
<h2>Offer of employment: {{job.title}}</h2>
<p>Reference: {{offer.reference}}</p>
<p>We are delighted to offer you the position of <strong>{{job.title}}</strong> in the <strong>{{job.department}}</strong> department at {{company.name}}, based in {{job.location}}. You will report to {{manager.name}}. This is a {{job.employmentType}} role.</p>
<h3>Start date and probation</h3>
<p>Your employment will begin on <strong>{{offer.joiningDate}}</strong>, subject to the completion of the pre-joining formalities. The first {{offer.probation}} of your employment will be a probation period.</p>
<h3>Compensation</h3>
<p>Your package is <strong>{{offer.currency}} {{offer.total}} {{offer.payUnit}}</strong>, made up as follows:</p>
{{offer.salaryTable}}
<h3>Terms</h3>
<p>This offer is subject to satisfactory references, verification of your documents and the applicable labour law. Your full terms of employment will be set out in your employment contract.</p>
<p>This offer is valid until <strong>{{offer.expiryDate}}</strong>. To accept it, please open the link in the email we sent you, read this letter and respond there.</p>
<p>We look forward to welcoming you to the team.</p>
<p>Yours sincerely,</p>
<p><br><strong>{{signatory.name}}</strong><br>{{signatory.title}}<br>{{company.entity}}</p>`;

/** The Kochi (India) letter of employment, from the "Offer Letter Template" PDF supplied by HR. */
export const INDIA_LETTER_HTML = `<p>Date: {{letter.dateShort}}</p>
<h1 class="c">LETTER OF EMPLOYMENT</h1>
<p><strong>{{candidate.fullName}}</strong></p>
<p>We are delighted to welcome you to Global Surf IT Private Limited, a leading IT company renowned for delivering exceptional IT and digital experiences in Dubai, supported by our dedicated team in Cochin, India.</p>
<p>We are confident that, in the role of {{job.title}}, you will make a valuable contribution to our {{job.department}} team and to the experience we deliver to our customers.</p>
<p>Please find enclosed your formal employment letter along with all relevant details for your reference.</p>
<h3>COMMENCEMENT OF EMPLOYMENT</h3>
<p>Your employment is effective from <strong>{{offer.joiningDate}}</strong>.</p>
<h3>JOB TITLE</h3>
<p>Your title will be <strong>{{job.title}}</strong>, and you will report to {{manager.name}}.</p>
<h3>JOB ROLES &amp; RESPONSIBILITIES</h3>
{{job.responsibilities}}
<h3 class="pb">REMUNERATION</h3>
<p>Your Monthly CTC will be <strong>{{offer.monthlyCtc}}</strong>. Please refer to the salary breakup provided below.</p>
{{offer.salaryTable}}
<h3>POINTS TO NOTE IN SALARY BREAKUP</h3>
<ul>
<li>Under the new tax regime for FY 2026-27, no tax deduction at source (TDS) is required on your current salary.</li>
<li>Professional Tax will be deducted in accordance with the norms prescribed by the Government of Kerala.</li>
<li>Gratuity is a statutory benefit payable by the company in accordance with the Payment of Gratuity Act, 1972. This amount is included in the CTC for disclosure purposes and will be settled at the time of relieving, subject to fulfilment of the eligibility requirements under the Act during the tenure of employment.</li>
<li>The given salary structure is subject to revision from time to time based on statutory deductions governed by prevailing laws and Government notifications, as well as any employee benefits or entitlements introduced, amended, or withdrawn by the Company in accordance with prevailing Company policies and applicable eligibility criteria.</li>
</ul>
<h3>LEAVE POLICY</h3>
<p><strong>Earned Leave</strong><br>You are entitled to Earned Leave after probation. You are eligible for one earned leave per month only after completion of 22 working days. Three days advance intimation is required to be given for availing Earned Leave.</p>
<p><strong>Public Holiday</strong><br>You will be governed by the Cochin (Kerala) office public holiday calendar. However, as your role is operationally aligned with the Dubai office as well, the following shall apply:</p>
<ul>
<li>Public holidays observed by the Cochin office will be treated as normal holidays.</li>
<li>If you are required to work on a Cochin office public holiday due to Dubai office requirements, you will be eligible for a Compensatory Leave (Comp Off).</li>
<li>However, you will not be assigned to work on public holidays under the Cochin office calendar that are relevant to your culture and beliefs.</li>
<li>Dubai office public holidays shall be treated as normal working days in line with the Cochin office calendar.</li>
<li>If a Dubai office public holiday is availed with prior approval, it will be adjusted against a future Cochin office public holiday or any existing leave balances.</li>
</ul>
<p><strong>Sick Leave</strong><br>You are entitled to sick leave of 10 days per year. In the event of more than one sick leave, you will be required to furnish a doctor’s sick leave certificate for the period of leave.</p>
<p><strong>Unauthorized Absence</strong><br>Unauthorized absence or absence without permission from duty for a continuous period of 7 days would make you lose your lien on employment. In such case your employment shall automatically come to an end without any notice of termination or notice pay.</p>
<h3>WORKING HOURS</h3>
<p><strong>Remote Work Mode:</strong> Working days will be from Monday to Friday, with working hours from 10:00AM to 7:30PM, inclusive of a total break time of 1.5 hours.</p>
<p><strong>Onsite (Office) Mode:</strong> Working days will be from Monday to Friday. You are required to complete 8 working hours per day, exclusive of break hours. Your working hours will be aligned with the UAE office peak time from 8:30 AM GST to 5:30 PM GST.</p>
<p>Irrespective of the flexibility in working hours, you are required to be available during peak working hours, as per team requirements.</p>
<h3>PROTECTIVE COVENANTS</h3>
<p>As part of your employment with the Company, you agree to the following conditions:</p>
<p><strong>CONFIDENTIALITY</strong><br>You acknowledge that during your employment, you may have access to confidential and proprietary information relating to the Company, its clients, partners, financial data, systems, processes, and business operations. You agree to maintain strict confidentiality of such information and shall not disclose, copy, or use it for any purpose other than the performance of your duties. This obligation shall continue during employment and for a period of two (2) years after separation, except for trade secrets, which shall remain protected as per applicable law.</p>
<p><strong>NON-SOLICITATION</strong><br>For a period of one (1) year following separation from employment, you shall not solicit Company employees or clients for personal or third-party benefit.</p>
<p>Detailed terms governing the above obligations shall be set out in the Employment Agreement and Company policies, which you will be required to sign upon joining.</p>
<h3>TRANSFER</h3>
<p>You could be transferred to any of other office/branch/subsidiary/affiliates either domestic or abroad, should the need arise, based on the willingness of both the parties. You will abide by company’s rules and regulations as may be in effect from time to time with respect to your function, grade or location where you work in.</p>
<h3>INTELLECTUAL PROPERTY</h3>
<p>Any work product, inventions, improvements, methods, processes, or materials developed by you during the course of your employment and in connection with the Company’s business shall be the sole property of the Company.</p>
<h3>CODE OF CONDUCT</h3>
<p>Global Surf IT Private Limited has a Code of Conduct, primarily to address workplace behavior, ethics, professional standards, confidentiality and protection of company information, non-compete clauses and conflict of interest, ethical handling of clients, colleagues, and company property. You will be requested to sign your acceptance and adhere to these norms once you join the company.</p>
<h3>STANDING ORDERS</h3>
<p>The Company has established operational rules, policies, and procedures that are applicable to all employees. By joining the Company, you agree to comply fully with these Standing Orders, as well as with any rules, regulations, and services currently in force or which may be issued, amended, or introduced from time to time by the Company. Non-compliance with these Standing Orders may result in disciplinary action as per the Company’s policies.</p>
<h3>PROBATIONARY PERIOD</h3>
<p>Your employment is subject to a probationary period for {{offer.probation}} from Date of Joining. After successful completion of the probation period, your performance will be reviewed, and your probation may be either extended, or your employment will be confirmed.</p>
<h3>GOVERNING LAW/JURISDICTION</h3>
<p>Your employment with the Company is subject to Indian laws. All disputes shall be subject to the jurisdiction of High Court of Kerala at Ernakulam, Kerala only.</p>
<h3>NOTICE PERIOD</h3>
<p>During the probation period, the Company may terminate your employment by giving a notice of Seven (7) days or salary in lieu thereof and any termination initiated from the employee will require up to 45 days' notice period during probation period.</p>
<p>In the event that the employee decides to leave the company after successful completion of probation period, the employee will have to serve notice period up to 60 days.</p>
<h3>TERMINATION</h3>
<p>It must be specifically understood that this offer is made based on your proficiency in technical/ professional skills you have declared to possess as per your application for employment and your ability to handle any assignments/jobs independently.</p>
<p>In case the employee's performance falls short of the minimum standard set by the company after completion of probation period, the company shall have the right to terminate your employment by giving a notice of 30 days or salary in lieu thereof.</p>
<h3>DOCUMENT REQUIREMENTS FOR JOINING</h3>
<p>You are required to submit the following documents on the date of your joining:</p>
<ul>
<li>Education certificate [10th Standard &amp; Degree/equivalent]</li>
<li>Experience / Service certificate from all previous employers</li>
<li>Pay slips for the last three months from your previous employment.</li>
<li>Passport size photograph</li>
<li>Copy of PAN Card &amp; Aadhaar Card</li>
<li>Bank account details [Passbook]</li>
<li>Emergency contact numbers.</li>
</ul>
<h3 class="pb">ACKNOWLEDGEMENT</h3>
<p>We are confident that, through your dedication and professionalism, you will achieve significant professional and financial growth with Global Surf IT Private Limited. Your expected joining date is {{offer.joiningDate}}. Please confirm your acceptance by {{offer.expiryDate}}. Please note that this offer will be considered void if not accepted within the specified time frame.</p>
<p>Yours sincerely<br>For Global Surf IT Private Limited</p>
<p><br><br>Company Seal and Sign<br><strong>{{signatory.name}}</strong><br>{{signatory.title}}</p>
<h3>ACCEPTANCE OF EMPLOYMENT LETTER</h3>
<p>I, {{candidate.fullName}}, agree to accept the employment on the terms and conditions mentioned in this appointment letter and the annexure.</p>
<p>I hope to join Global Surf IT Private Limited on {{offer.joiningDate}}.</p>`;

/** The built-in letter for a location. */
export const builtinFor = (location: string) => (location === 'Kochi' ? INDIA_LETTER_HTML : DEFAULT_LETTER_HTML);

/* ---------------------------------------------------------------------- letterhead and page */

/** Logo on top and address on the bottom of every page, per location. */
export function letterhead(location?: string): { head: string; foot: string } {
  const head = `<div class="lh-head"><img src="${GS_LOGO}" alt="${escapeHtml(ENTITY_NAME)}"></div>`;
  const foot =
    location === 'Kochi'
      ? `<div class="lh-foot"><div>Global Surf IT Private Limited<br>Trans Asia Cyberpark, Infopark Phase 2, 10G, Tower 2<br>Kakkanad, Cochin- 682303</div><div><b>T:</b> 8075490551<br><b>E:</b> hr@globalsurf.ae</div></div>`
      : `<div class="lh-foot"><div>${escapeHtml(legalEntityFor(location ?? ''))}</div></div>`;
  return { head, foot };
}

const CSS = `body{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:10.5pt;line-height:1.6;color:#1d2433;margin:0;background:#fff}
.lh-head{padding:26px 8% 10px}.lh-head img{height:46px;display:block}
.lh-body{padding:6px 8% 10px}
.lh-foot{display:flex;justify-content:space-between;gap:24px;margin:18px 8% 0;padding:10px 0 22px;border-top:1px solid #d9dde6;font-size:8pt;line-height:1.6;color:#2b3345}
h1,h2{font-size:14pt;margin:14px 0 8px}h1.c{text-align:center;font-size:13pt}h3{font-size:10.5pt;margin:16px 0 4px;font-weight:700}
p{margin:0 0 9px;text-align:justify}ul{margin:0 0 10px;padding-left:22px}li{margin:0 0 5px;text-align:justify}
table{border-collapse:collapse;width:100%;margin:6px 0 12px;font-size:10pt}th,td{border:1px solid #c9d0e0;padding:5px 9px;text-align:left}th{background:#f2f5fb}
td.n,th.n{text-align:right}tr.t td{font-weight:700;background:#f7f9fd}
table.ctc th,table.ctc td{border:1px solid #000;padding:4px 7px}table.ctc th{background:#fff}table.ctc td.sec{text-align:center;font-weight:700}
table.ctc td.e{background:#dce6f5}table.ctc td.d{background:#fde4d6}table.ctc td.c{background:#cfe3c2}table.ctc tr.b td{font-weight:700}
img{max-width:100%}`;

/** A standalone page: a style sheet around whatever markup is given. */
export function shell(inner: string, title = 'Offer letter'): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${CSS}</style></head><body>${inner}</body></html>`;
}

/** A letter as the reader sees it: letterhead, body and footer. */
export function fullDocument(body: string, title = 'Offer letter', location?: string): string {
  const { head, foot } = letterhead(location);
  return shell(`${head}<div class="lh-body">${body}</div>${foot}`, title);
}

/* ---------------------------------------------------------------------- merging */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

const longDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
const money = (n: number) => n.toLocaleString('en-US');
const inr = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Kerala professional tax for a half-year of gross salary, spread over six months. */
function keralaPtMonthly(monthlyGross: number): number {
  const half = monthlyGross * 6;
  const slabs: [number, number][] = [[125000, 1250], [100000, 1000], [75000, 750], [60000, 600], [45000, 450], [30000, 300], [18000, 180], [12000, 120]];
  const tax = slabs.find(([from]) => half >= from)?.[1] ?? 0;
  return tax / 6;
}

/** The India salary breakup. The offer lines are the yearly gross components; the rest is worked out from them:
    EPF at 12% of Basic up to the statutory wage ceiling (INR 1,800 a month), Kerala professional tax by half-yearly
    slab, no TDS under the new regime, employer PF equal to the employee share, gratuity at 15/26 of a month's Basic. */
export function indiaBreakup(offer: Pick<Offer, 'lines'>, name: string, designation: string): { html: string; monthlyCtc: number } {
  const amt = (...labels: string[]) => offer.lines.filter((l) => labels.includes(l.label)).reduce((n, l) => n + (l.amount > 0 ? l.amount : 0), 0);
  const basic = amt('Basic') / 12;
  const hra = amt('House Rent Allowance') / 12;
  const other = amt('Special Allowance', 'Other Allowance') / 12;
  const gross = basic + hra + other;
  const epf = Math.min(basic * 0.12, 1800);
  const pt = keralaPtMonthly(gross);
  const takeHome = gross - epf - pt;
  const gratuity = (basic * 15) / 26 / 12;
  const ctcEx = gross + epf;
  const ctc = ctcEx + gratuity;
  const e = escapeHtml;
  const row = (label: string, m: number | string, bold = false) => `<tr${bold ? ' class="b"' : ''}><td>${label}</td><td class="n">${typeof m === 'number' ? inr(m) : m}</td><td class="n">${typeof m === 'number' ? inr(m * 12) : m}</td></tr>`;
  const html = `<table class="ctc keep"><tbody>
<tr><td style="width:40%">Name</td><td colspan="2">${e(name)}</td></tr>
<tr><td>Designation</td><td colspan="2">${e(designation)}</td></tr>
<tr class="b"><td>Components</td><td class="n">Monthly (INR)</td><td class="n">Annual (INR)</td></tr>
<tr><td colspan="3" class="sec e">EARNINGS / GROSS SALARY</td></tr>
${row('Basic', basic)}${row('HRA', hra)}${row('Other Allowance', other)}${row('Gross Salary', gross, true)}
<tr><td colspan="3" class="sec d">EMPLOYEE STATUTORY DEDUCTIONS</td></tr>
${row('Employee Provident Fund (EPF)', epf)}${row('Professional Tax', pt)}${row('Income Tax / TDS', 'Nil')}${row('Indicative Take-Home Salary (before PT/TDS and other applicable deductions)', takeHome, true)}
<tr><td colspan="3" class="sec c">CTC COMPONENTS</td></tr>
${row('Gross Salary', gross)}${row('Employer PF Contribution', epf)}${row('CTC excluding Gratuity', ctcEx, true)}${row('Gratuity', gratuity)}${row('TOTAL COST TO COMPANY (CTC)', ctc, true)}
</tbody></table>`;
  return { html, monthlyCtc: ctc };
}

export interface LetterContext {
  offer: Pick<Offer, 'code' | 'joiningDate' | 'probationMonths' | 'expiryDate' | 'currency' | 'total' | 'lines'>;
  candidate: string;
  job: { title: string; department: string; location: string; employmentType: string; description: string };
  manager?: string;
}

/** Values (already safe to put in HTML) for each letter field. */
export function valuesFromContext(c: LetterContext, signatory: { name: string; title: string }, recruiter: string): Record<string, string> {
  const e = escapeHtml;
  const o = c.offer;
  const india = o.currency === 'INR';
  const unit = india ? 'per year' : 'per month';
  const rows = o.lines.filter((l) => l.amount > 0).map((l) => `<tr><td>${e(l.label)}</td><td class="n">${e(o.currency)} ${money(l.amount)}</td></tr>`).join('');
  const breakup = india ? indiaBreakup(o, c.candidate, c.job.title) : null;
  const bullets = c.job.description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const now = new Date().toISOString();
  const v: Record<string, string> = {
    'candidate.fullName': e(c.candidate),
    'candidate.firstName': e(c.candidate.split(/\s+/)[0]),
    'job.title': e(c.job.title),
    'job.department': e(c.job.department),
    'job.location': e(c.job.location === 'Kochi' ? 'Kochi, India' : 'Dubai, United Arab Emirates'),
    'job.employmentType': e(c.job.employmentType),
    'job.responsibilities': bullets.length ? `<ul>${bullets.map((b) => `<li>${e(b)}</li>`).join('')}</ul>` : '<p>Your detailed responsibilities will be shared by your reporting manager.</p>',
    'company.entity': e(legalEntityFor(c.job.location)),
    'offer.reference': e(o.code),
    'offer.joiningDate': e(longDate(o.joiningDate)),
    'offer.probation': e(o.probationMonths ? `${o.probationMonths} month${o.probationMonths === 1 ? '' : 's'}` : 'no probation'),
    'offer.expiryDate': e(longDate(o.expiryDate)),
    'offer.currency': e(o.currency),
    'offer.total': e(money(o.total)),
    'offer.payUnit': e(unit),
    'offer.salaryTable': breakup ? breakup.html : `<table><thead><tr><th>Component</th><th class="n">Amount (${e(unit)})</th></tr></thead><tbody>${rows}<tr class="t"><td>Total</td><td class="n">${e(o.currency)} ${money(o.total)}</td></tr></tbody></table>`,
    'offer.monthlyCtc': e(breakup ? `${o.currency} ${inr(breakup.monthlyCtc)}` : `${o.currency} ${money(o.total)}`),
    'company.name': e(ENTITY_NAME),
    'letter.date': e(longDate(now)),
    'letter.dateShort': e(shortDate(now)),
    'recruiter.name': e(recruiter),
    'signatory.name': e(signatory.name),
    'signatory.title': e(signatory.title),
  };
  if (c.manager) v['manager.name'] = e(c.manager);
  return v;
}

/** Values for an offer in the hiring data. */
export function letterValues(s: HiringState, offer: Offer, signatory: { name: string; title: string }, recruiter: string): Record<string, string> {
  const a = appById(s, offer.applicationId);
  const c = a && candById(s, a.candidateId);
  const j = a && jobById(s, a.jobId);
  const ctx: LetterContext = {
    offer,
    candidate: c?.name ?? '',
    job: { title: j?.title ?? '', department: j?.department ?? '', location: j?.location ?? offer.location, employmentType: j?.employmentType ?? '', description: j?.description ?? '' },
    manager: j ? employeeById(j.hiringManagerId)?.name : undefined,
  };
  const v = valuesFromContext(ctx, signatory, recruiter);
  // A detail the data does not have stays blank so the letter shows it as missing rather than as an empty gap.
  if (!c) ['candidate.fullName', 'candidate.firstName'].forEach((k) => delete v[k]);
  if (!j) ['job.title', 'job.department', 'job.employmentType'].forEach((k) => delete v[k]);
  return v;
}

/** Fills the fields it has values for; the rest stay visible as {{field}} and are listed in `missing`. */
export function renderLetter(html: string, values: Record<string, string>): { html: string; missing: string[] } {
  const missing = new Set<string>();
  // A table or list cannot sit inside a paragraph, which is how a Word file stores a line holding only the field.
  const out = html.replace(/<p>\s*(\{\{\s*offer\.salaryTable\s*\}\}|\{\{\s*job\.responsibilities\s*\}\})\s*<\/p>/g, '$1').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => {
    if (values[key] !== undefined && values[key] !== '') return values[key];
    missing.add(key);
    return `{{${key}}}`;
  });
  return { html: out, missing: [...missing] };
}

/** Sample details for the template preview; the salary table follows the location. */
export function sampleLetterValues(location = 'Dubai', signatory: Signatory = signatoryFor(getLetterState(), location)): Record<string, string> {
  const india = location === 'Kochi';
  const ctx: LetterContext = {
    offer: {
      code: 'OFF-0003',
      joiningDate: '2026-11-11',
      probationMonths: 6,
      expiryDate: '2026-10-19',
      currency: india ? 'INR' : 'AED',
      total: india ? 720000 : 13000,
      lines: india
        ? [{ label: 'Basic', amount: 360000 }, { label: 'House Rent Allowance', amount: 144000 }, { label: 'Special Allowance', amount: 120000 }, { label: 'Other Allowance', amount: 96000 }]
        : [{ label: 'Basic', amount: 9000 }, { label: 'Housing', amount: 2500 }, { label: 'Transport', amount: 1500 }],
    },
    candidate: 'Hamza Farouk',
    job: { title: 'Network Engineer', department: 'Network Engineering', location, employmentType: 'Full-time', description: 'Design, deploy and support client networks.\nOwn incident response for managed customers.\nDocument changes and hand over to the service desk.' },
    manager: 'Harsha',
  };
  return valuesFromContext(ctx, signatory, 'Aslima');
}

/* ---------------------------------------------------------------------- reading an uploaded template */

/** Removes anything that could run script from an uploaded HTML template. The letter is also shown in a sandboxed frame. */
export function cleanHtml(html: string): string {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed|link|meta|form)[\s\S]*?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2')
    .trim();
}

const paragraphs = (text: string) =>
  text
    .split(/\r?\n\r?\n+/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\r?\n/g, '<br>')}</p>`)
    .join('\n');

/** Turns an uploaded file into a letter body. Word files keep their headings, bold, lists and tables. */
export async function importTemplateFile(file: File): Promise<{ html: string; note: string }> {
  const name = file.name.toLowerCase();
  if (file.size > 5 * 1024 * 1024) throw new Error('That file is larger than 5 MB.');
  if (name.endsWith('.docx')) {
    const mammoth = (await import('mammoth')).default ?? (await import('mammoth'));
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const html = cleanHtml(result.value);
    if (!html) throw new Error('That Word file has no text in it.');
    return { html, note: result.messages.length ? 'Some Word formatting (such as text boxes or headers) could not be carried over. Check the preview.' : 'Word formatting carried over.' };
  }
  if (name.endsWith('.html') || name.endsWith('.htm')) return { html: cleanHtml(await file.text()), note: 'HTML imported. Scripts and styles were removed.' };
  if (name.endsWith('.txt') || name.endsWith('.md')) return { html: paragraphs(await file.text()), note: 'Text imported, one paragraph per blank line.' };
  throw new Error('Upload a Word (.docx), HTML or text file. A PDF cannot be filled in with each candidate’s details, so keep the Word version of the letter for the template.');
}

/* ---------------------------------------------------------------------- store */

const KEY = 'gsit.hiring.letters.v1';
const DEFAULTS: LetterState = { slots: {}, signatories: { ...SIGNATORY_DEFAULTS } };
let state: LetterState = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<LetterState>;
      state = { slots: p.slots ?? {}, signatories: { ...SIGNATORY_DEFAULTS, ...p.signatories } };
    }
  } catch {
    /* keep the defaults */
  }
}

function commit(next: LetterState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full: the change still applies for this visit */
  }
  listeners.forEach((l) => l());
}

export function useLetterState(): LetterState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      load();
      return state;
    },
    () => DEFAULTS,
  );
}

export function getLetterState(): LetterState {
  load();
  return state;
}

/** The template that applies to a location: its own, else the built-in letter. */
export function templateFor(s: LetterState, location: string): { html: string; slot: string; source: string } {
  const label = (x: LetterSlot) => (x.source === 'upload' ? `Uploaded${x.fileName ? ` (${x.fileName})` : ''}` : 'Edited');
  const own = s.slots[location];
  if (own) return { html: own.html, slot: location, source: label(own) };
  return { html: builtinFor(location), slot: location, source: location === 'Kochi' ? 'Built-in (India letter of employment)' : 'Built-in' };
}

export function saveLetterSlot(slot: string, html: string, source: 'upload' | 'edited', by: string, fileName?: string) {
  commit({ ...state, slots: { ...state.slots, [slot]: { html, source, fileName, updatedAt: new Date().toISOString(), updatedBy: by } } });
  logAudit({ employeeId: `hiring:letter-${slot}`, field: source === 'upload' ? 'Offer letter template uploaded' : 'Offer letter template edited', to: `${slot === 'Kochi' ? 'India' : 'UAE'}${fileName ? ` · ${fileName}` : ''}`, changedBy: by, module: 'Hiring' });
}

export function resetLetterSlot(slot: string, by: string) {
  const next = { ...state.slots };
  delete next[slot];
  commit({ ...state, slots: next });
  logAudit({ employeeId: `hiring:letter-${slot}`, field: 'Offer letter template reset', to: 'Back to the built-in letter', changedBy: by, module: 'Hiring' });
}

export function saveSignatory(location: string, name: string, title: string, by: string) {
  commit({ ...state, signatories: { ...state.signatories, [location]: { name: name.trim(), title: title.trim() } } });
  logAudit({ employeeId: `hiring:letter-signatory-${location}`, field: 'Offer letter signatory', to: `${location === 'Kochi' ? 'India' : 'UAE'}: ${name.trim()}, ${title.trim()}`, changedBy: by, module: 'Hiring' });
}

/** The offer letter for an offer: the location's template merged with the offer. */
export function buildLetter(s: HiringState, offerId: string, recruiter: string, ls: LetterState = getLetterState()): { html: string; missing: string[]; source: string } | null {
  const o = offerById(s, offerId);
  if (!o) return null;
  const t = templateFor(ls, o.location);
  const r = renderLetter(t.html, letterValues(s, o, signatoryFor(ls, o.location), recruiter));
  return { html: r.html, missing: r.missing, source: t.source };
}

/* ---------------------------------------------------------------------- download */

const PAGE_W = 794; // A4 at 96 dpi
const PAGE_H = 1123;
const SCALE = 2;

type Html2Canvas = (el: HTMLElement, o: Record<string, unknown>) => Promise<HTMLCanvasElement>;

/** Draws one piece of markup at page width and reports where its blocks start, so pages can break between them. */
async function snap(html2canvas: Html2Canvas, markup: string): Promise<{ canvas: HTMLCanvasElement; height: number; starts: number[]; forced: number[] }> {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;border:0`;
  document.body.appendChild(frame);
  try {
    await new Promise<void>((resolve) => {
      frame.onload = () => resolve();
      frame.srcdoc = markup;
    });
    const doc = frame.contentDocument;
    if (!doc) throw new Error('The letter could not be prepared.');
    await Promise.all([...doc.images].map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = i.onerror = () => r(null); }))));
    const body = doc.body;
    const height = Math.ceil(body.getBoundingClientRect().height);
    // Block positions are read from the copy that gets drawn, so they match the picture exactly.
    let starts: number[] = [];
    let forced: number[] = [];
    const measure = (root: HTMLElement) => {
      starts = [...root.querySelectorAll('p,h1,h2,h3,li,table:not(.keep),table.keep>tbody>tr:first-child')].map((el) => Math.round(el.getBoundingClientRect().top));
      forced = [...root.querySelectorAll('.pb')].map((el) => Math.round(el.getBoundingClientRect().top));
    };
    measure(body);
    const canvas = await html2canvas(body, { scale: SCALE, backgroundColor: '#ffffff', width: PAGE_W, height, windowWidth: PAGE_W, logging: false, onclone: (cd: Document) => measure(cd.body) });
    return { canvas, height, starts, forced };
  } finally {
    frame.remove();
  }
}

/** Saves the letter as a PDF. Each page is drawn as an image, so the candidate gets a faithful copy that cannot be edited. */
export async function downloadLetterPdf(html: string, fileBase: string, location?: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const h2c = html2canvas as unknown as Html2Canvas;
  const { head, foot } = letterhead(location);
  const [header, footer, body] = await Promise.all([
    snap(h2c, shell(head, fileBase)),
    snap(h2c, shell(foot, fileBase)),
    snap(h2c, shell(`<div class="lh-body">${html}</div>`, fileBase)),
  ]);
  const room = PAGE_H - header.height - footer.height; // height left for the letter on each page
  // Page breaks go before a block (never through a line) and before any heading marked to start a page.
  const pages: [number, number][] = [];
  for (let start = 0; start < body.height; ) {
    const limit = start + room;
    if (limit >= body.height) {
      pages.push([start, body.height]);
      break;
    }
    const forced = body.forced.find((t) => t > start + 40 && t <= limit);
    const natural = body.starts.filter((t) => t > start + room * 0.5 && t <= limit).pop();
    const end = forced ?? natural ?? limit;
    pages.push([start, end]);
    start = end;
  }
  const pdf = new jsPDF({ unit: 'px', format: [PAGE_W, PAGE_H], hotfixes: ['px_scaling'], compress: true });
  pdf.setProperties({ title: fileBase });
  const put = (c: HTMLCanvasElement, y: number, h: number, sy = 0) => {
    const part = document.createElement('canvas');
    part.width = c.width;
    part.height = Math.max(1, Math.round(h * SCALE));
    part.getContext('2d')?.drawImage(c, 0, sy * SCALE, c.width, part.height, 0, 0, c.width, part.height);
    pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, y, PAGE_W, h);
  };
  pages.forEach(([from, to], n) => {
    if (n > 0) pdf.addPage([PAGE_W, PAGE_H]);
    put(header.canvas, 0, header.height);
    put(body.canvas, header.height, to - from, from);
    put(footer.canvas, PAGE_H - footer.height, footer.height);
  });
  pdf.save(`${fileBase.replace(/[^\w.-]+/g, '_')}.pdf`);
}
