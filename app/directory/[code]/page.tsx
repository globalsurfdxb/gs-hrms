'use client';

import { useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ASSETS, EMPLOYEES, REFERENCE_TODAY, directReports, managerOf } from '@/lib/data';
import { REQUIRED_DOCS } from '@/lib/profiles';
import { useOrg } from '@/context/OrgContext';
import { useSeparation } from '@/context/SeparationContext';
import { useVisa } from '@/context/VisaContext';
import { useDocuments } from '@/context/DocumentsContext';
import { DocumentViewer, ViewableDoc, documentNumber } from '@/components/profile/DocumentViewer';
import { StatusBadge, ExpiryBadge, Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmpId } from '@/components/ui/EmployeeBits';
import { ArrowLeftIcon, ShieldIcon } from '@/components/icons';

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="field">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
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

const money = (currency: string, n: number) => `${currency} ${n.toLocaleString('en-US')}`;

export default function EmployeeProfilePage() {
  const params = useParams<{ code: string }>();
  const { locationDef, locationName } = useOrg();
  const { statusOf, isAssetReturned } = useSeparation();
  const { stateOf, visaExpiryOf, eidExpiryOf } = useVisa();
  const e = EMPLOYEES.find((emp) => emp.employeeCode === params.code);
  const [tab, setTab] = useState('Overview');
  const [viewing, setViewing] = useState<ViewableDoc | null>(null);
  const { fileFor, upload } = useDocuments();

  if (!e) return notFound();

  const p = e.profile;
  const isIndia = locationDef(e.location)?.template === 'india';
  const mgr = managerOf(e);
  const reports = directReports(e.id);
  const assets = ASSETS.filter((a) => a.assignedTo === e.employeeCode);
  const requiredDocs = isIndia ? REQUIRED_DOCS.india : REQUIRED_DOCS.uae;
  const idTab = isIndia ? 'Passport / Aadhaar / PAN' : 'Passport / Visa / EID';
  const TABS = ['Overview', 'Personal', 'Employment', idTab, 'Emergency', 'Experience & Education', 'Family', 'Bank & PF', 'Salary', 'Documents', 'Assets'];
  const eid = e.documents.find((d) => d.type === 'Emirates ID');

  return (
    <div>
      <Link href="/directory" className="svc-back">
        <ArrowLeftIcon /> Back to Directory
      </Link>

      <Card>
        <div className="profile-hd">
          <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
            {e.avatarInitials}
          </div>
          <div style={{ flex: 1 }}>
            <h2>{e.name}</h2>
            <div className="meta">
              <span>{e.employeeCode}</span>
              <span>·</span>
              <span>{e.designation}</span>
              <span>·</span>
              <span>{e.department}</span>
              <span>·</span>
              <span>{e.company}</span>
            </div>
            <div className="flags">
              <StatusBadge status={statusOf(e)} />
              <span className="roleflag">{locationName(e.location)}</span>
            </div>
          </div>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? 'on' : ''}`}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ padding: 22 }}>
          {tab === 'Overview' && (
            <div className="g2">
              <div>
                <Sub first>Snapshot</Sub>
                <Field k="Employee ID" v={e.employeeCode} />
                <Field k="Full name" v={e.name} />
                <Field k="Organization" v={e.company} />
                <Field k="Designation" v={e.designation} />
                <Field k="Department" v={e.department} />
                <Field
                  k="Reporting manager"
                  v={
                    mgr ? (
                      <>
                        {mgr.name}
                        <EmpId code={mgr.employeeCode} />
                      </>
                    ) : (
                      '—'
                    )
                  }
                />
                <Field k="Date of joining" v={e.dateOfJoining} />
              </div>
              <div>
                <Sub first>Status</Sub>
                <Field k="Work location" v={`${locationName(e.location)} · ${e.seatingLocation}`} />
                <Field k="Employment type" v={e.employmentType} />
                <Field k="Employment status" v={statusOf(e)} />
                <Field k="Work email" v={e.email} />
                <Field k="Work phone" v={e.phone} />
                <Field k="Visa status" v={isIndia ? 'Not applicable' : <ExpiryBadge state={stateOf(e)} />} />
              </div>
              {!!reports.length && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Sub>Direct reports ({reports.length})</Sub>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {reports.map((r) => (
                      <Link key={r.id} href={`/directory/${r.employeeCode}`} className="chip">
                        <span className="person">
                          <span className="av" style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--gray-50)', fontSize: 10 }}>
                            {r.avatarInitials}
                          </span>
                          {r.name}
                          <EmpId code={r.employeeCode} />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'Personal' && (
            <div>
              <div className="g2">
                <div>
                  <Sub first>Identity</Sub>
                  <Field k="Full name (as per passport)" v={e.name} />
                  <Field k="Date of birth" v={e.dob} />
                  <Field k="Age" v={ageOn(e.dob, REFERENCE_TODAY)} />
                  <Field k="Nationality" v={e.nationality} />
                  <Field k="Gender" v={p.gender} />
                  <Field k="Marital status" v={p.maritalStatus} />
                  <Field k="Blood group" v={p.bloodGroup} />
                </div>
                <div>
                  <Sub first>Contact</Sub>
                  <Field k="Personal mobile" v={p.personalMobile} />
                  <Field k="Personal email" v={p.personalEmail} />
                  <Field k="Work email" v={e.email} />
                  <Field k="Work phone" v={e.phone} />
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
                <Field k="Organization" v={e.company} />
                <Field k="Department" v={e.department} />
                <Field k="Designation" v={e.designation} />
                <Field
                  k="Reporting manager"
                  v={
                    mgr ? (
                      <>
                        {mgr.name}
                        <EmpId code={mgr.employeeCode} />
                      </>
                    ) : (
                      '—'
                    )
                  }
                />
                <Field k="Employment type" v={e.employmentType} />
                <Field k="Employment status" v={statusOf(e)} />
              </div>
              <div>
                <Sub first>Placement</Sub>
                <Field k="Work location" v={locationName(e.location)} />
                <Field k="Seating location" v={e.seatingLocation} />
                <Field k="Joining date" v={e.dateOfJoining} />
                <Field k="Probation completion" v={p.probationEnd} />
                <Field k="Work phone (official mobile)" v={e.phone} />
                <Field k="Extension" v={p.extension} />
                {e.exitReason && <Field k="Exit reason" v={`${e.exitReason} · ${e.exitDate}`} />}
              </div>
            </div>
          )}

          {tab === idTab && (
            <div>
              {isIndia ? (
                <div className="g2">
                  <div>
                    <Sub first>Passport</Sub>
                    <Field k="Passport number" v={p.passportNumber} />
                    <Field k="Passport expiry" v={p.passportExpiry} />
                  </div>
                  <div>
                    <Sub first>Statutory identity (India)</Sub>
                    <Field k="Aadhaar number" v={p.aadhaar ?? '—'} />
                    <Field k="PAN number" v={p.pan ?? '—'} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="compgrid" style={{ marginBottom: 18 }}>
                    <div className="compcard">
                      <div className="ttl">
                        Residence Visa <ExpiryBadge state={stateOf(e)} />
                      </div>
                      <div className="num">Expires {visaExpiryOf(e) ?? '—'}</div>
                    </div>
                    <div className="compcard">
                      <div className="ttl">
                        Emirates ID {eid && <ExpiryBadge state={eid.state} />}
                      </div>
                      <div className="num">{e.emiratesId ?? '—'}</div>
                      {eidExpiryOf(e) && <div className="dates">Expires {eidExpiryOf(e)}</div>}
                    </div>
                    <div className="compcard">
                      <div className="ttl">Labour Card</div>
                      <div className="num">On file</div>
                      <div className="dates">
                        Issued {p.labourCardIssue ?? '—'} · Expires {p.labourCardExpiry ?? '—'}
                      </div>
                    </div>
                  </div>
                  <div className="g2">
                    <div>
                      <Sub first>Passport</Sub>
                      <Field k="Passport number" v={p.passportNumber} />
                      <Field k="Passport expiry" v={p.passportExpiry} />
                    </div>
                    <div>
                      <Sub first>Visa &amp; Emirates ID</Sub>
                      <Field k="Visa expiry" v={visaExpiryOf(e) ?? '—'} />
                      <Field k="Emirates ID" v={e.emiratesId ?? '—'} />
                      <Field k="EID expiry" v={eidExpiryOf(e) ?? '—'} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'Emergency' && (
            <div>
              {p.emergency.map((c, i) => (
                <div key={c.group}>
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
              <Sub first>Work experience · {p.totalExperience} before joining</Sub>
              {p.experience.map((x, i) => (
                <div key={`${x.company}-${i}`} className="doc">
                  <div className="fic">
                    <ShieldIcon />
                  </div>
                  <div>
                    <div className="nm">
                      {x.title} · {x.company}
                    </div>
                    <div className="mt">
                      {x.from} → {x.to} · {x.location} · {x.mode}
                    </div>
                  </div>
                </div>
              ))}
              <Sub>Education</Sub>
              {p.education.map((x, i) => (
                <div key={`${x.course}-${i}`} className="doc">
                  <div className="fic">
                    <ShieldIcon />
                  </div>
                  <div>
                    <div className="nm">
                      {x.course} · {x.qualification}
                    </div>
                    <div className="mt">
                      {x.institution} · {x.field} · {x.startYear}–{x.endYear}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'Family' && (
            <div>
              <Sub first>Family members</Sub>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Relationship</th>
                    <th>Occupation</th>
                  </tr>
                </thead>
                <tbody>
                  {p.family.map((f) => (
                    <tr key={`${f.name}-${f.relationship}`}>
                      <td style={{ fontWeight: 600 }}>{f.name}</td>
                      <td>{f.relationship}</td>
                      <td>{f.occupation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Bank & PF' && (
            <div>
              <div className="note-box" style={{ marginBottom: 16 }}>
                <ShieldIcon />
                <div>
                  This data is automatically shared with Payroll. Format shown for <b>{locationName(e.location)}</b> employees. Restricted to HR / Super Admin.
                </div>
              </div>
              <div className="g2">
                <div>
                  <Sub first>Bank details</Sub>
                  <Field k="Payment mode" v={p.paymentMode} />
                  <Field k="Bank name" v={e.bankDetails.bankName} />
                  <Field k="Account holder name" v={e.bankDetails.accountName} />
                  {isIndia ? (
                    <>
                      <Field k="Account number" v={e.bankDetails.accountNumber} />
                      <Field k="IFSC" v={e.bankDetails.branchCode} />
                    </>
                  ) : (
                    <>
                      <Field k="IBAN number" v={e.bankDetails.accountNumber} />
                      <Field k="Routing / bank code" v={e.bankDetails.branchCode} />
                    </>
                  )}
                  <Field k="Currency" v={e.bankDetails.currency} />
                </div>
                <div>
                  <Sub first>{isIndia ? 'PF details (India)' : 'Statutory (UAE)'}</Sub>
                  {isIndia ? <Field k="UAN" v={p.uan ?? '—'} /> : <Field k="WPS registered" v="Yes" />}
                </div>
              </div>
            </div>
          )}

          {tab === 'Salary' && (
            <div>
              <div className="note-box" style={{ marginBottom: 16 }}>
                <ShieldIcon />
                <div>Salary structure for {locationName(e.location)}. Restricted to HR / Super Admin.</div>
              </div>
              <div className="g2">
                <div>
                  <Sub first>{isIndia ? 'Earnings' : `Earnings (${locationName(e.location)})`}</Sub>
                  {p.salary.earnings.map((x) => (
                    <Field key={x.label} k={x.label} v={money(p.salary.currency, x.amount)} />
                  ))}
                  <Field k={isIndia ? 'Total earnings' : 'Total salary'} v={<b>{money(p.salary.currency, p.salary.total)}</b>} />
                </div>
                <div>
                  {p.salary.deductions.length > 0 ? (
                    <>
                      <Sub first>Deductions</Sub>
                      {p.salary.deductions.map((x) => (
                        <Field key={x.label} k={x.label} v={money(p.salary.currency, x.amount)} />
                      ))}
                      <Sub>Take home</Sub>
                      <Field k="Net pay" v={<b>{money(p.salary.currency, p.salary.net)}</b>} />
                    </>
                  ) : (
                    <>
                      <Sub first>Payroll</Sub>
                      <Field k="Net pay" v={<b>{money(p.salary.currency, p.salary.net)}</b>} />
                      <Field k="Paid via" v="WPS payroll file" />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'Documents' && (
            <div>
              <Sub first>
                Required documents · {requiredDocs.filter((d) => p.uploadedDocs.includes(d) || fileFor(e.id, d)).length} of {requiredDocs.length} uploaded
              </Sub>
              {requiredDocs.map((d) => {
                const done = p.uploadedDocs.includes(d) || !!fileFor(e.id, d);
                const open = () => setViewing({ name: d, number: documentNumber(e, d), onFile: done });
                return (
                  <div key={d} className="doc clickable" role="button" tabIndex={0} onClick={open} onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), open())}>
                    <div className="fic">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </div>
                    <div>
                      <div className="nm">{d}</div>
                    </div>
                    <div className="rt">
                      <Badge tone={done ? 'active' : 'pending'}>{done ? 'Uploaded' : 'Pending'}</Badge>
                    </div>
                  </div>
                );
              })}
              <Sub>Dated documents</Sub>
              {e.documents.map((d) => (
                <div
                  key={d.id}
                  className="doc clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewing({ name: d.type, expiryDate: d.expiryDate, state: d.state, number: documentNumber(e, d.type), onFile: true })}
                  onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), setViewing({ name: d.type, expiryDate: d.expiryDate, state: d.state, number: documentNumber(e, d.type), onFile: true }))}
                >
                  <div className="fic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </div>
                  <div>
                    <div className="nm">{d.type}</div>
                    {d.expiryDate && <div className="mt">Expires {d.expiryDate}</div>}
                  </div>
                  <div className="rt">
                    <ExpiryBadge state={d.state} />
                  </div>
                </div>
              ))}
              <DocumentViewer
                employee={e}
                doc={viewing ? { ...viewing, onFile: viewing.onFile || !!fileFor(e.id, viewing.name) } : null}
                file={viewing ? fileFor(e.id, viewing.name) : undefined}
                onUpload={(name, file) => upload(e.id, name, file)}
                onClose={() => setViewing(null)}
              />
            </div>
          )}

          {tab === 'Assets' && (
            <div>
              <Sub first>Assigned assets · {assets.length}</Sub>
              {!assets.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>No assets are currently assigned to {e.name}.</div>}
              {assets.map((a) => (
                <div key={a.id} className="doc">
                  <div className="fic">
                    <ShieldIcon />
                  </div>
                  <div>
                    <div className="nm">
                      {a.name} <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· {a.type}</span>
                    </div>
                    <div className="mt">
                      Serial {a.serialNumber} · Assigned {a.assignedDate} · Warranty until {a.warrantyExpiry}
                    </div>
                  </div>
                  <div className="rt">
                    <Badge tone={isAssetReturned(a.id) || a.status === 'Returned' ? 'inactive' : a.status === 'In Repair' ? 'pending' : 'active'}>{isAssetReturned(a.id) ? 'Returned' : a.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
