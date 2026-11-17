'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useOrg } from '@/context/OrgContext';
import { ApiError, errorMessage } from '@/lib/api';
import { ServerEmployee, employeesApi, initialsOf, statusOfServer, typeOfServer } from '@/lib/employeesApi';
import { ServerProfileData, profilesApi } from '@/lib/profilesApi';
import { todayISO } from '@/lib/dates';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, EmptyState } from '@/components/ui/Card';
import { EmpId } from '@/components/ui/EmployeeBits';
import { toneFor } from '@/components/ui/Avatar';
import { ArrowLeftIcon, BookIcon, BuildingIcon, EditIcon, PeopleIcon, XIcon } from '@/components/icons';

/* An employee's profile read from the server (local development): the directory record plus the profile (personal
   details, emergency contacts, experience, education, family). Identity documents, bank, salary and files arrive with
   their own tables. Someone outside the viewer's data scope is a 404, shown the same as a code that does not exist.
   The Edit button follows the server's `canEdit`. */

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="field">
      <span className="k">{k}</span>
      <span className="v">{v === null || v === undefined || v === '' ? '—' : v}</span>
    </div>
  );
}

function Sub({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className="subhd" style={first ? undefined : { marginTop: 18 }}>
      {children}
    </div>
  );
}

const ageOn = (dob: string, today: string) => {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
};

const TABS = ['Overview', 'Personal', 'Employment', 'Emergency', 'Experience & Education', 'Family'] as const;
type Tab = (typeof TABS)[number];

export function ServerProfile({ code }: { code: string }) {
  const { locationName, locationDef } = useOrg();
  const [state, setState] = useState<{ code: string; e?: ServerEmployee; p?: ServerProfileData; error?: string; missing?: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [saved, setSaved] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([employeesApi.get(code), profilesApi.get(code)])
      .then(([e, p]) => !cancelled && setState({ code, e, p }))
      .catch((err) => !cancelled && setState({ code, missing: err instanceof ApiError && err.status === 404, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  // The edit page leaves a one-time note so this page can confirm what was saved.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('gsit.flash');
      if (!raw) return;
      const f = JSON.parse(raw) as { code: string; labels: string[] };
      sessionStorage.removeItem('gsit.flash');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (f.code === code) setSaved(f.labels);
    } catch {
      /* ignore */
    }
  }, [code]);

  const back = (
    <Link href="/directory" className="svc-back">
      <ArrowLeftIcon /> Back to Directory
    </Link>
  );
  const loaded = state?.code === code ? state : null;

  if (!loaded) {
    return (
      <div>
        {back}
        <Card>
          <div className="ad-foot">Loading…</div>
        </Card>
      </div>
    );
  }
  if (!loaded.e || !loaded.p) {
    return (
      <div>
        {back}
        <Card>
          <EmptyState icon={<PeopleIcon />} title={loaded.missing ? 'Employee not found' : 'Could not load this profile'} description={loaded.missing ? 'Nobody with this ID is in the part of the directory you can see.' : (loaded.error ?? '')} />
        </Card>
      </div>
    );
  }

  const e = loaded.e;
  const p = loaded.p;
  const status = statusOfServer(e);
  const tone = toneFor(e.department?.name ?? '');
  const mgr = e.reportingManager;
  const isIndia = locationDef(e.location.id)?.template === 'india';
  const manager = mgr ? (
    <>
      {mgr.name}
      <EmpId code={mgr.employeeCode} />
    </>
  ) : null;

  return (
    <div>
      {back}

      {saved && (
        <div className="note-box" style={{ marginBottom: 12, alignItems: 'center', background: '#effaf3', borderColor: '#bfe8cf' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ color: '#15803d' }}>
            <path d="m9 11 3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <div style={{ flex: 1 }}>Profile updated — {saved.join(', ')}. Recorded in Audit Logs.</div>
          <button className="icon-act" onClick={() => setSaved(null)} title="Dismiss">
            <XIcon />
          </button>
        </div>
      )}

      <Card className="lc-pf">
        <div className="profile-hd">
          <div className="av" style={{ background: tone.bg, color: tone.fg }}>
            {initialsOf(e.name)}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2>{e.name}</h2>
            <div className="meta">
              {[e.employeeCode, e.designation?.name, e.department?.name, e.company.name].filter(Boolean).map((x, i) => (
                <span key={i}>
                  {i > 0 && '· '}
                  {x}
                </span>
              ))}
            </div>
            <div className="flags">
              <StatusBadge status={status} />
              <span className="roleflag">{locationName(e.location.id)}</span>
            </div>
          </div>
          {p.canEdit && (
            <Link href={`/directory/${encodeURIComponent(e.employeeCode)}/edit`} className="btn primary">
              <EditIcon /> Edit profile
            </Link>
          )}
        </div>

        <div className="lc-pf-facts">
          <div>
            <div className="k">Reports to</div>
            <div className="v">{mgr ? mgr.name : '—'}</div>
          </div>
          <div>
            <div className="k">Joined</div>
            <div className="v">{e.dateOfJoining}</div>
          </div>
          <div>
            <div className="k">Work email</div>
            <div className="v" title={e.email}>
              {e.email}
            </div>
          </div>
          <div>
            <div className="k">Work phone</div>
            <div className="v">{p.workPhone || '—'}</div>
          </div>
        </div>
      </Card>

      <div className="ed-layout">
        <nav className="ed-nav" aria-label="Profile sections">
          {TABS.map((t, i) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`ed-ni ${tab === t ? 'on' : ''}`} aria-current={tab === t ? 'page' : undefined}>
              <span className="ed-nn">{i + 1}</span>
              <span className="ed-nl">{t}</span>
            </button>
          ))}
        </nav>

        <Card className="ed-main">
          <div className="lc-pf-body">
            {tab === 'Overview' && (
              <div>
                <div className="g2">
                  <div>
                    <Sub first>Snapshot</Sub>
                    <Field k="Employee ID" v={e.employeeCode} />
                    <Field k="Full name" v={e.name} />
                    <Field k="Organization" v={e.company.name} />
                    <Field k="Designation" v={e.designation?.name} />
                    <Field k="Department" v={e.department?.name} />
                    <Field k="Reporting manager" v={manager} />
                    <Field k="Date of joining" v={e.dateOfJoining} />
                  </div>
                  <div>
                    <Sub first>Status</Sub>
                    <Field k="Work location" v={[locationName(e.location.id), p.seatingLocation].filter(Boolean).join(' · ')} />
                    <Field k="Employment type" v={typeOfServer(e)} />
                    <Field k="Employment status" v={status} />
                    <Field k="Work email" v={e.email} />
                    <Field k="Work phone" v={p.workPhone} />
                  </div>
                </div>
                <p className="sb" style={{ marginTop: 18 }}>
                  Identity documents, bank, salary, files and assets will appear here once the server stores them.
                </p>
              </div>
            )}

            {tab === 'Personal' && (
              <div>
                <div className="g2">
                  <div>
                    <Sub first>Identity</Sub>
                    <Field k="Full name (as per passport)" v={e.name} />
                    {isIndia && !!(p.firstName || p.lastName) && (
                      <>
                        <Field k="First name" v={p.firstName} />
                        <Field k="Middle name" v={p.middleName} />
                        <Field k="Last name" v={p.lastName} />
                      </>
                    )}
                    <Field k="Date of birth" v={p.dateOfBirth} />
                    <Field k="Age" v={p.dateOfBirth ? ageOn(p.dateOfBirth, todayISO()) : null} />
                    <Field k="Nationality" v={p.nationality} />
                    <Field k="Gender" v={p.gender} />
                    <Field k="Marital status" v={p.maritalStatus} />
                    <Field k="Blood group" v={p.bloodGroup} />
                  </div>
                  <div>
                    <Sub first>Contact</Sub>
                    <Field k="Personal mobile" v={p.personalMobile} />
                    <Field k="Personal email" v={p.personalEmail} />
                    <Field k="Work email" v={e.email} />
                    <Field k="Work phone" v={p.workPhone} />
                  </div>
                </div>
                <Sub>Addresses</Sub>
                <div className="g2">
                  <div>
                    <Field k="Current address" v={p.currentAddress} />
                  </div>
                  <div>
                    <Field k="Permanent address (home country)" v={p.permanentAddress} />
                  </div>
                </div>
              </div>
            )}

            {tab === 'Employment' && (
              <div className="g2">
                <div>
                  <Sub first>Job</Sub>
                  <Field k="Employee ID" v={e.employeeCode} />
                  <Field k="Organization" v={e.company.name} />
                  <Field k="Department" v={e.department?.name} />
                  <Field k="Designation" v={e.designation?.name} />
                  <Field k="Reporting manager" v={manager} />
                  <Field k="Employment type" v={typeOfServer(e)} />
                  <Field k="Employment status" v={status} />
                  <Field k="Work email (sign-in)" v={e.email} />
                </div>
                <div>
                  <Sub first>Placement</Sub>
                  <Field k="Work location" v={locationName(e.location.id)} />
                  <Field k="Seating location" v={p.seatingLocation} />
                  <Field k="Joining date" v={e.dateOfJoining} />
                  <Field k="Probation completion" v={p.probationEnd} />
                  <Field k="Work phone (official mobile)" v={p.workPhone} />
                  <Field k="Extension" v={p.extension} />
                </div>
              </div>
            )}

            {tab === 'Emergency' && (
              <div>
                {!p.emergencyContacts.length && <p className="sb">No emergency contacts on file.</p>}
                {p.emergencyContacts.map((c, i) => (
                  <div key={`${c.group}-${i}`}>
                    <Sub first={i === 0}>{c.group}</Sub>
                    <Field k="Name" v={c.name} />
                    <Field k="Relationship" v={c.relationship} />
                    <Field k="Mobile number" v={c.mobile} />
                  </div>
                ))}
              </div>
            )}

            {tab === 'Experience & Education' && (
              <div>
                <Sub first>Work experience{p.totalExperience ? ` · ${p.totalExperience} before joining` : ''}</Sub>
                {!p.experience.length && <p className="sb">No previous experience on file.</p>}
                {p.experience.map((x, i) => (
                  <div key={`${x.company}-${i}`} className="doc">
                    <div className="fic">
                      <BuildingIcon />
                    </div>
                    <div>
                      <div className="nm">{[x.title, x.company].filter(Boolean).join(' · ')}</div>
                      <div className="mt">{[x.fromDate || x.toDate ? `${x.fromDate ?? '…'} → ${x.toDate ?? '…'}` : '', x.location, x.workMode].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                ))}
                <Sub>Education</Sub>
                {!p.education.length && <p className="sb">No education on file.</p>}
                {p.education.map((x, i) => (
                  <div key={`${x.qualification}-${i}`} className="doc">
                    <div className="fic">
                      <BookIcon />
                    </div>
                    <div>
                      <div className="nm">{[x.course, x.qualification].filter(Boolean).join(' · ')}</div>
                      <div className="mt">{[x.institution, x.field, x.startYear || x.endYear ? `${x.startYear ?? '…'}–${x.endYear ?? '…'}` : ''].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'Family' && (
              <div>
                <Sub first>Family members</Sub>
                {!p.family.length ? (
                  <p className="sb">No family members on file.</p>
                ) : (
                  <div className="lc-scroll" style={{ border: '1px solid var(--border-soft)', borderRadius: 12, marginTop: 8 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Relationship</th>
                          <th>Date of birth</th>
                          <th>Occupation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.family.map((f, i) => (
                          <tr key={`${f.name}-${i}`}>
                            <td style={{ fontWeight: 600 }}>{f.name}</td>
                            <td>{f.relationship}</td>
                            <td>{f.dateOfBirth || '—'}</td>
                            <td>{f.occupation || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
