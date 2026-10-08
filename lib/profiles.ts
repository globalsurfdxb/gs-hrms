import { Employee, EmployeeProfile } from './types';

export const seedDigits = (seed: string, length: number) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let out = '';
  for (let i = 0; i < length; i++) {
    out += (h % 10).toString();
    h = Math.floor(h / 10) || (h * 7 + i + 1) >>> 0;
  }
  return out;
};

const hashInt = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
};

function pick<T>(arr: T[], seed: string, salt = 0): T {
  return arr[(hashInt(seed) + salt * 7919) % arr.length];
}

const shift = (iso: string, years: number, months = 0) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

export const REQUIRED_DOCS = {
  uae: ['Passport Copy', 'Signed Company Offer Letter', 'Attested Educational Certificate', 'Labour Card', 'Residence Visa', 'Emirates ID', 'Signed NDA', 'UAE Driving Licence', 'Medical Insurance E-Card', 'Passport Size Photo', 'Casual Photo'],
  india: ['Passport Copy', 'Signed Company Offer Letter', 'Highest Educational Certificate', 'PAN Card', 'Aadhaar Card', 'Passbook / Bank Statement', 'Signed NDA', 'Signed Employment Contract', 'Insurance Document', 'Passport Size Photo', 'Casual Photo'],
};

const PERSONAL: Record<string, { gender: string; marital: string; blood: string }> = {
  'GS-120': { gender: 'Male', marital: 'Married', blood: 'O+' },
  'GS-058': { gender: 'Male', marital: 'Married', blood: 'A+' },
  'GS-119': { gender: 'Female', marital: 'Single', blood: 'B+' },
  'GS-101': { gender: 'Female', marital: 'Married', blood: 'AB+' },
  'GS-114': { gender: 'Male', marital: 'Single', blood: 'O-' },
  'GS-087': { gender: 'Female', marital: 'Married', blood: 'B-' },
  'GS-042': { gender: 'Male', marital: 'Married', blood: 'A-' },
  'GS-063': { gender: 'Female', marital: 'Single', blood: 'O+' },
  'GS-076': { gender: 'Male', marital: 'Married', blood: 'A+' },
  'GS-142': { gender: 'Female', marital: 'Single', blood: 'B+' },
  'GS-150': { gender: 'Male', marital: 'Single', blood: 'O+' },
  'GS-133': { gender: 'Female', marital: 'Married', blood: 'AB-' },
};

const HOME: Record<string, { address: string; dial: string }> = {
  UAE: { address: 'Villa 12, Al Barsha South, Dubai, United Arab Emirates', dial: '+971' },
  India: { address: 'TC 14/220, Statue Road, Thiruvananthapuram, Kerala 695001, India', dial: '+91' },
  Brazil: { address: 'Rua das Flores 120, Sao Paulo, Brazil', dial: '+55' },
  Pakistan: { address: 'House 14, Gulberg III, Lahore, Pakistan', dial: '+92' },
  Egypt: { address: '22 Mostafa El-Nahas St, Nasr City, Cairo, Egypt', dial: '+20' },
  Jordan: { address: 'Building 8, Abdoun, Amman, Jordan', dial: '+962' },
  Sudan: { address: 'Block 5, Al-Riyadh, Khartoum, Sudan', dial: '+249' },
};

const DEPT_STUDY: Record<string, { course: string; field: string }> = {
  'HR & Admin': { course: 'MBA Human Resources', field: 'Human Resource Management' },
  Sales: { course: 'BBA Marketing', field: 'Marketing' },
  'Cloud & Infra': { course: 'B.Tech Computer Science', field: 'Computer Science' },
  'Network Engineering': { course: 'B.Tech Electronics & Communication', field: 'Networking' },
  'Managed Services': { course: 'B.Sc. Information Technology', field: 'Information Technology' },
  Procurement: { course: 'B.Com Supply Chain', field: 'Supply Chain Management' },
  Finance: { course: 'B.Com Accounting', field: 'Accounting & Finance' },
};

const UAE_NAMES = { male: ['Yousef', 'Hassan', 'Karim', 'Tariq', 'Khalid'], female: ['Amira', 'Layla', 'Nadia', 'Salma', 'Mariam'] };
const IN_NAMES = { male: ['Suresh', 'Rajesh', 'Anil', 'Vijay', 'Mohan'], female: ['Lakshmi', 'Meera', 'Divya', 'Sreeja', 'Latha'] };
const OCCUPATIONS = ['Teacher', 'Engineer', 'Homemaker', 'Accountant', 'Business owner', 'Retired'];
const PRIOR_COMPANIES = ['Orbit Systems', 'Blue Harbor Technologies', 'Northwind Solutions', 'Meridian Infotech', 'Keystone Services'];
/** Sensible earlier roles for a designation: [most recent previous job, the one before it]. */
const PRIOR_TITLES: Record<string, [string, string]> = {
  'General Manager': ['Assistant Manager', 'Operations Executive'],
  'Solutions Architect': ['Systems Engineer', 'Technical Associate'],
  'HR Executive': ['HR Assistant', 'Admin Assistant'],
  'Procurement Officer': ['Procurement Assistant', 'Purchasing Clerk'],
  'Network Engineer': ['Junior Network Engineer', 'NOC Technician'],
  'Account Manager': ['Account Executive', 'Sales Associate'],
  'Senior Sales Executive': ['Sales Executive', 'Junior Sales Executive'],
  'Support Lead': ['Senior Support Engineer', 'Support Engineer'],
  'Support Engineer': ['Junior Support Engineer', 'Helpdesk Technician'],
  'Accounts Executive': ['Junior Accountant', 'Accounts Assistant'],
  'Admin Executive': ['Admin Assistant', 'Office Assistant'],
};
const SENIORITY = /^(Senior|Junior|Associate|Assistant|Lead|Principal|Chief|Head of)\s+/i;

/** A more junior title than the current designation, without stacking seniority prefixes. */
const priorTitle = (designation: string, i: number) => {
  const mapped = PRIOR_TITLES[designation];
  if (mapped) return mapped[i % 2];
  const hadSenior = /^(Senior|Lead|Principal|Chief|Head of)\s+/i.test(designation);
  const base = designation.replace(SENIORITY, '');
  if (hadSenior) return i === 0 ? base : `Junior ${base}`;
  return i === 0 ? `Junior ${base}` : `Assistant ${base}`;
};
const FRIEND_SURNAMES = ['Nair', 'Khan', 'Fernandes', 'Hassan', 'Thomas', 'Mansoor'];
const INSTITUTIONS = ['Al Noor University', 'Coastal Institute of Technology', 'Kerala Institute of Management', 'Meridian University'];

export function buildProfile(e: Omit<Employee, 'profile'>): EmployeeProfile {
  const code = e.employeeCode;
  const isIndia = e.location === 'Kochi';
  const [first, ...rest] = e.name.split(' ');
  const last = rest[rest.length - 1] ?? first;
  const base = PERSONAL[code] ?? { gender: 'Not specified', marital: 'Single', blood: 'O+' };
  const names = isIndia ? IN_NAMES : UAE_NAMES;
  const home = HOME[e.nationality] ?? { address: `${e.nationality}`, dial: '+000' };
  const doc = (type: string) => e.documents.find((d) => d.type === type);

  const currentAddress = isIndia
    ? `House ${10 + (hashInt(code) % 80)}, ${pick(['Sunrise Residency', 'Lakeview Apartments', 'Green Park Villas'], code)}, ${pick(['MG Road', 'Panampilly Nagar', 'Palarivattom Road', 'Kaloor Stadium Road'], code, 1)}, Kochi, Ernakulam, Kerala 682${seedDigits(code + 'pin', 3)}`
    : `Flat ${100 + (hashInt(code) % 800)}, ${pick(['Marina Heights', 'Al Wasl Residence', 'Oasis Tower', 'Palm View'], code)}, ${pick(['Business Bay', 'Al Barsha', 'Jumeirah Lake Towers', 'Al Nahda'], code, 1)}, Dubai, PO Box ${seedDigits(code + 'po', 5)}`;

  const phone = (dial: string, seed: string) =>
    dial === '+971'
      ? `+971 5${seedDigits(seed + 'a', 1)} ${seedDigits(seed + 'b', 3)} ${seedDigits(seed + 'c', 4)}`
      : dial === '+91'
        ? `+91 9${seedDigits(seed + 'a', 4)} ${seedDigits(seed + 'b', 5)}`
        : `${dial} ${seedDigits(seed + 'a', 3)} ${seedDigits(seed + 'b', 3)} ${seedDigits(seed + 'c', 4)}`;

  const usedNames = new Set<string>();
  const personName = (relation: string, salt: number) => {
    const gender = relation === 'Father' || relation === 'Brother' ? 'male' : relation === 'Mother' || relation === 'Sister' ? 'female' : salt % 2 === 0 ? 'male' : 'female';
    const pool = names[gender];
    let n = 0;
    while (n < pool.length - 1 && usedNames.has(`${pick(pool, code, salt + n)} ${last}`)) n++;
    const name = `${pick(pool, code, salt + n)} ${last}`;
    usedNames.add(name);
    return name;
  };

  const mobile = phone(isIndia ? '+91' : '+971', code + 'pm');

  // Family first: emergency contacts are drawn from this list so the two screens never disagree.
  const family: EmployeeProfile['family'] = [];
  if (base.marital === 'Married') {
    family.push({ name: personName('Spouse', 7), relationship: 'Spouse', occupation: pick(OCCUPATIONS, code, 8) });
  }
  family.push({ name: personName('Father', 9), relationship: 'Father', occupation: 'Retired' });
  family.push({ name: personName('Mother', 10), relationship: 'Mother', occupation: 'Homemaker' });

  const member = (relationship: string) => family.find((f) => f.relationship === relationship) ?? family[family.length - 1];
  const contactFrom = (group: string, relationship: string, dial: string) => {
    const m = member(relationship);
    return { group, name: m.name, relationship: m.relationship, mobile: phone(dial, code + group) };
  };
  /** A colleague or friend who is not family, named separately. */
  const friend = (group: string, dial: string) => ({
    group,
    name: `${pick(names[base.gender === 'Female' ? 'female' : 'male'], code, 15)} ${pick(FRIEND_SURNAMES, code, 16)}`,
    relationship: 'Friend',
    mobile: phone(dial, code + group),
  });
  const married = base.marital === 'Married';

  const priorCount = 1 + (hashInt(code) % 2);
  const experience: EmployeeProfile['experience'] = [];
  let cursor = shift(e.dateOfJoining, 0, -1);
  let totalMonths = 0;
  for (let i = 0; i < priorCount; i++) {
    const months = 18 + ((hashInt(code) + i * 13) % 30);
    const from = shift(cursor, 0, -months);
    experience.push({
      company: pick(PRIOR_COMPANIES, code, i + 2),
      location: isIndia ? 'Kochi, India' : 'Dubai, UAE',
      from,
      to: cursor,
      title: priorTitle(e.designation, i),
      mode: 'Onsite',
    });
    cursor = shift(from, 0, -1);
    totalMonths += months;
  }

  const study = DEPT_STUDY[e.department] ?? { course: 'Bachelor of Business Administration', field: 'Business Administration' };
  const isMaster = study.course.startsWith('MBA');
  const endYear = Number(e.dob.slice(0, 4)) + (isMaster ? 24 : 22);
  const education: EmployeeProfile['education'] = [
    {
      qualification: isMaster ? "Master's Degree" : "Bachelor's Degree",
      institution: pick(INSTITUTIONS, code, 5),
      course: study.course,
      field: study.field,
      startYear: String(endYear - (isMaster ? 2 : 3)),
      endYear: String(endYear),
    },
  ];

  const h = hashInt(code);
  const salary: EmployeeProfile['salary'] = isIndia
    ? (() => {
        const basic = 28000 + (h % 10) * 3500;
        const earnings = [
          { label: 'Basic', amount: basic },
          { label: 'House Rent Allowance', amount: Math.round(basic * 0.4) },
          { label: 'Fixed Allowance', amount: 4000 },
          { label: 'Other Allowance', amount: 2000 + (h % 4) * 500 },
        ];
        const deductions = [
          { label: 'Advance Amount', amount: 0 },
          { label: 'EPF Contribution', amount: Math.round(basic * 0.12) },
          { label: 'Other Deductions', amount: 0 },
        ];
        const total = earnings.reduce((n, x) => n + x.amount, 0);
        return { currency: 'INR', earnings, deductions, total, net: total - deductions.reduce((n, x) => n + x.amount, 0) };
      })()
    : (() => {
        const earnings = [
          { label: 'Basic Salary', amount: 7000 + (h % 10) * 750 },
          { label: 'Transportation Allowance', amount: 600 },
          { label: 'Accommodation Allowance', amount: 2500 + (h % 5) * 500 },
        ];
        const total = earnings.reduce((n, x) => n + x.amount, 0);
        return { currency: 'AED', earnings, deductions: [], total, net: total };
      })();

  const required = isIndia ? REQUIRED_DOCS.india : REQUIRED_DOCS.uae;
  const have = new Set<string>(['Passport Copy']);
  if (doc('Emirates ID')) have.add('Emirates ID');
  if (doc('Residence Visa')) have.add('Residence Visa');
  required.forEach((d, i) => {
    if ((h + i) % 5 !== 0) have.add(d);
  });

  return {
    gender: base.gender,
    maritalStatus: base.marital,
    bloodGroup: base.blood,
    personalEmail: `${first.toLowerCase()}.${last.toLowerCase()}@gmail.com`,
    personalMobile: mobile,
    currentAddress,
    permanentAddress: isIndia && e.nationality === 'India' ? currentAddress : home.address,
    extension: String(100 + (h % 900)),
    probationEnd: shift(e.dateOfJoining, 0, 6),
    passportNumber: `${isIndia ? 'K' : pick(['P', 'N', 'L'], code)}${seedDigits(code + 'pp', 7)}`,
    passportExpiry: doc('Passport')?.expiryDate ?? shift(e.dateOfJoining, 9),
    emiratesIdExpiry: doc('Emirates ID')?.expiryDate,
    labourCardIssue: isIndia ? undefined : shift(e.visaExpiry ?? e.dateOfJoining, -2),
    labourCardExpiry: isIndia ? undefined : e.visaExpiry,
    aadhaar: isIndia ? `${2 + (h % 8)}${seedDigits(code + 'a1', 3)} ${seedDigits(code + 'a2', 4)} ${seedDigits(code + 'a3', 4)}` : undefined,
    pan: isIndia ? `${'ABCDEFGHJKLMNPQRSTUVWXYZ'[h % 24]}${'ABCDEFGHJKLMNPQRSTUVWXYZ'[(h >> 3) % 24]}${'ABCDEFGHJKLMNPQRSTUVWXYZ'[(h >> 6) % 24]}P${last[0].toUpperCase()}${seedDigits(code + 'pan', 4)}${'ABCDEFGHJKLMNPQRSTUVWXYZ'[(h >> 9) % 24]}` : undefined,
    uan: isIndia ? e.pfUan ?? seedDigits(code + 'uan', 12) : undefined,
    paymentMode: isIndia ? 'Bank Transfer' : 'WPS Transfer',
    emergency: isIndia
      ? [contactFrom('Primary Emergency Contact', married ? 'Spouse' : 'Father', '+91'), contactFrom('Alternate Emergency Contact', 'Mother', '+91')]
      : [married ? contactFrom('Local Emergency Contact (UAE)', 'Spouse', '+971') : friend('Local Emergency Contact (UAE)', '+971'), contactFrom('Home Country Emergency Contact', married ? 'Father' : 'Mother', home.dial)],
    totalExperience: `${Math.floor(totalMonths / 12)} yr ${totalMonths % 12} mo`,
    experience,
    education,
    family,
    salary,
    uploadedDocs: required.filter((d) => have.has(d)),
  };
}
