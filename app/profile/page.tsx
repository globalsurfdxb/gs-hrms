'use client';

import { useState } from 'react';
import { useCurrentEmployee } from '@/context/AppContext';
import { useVisa } from '@/context/VisaContext';
import { managerOf } from '@/lib/data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, Button } from '@/components/ui/Card';
import { ExpiryBadge, StatusBadge } from '@/components/ui/Badge';
import { CheckIcon, ShieldIcon } from '@/components/icons';

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="field">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export default function ProfilePage() {
  const e = useCurrentEmployee();
  const { stateOf } = useVisa();
  const mgr = managerOf(e);
  const kochi = e.location === 'Kochi';
  const [phone, setPhone] = useState(e.phone);
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div>
      <PageHeader eyebrow="Self-service" title="My Profile" description="Your own record. Editable fields are limited to a self-service subset — sensitive changes route to HR for approval." />

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

      <div className="g2 row-gap">
        <Card>
          <CardHeader title="Employment" />
          <div style={{ padding: '4px 18px' }}>
            <Field k="Reporting manager" v={mgr?.name ?? '—'} />
            <Field k="Date of joining" v={e.dateOfJoining} />
            <Field k="Employment type" v={e.employmentType} />
            <Field k="Seating location" v={e.seatingLocation} />
            <Field k="Visa status" v={kochi ? 'India — N/A' : <ExpiryBadge state={stateOf(e)} />} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Editable details" action={!editing && <button className="lnk" onClick={() => setEditing(true)}>Edit</button>} />
          <div style={{ padding: 18 }}>
            <div className="fg" style={{ marginBottom: 12 }}>
              <label>Mobile number</label>
              {editing ? <input value={phone} onChange={(ev) => setPhone(ev.target.value)} /> : <div style={{ fontSize: 13, fontWeight: 500 }}>{phone}</div>}
            </div>
            {editing && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="primary" size="sm" onClick={() => setEditing(false)}>
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

            <div style={{ marginTop: 18, borderTop: '1px solid var(--border-soft)', paddingTop: 16 }}>
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
