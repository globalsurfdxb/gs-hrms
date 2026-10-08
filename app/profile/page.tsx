'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCurrentEmployee } from '@/context/AppContext';
import { useVisa } from '@/context/VisaContext';
import { ASSETS, REFERENCE_TODAY, managerOf } from '@/lib/data';
import { useLeaveBalances } from '@/lib/leaveBridge';
import { phoneOk } from '@/lib/options';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button } from '@/components/ui/Card';
import { ExpiryBadge, StatusBadge } from '@/components/ui/Badge';
import { StatStrip } from '@/components/ui/StatStrip';
import { CheckIcon, ClockIcon, FileTextIcon, PackageIcon, ShieldIcon, UserIcon } from '@/components/icons';

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="field">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

/** Whole years and months between a joining date and the reference date, e.g. "3y 4m". */
function tenureOf(joined: string) {
  const a = new Date(joined);
  const b = new Date(REFERENCE_TODAY);
  const months = Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0));
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y ? `${y}y ${m}m` : `${m}m`;
}

export default function ProfilePage() {
  const e = useCurrentEmployee();
  const { stateOf } = useVisa();
  const mgr = managerOf(e);
  const kochi = e.location === 'Kochi';
  const [phone, setPhone] = useState(e.phone);
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const phoneError = !phone.trim() ? 'Mobile number is required.' : !phoneOk(phone) ? 'Enter a valid mobile number (7 to 15 digits, e.g. +971 50 123 4567).' : '';

  const balances = useLeaveBalances();
  const annual = balances.find((b) => b.employeeId === e.id && b.type === 'Annual');
  const assets = ASSETS.filter((a) => a.assignedTo === e.id).length;
  const docAlerts = e.documents.filter((d) => d.state === 'soon' || d.state === 'expired').length;

  return (
    <div>
      <PageHeader eyebrow="My Space" title="My Profile" description="Your own record. Editable fields are limited to a self-service subset — sensitive changes route to HR for approval." />

      <Card>
        <div className="profile-hd">
          <div className="av" style={{ background: 'var(--primary-100)', color: 'var(--primary)' }}>
            {e.avatarInitials}
          </div>
          <div style={{ flex: 1 }}>
            <h2>{e.name}</h2>
            <div className="meta">
              {e.employeeCode} · {e.designation} · {e.department}
            </div>
            <div className="flags">
              <StatusBadge status={e.employmentStatus} />
              <span className="roleflag">{e.location} office</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="row-gap">
        <StatStrip
          items={[
            { label: 'Tenure', value: tenureOf(e.dateOfJoining), icon: <UserIcon />, tone: 'blue', hint: `Joined ${e.dateOfJoining}` },
            { label: 'Annual leave left', value: annual ? annual.left : '—', icon: <ClockIcon />, tone: 'green', hint: annual ? `of ${annual.entitled} days` : undefined, href: '/my/leave-attendance' },
            { label: 'Documents on file', value: e.documents.length, icon: <FileTextIcon />, tone: docAlerts ? 'amber' : 'purple', hint: docAlerts ? `${docAlerts} need attention` : 'All up to date', href: '/my/files' },
            { label: 'Assets assigned', value: assets, icon: <PackageIcon />, tone: 'teal', hint: 'IT and office equipment', href: '/my/assets' },
          ]}
        />
      </div>

      <div className="g2 row-gap">
        <Card>
          <CardHeader title="Employment" />
          <div style={{ padding: '4px 18px' }}>
            <Field
              k="Reporting manager"
              v={
                mgr ? (
                  <Link href={`/directory/${mgr.employeeCode}`} className="ss-mgr">
                    <span className="ss-ic av">{mgr.avatarInitials}</span>
                    {mgr.name}
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <Field k="Work email" v={e.email} />
            <Field k="Date of joining" v={e.dateOfJoining} />
            <Field k="Employment type" v={e.employmentType} />
            <Field k="Seating location" v={e.seatingLocation} />
            <Field k="Visa status" v={kochi ? 'India — N/A' : <ExpiryBadge state={stateOf(e)} />} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Editable details" sub="Self-service fields" action={!editing && <button className="lnk" onClick={() => setEditing(true)}>Edit</button>} />
          <div style={{ padding: 18 }}>
            <div className="fg" style={{ marginBottom: 12 }}>
              <label>Mobile number</label>
              {editing ? (
                <input
                  type="tel"
                  value={phone}
                  onChange={(ev) => setPhone(ev.target.value)}
                  aria-invalid={phoneError ? true : undefined}
                  aria-describedby={phoneError ? 'profile-phone-err' : undefined}
                  style={phoneError ? { borderColor: 'var(--danger)' } : undefined}
                />
              ) : (
                <div style={{ fontSize: 13, fontWeight: 500 }}>{phone}</div>
              )}
              {editing && phoneError && (
                <span id="profile-phone-err" className="hint" style={{ color: 'var(--danger)' }}>
                  {phoneError}
                </span>
              )}
            </div>
            {editing && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="primary" size="sm" disabled={!!phoneError} onClick={() => setEditing(false)}>
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhone(e.phone);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            <div className="ss-lock">
              <div className="note-box" style={{ marginBottom: 10, background: 'var(--gray-50)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                <ShieldIcon style={{ color: 'var(--faint)' }} />
                Bank details, address and identity documents are locked. Changes to these route to HR as a request.
              </div>
              {submitted ? (
                <div className="badge b-active" style={{ padding: '8px 12px' }}>
                  <CheckIcon style={{ width: 14, height: 14 }} /> Change request sent to HR
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setSubmitted(true)}>
                  Request a change
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
