'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useOrg } from '@/context/OrgContext';
import { ApiError, errorMessage } from '@/lib/api';
import { ServerEmployee, employeesApi, initialsOf, statusOfServer, typeOfServer } from '@/lib/employeesApi';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, EmptyState } from '@/components/ui/Card';
import { EmpId } from '@/components/ui/EmployeeBits';
import { toneFor } from '@/components/ui/Avatar';
import { ArrowLeftIcon, PeopleIcon } from '@/components/icons';

/* An employee's profile read from the server (local development). The server holds the directory record only for now;
   personal details, identity, bank, salary and documents arrive with their own tables. Someone outside the viewer's
   data scope is a 404, shown the same as a code that does not exist. */

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="field">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export function ServerProfile({ code }: { code: string }) {
  const { locationName } = useOrg();
  const [state, setState] = useState<{ code: string; e?: ServerEmployee; error?: string; missing?: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    employeesApi
      .get(code)
      .then((e) => !cancelled && setState({ code, e }))
      .catch((err) => !cancelled && setState({ code, missing: err instanceof ApiError && err.status === 404, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
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
  if (!loaded.e) {
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
  const status = statusOfServer(e);
  const tone = toneFor(e.department?.name ?? '');
  const mgr = e.reportingManager;

  return (
    <div>
      {back}
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
            <div className="k">Employment type</div>
            <div className="v">{typeOfServer(e)}</div>
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div className="lc-pf-body">
          <div className="g2">
            <div>
              <div className="subhd">Snapshot</div>
              <Field k="Employee ID" v={e.employeeCode} />
              <Field k="Full name" v={e.name} />
              <Field k="Organization" v={e.company.name} />
              <Field k="Designation" v={e.designation?.name ?? '—'} />
              <Field k="Department" v={e.department?.name ?? '—'} />
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
            </div>
            <div>
              <div className="subhd">Status</div>
              <Field k="Work location" v={locationName(e.location.id)} />
              <Field k="Employment type" v={typeOfServer(e)} />
              <Field k="Employment status" v={status} />
              <Field k="Date of joining" v={e.dateOfJoining} />
              <Field k="Work email" v={e.email} />
            </div>
          </div>
          <p className="sb" style={{ marginTop: 18 }}>
            Personal details, identity documents, bank, salary and files will appear here once the server stores them.
          </p>
        </div>
      </Card>
    </div>
  );
}
