'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { EMPLOYEES, REFERENCE_TODAY } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { Role } from '@/lib/types';
import { useEmployeeVersion } from '@/lib/employeeStore';
import { LaChrome, laCurrentPath, laPath, setLaChrome } from '@/lib/laStore';
import { leaveOrgPayload } from '@/lib/leaveBridge';
import { ensureLaFonts, loadLaCss, loadLaRuntime } from '@/lib/laRuntime';
import { logTask } from '@/lib/activity';

const BASE = '/modules/leave-attendance';

/* The signed-in role decides which Leave & Attendance spaces and Operations tools the runtime offers. */
const PERSONA_FOR: Partial<Record<Role, string>> = { 'Super Admin': 'admin', HR: 'hr', 'Office Admin': 'hr', 'Team Lead': 'lead', 'Talent Acquisition Manager': 'lead', Recruiter: 'employee', Employee: 'employee' };

const SHELL = `
<main class="content" id="view"></main>
<div class="modal-ov" id="modalOv" onclick="if(event.target===this)closeModal()"><div id="modalHost"></div></div>
<div class="toast-wrap" id="toastWrap"></div>
`;

/** Hosts the Leave & Attendance screens in an isolated shadow root so the prototype's
    own stylesheet cannot leak into (or be overridden by) the rest of the app. */
export function LaHost() {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { locations, companies } = useOrg();
  const me = useCurrentEmployee();
  const { role } = useApp();
  const empVersion = useEmployeeVersion();

  /* The module works on the app's own organisation: its locations (with the working week and hours
     set in Administration → Settings), companies, employees and "today". */
  const org = useMemo(
    () => ({
      today: REFERENCE_TODAY,
      // the app's own leave requests, balances, today's attendance, holidays and approver routing: one source for both sides
      leave: leaveOrgPayload(locations),
      meId: me.employeeCode,
      persona: PERSONA_FOR[role] ?? 'employee',
      locations: locations.map((l) => ({ id: l.id, name: l.name, city: l.city, template: l.template, workingHours: l.workingHours, currency: l.currency })),
      companies: companies.map((c) => ({ id: c.id, name: c.name, code: c.shortCode, location: c.location, status: c.status })),
      employees: EMPLOYEES.map((e) => ({ id: e.id, code: e.employeeCode, name: e.name, company: e.company, department: e.department, designation: e.designation, location: e.location, managerId: e.reportingManagerId, status: e.employmentStatus, email: e.email, phone: e.phone, gender: e.profile.gender, doj: e.dateOfJoining, exitDate: e.exitDate, exitReason: e.exitReason })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locations, companies, me.employeeCode, role, empVersion],
  );
  // Declared before the mount effect below so the organisation is published before the runtime loads.
  useEffect(() => {
    (window as unknown as { __laOrg: unknown }).__laOrg = org;
    (window as unknown as { LA?: { orgChanged?: () => void } }).LA?.orgChanged?.();
  }, [org]);

  // Every task done in Leave & Attendance (apply, approve, punch, adjust…) also goes into the shared audit log.
  useEffect(() => {
    const log = (e: Event) => {
      const d = (e as CustomEvent<{ action: string; entity: string; change: string; reason: string; by: string }>).detail;
      logTask('Leave & Attendance', d.action, d.entity, [d.change, d.reason].filter((x) => x && x !== '—').join(' · ') || '—', { by: d.by });
    };
    window.addEventListener('la:audit', log);
    return () => window.removeEventListener('la:audit', log);
  }, []);

  // The runtime asks the app to open one of its own pages (e.g. Administration → Settings).
  useEffect(() => {
    const go = (e: Event) => router.push((e as CustomEvent<string>).detail);
    window.addEventListener('la:navigate', go);
    return () => window.removeEventListener('la:navigate', go);
  }, [router]);

  // The pathname (not route params) is the source of truth: it stays current after history.pushState.
  const restKey = usePathname().slice(BASE.length).replace(/^\/+|\/+$/g, '');
  const initial = useRef(restKey);
  const ready = useRef(false);
  const fromUrl = useRef(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let cancelled = false;
    ensureLaFonts();

    // Every screen change in the runtime is mirrored into the address bar. The first sync and any
    // URL-driven change replace the entry; user navigation pushes one so Back/Forward work.
    const onChrome = (e: Event) => {
      const detail = (e as CustomEvent<LaChrome>).detail;
      setLaChrome(detail);
      const target = `${BASE}/${laPath(detail).join('/')}`;
      if (window.location.pathname !== target) {
        if (!ready.current || fromUrl.current) window.history.replaceState(null, '', target);
        else window.history.pushState(null, '', target);
      }
    };
    window.addEventListener('la:chrome', onChrome);

    Promise.all([loadLaCss(), loadLaRuntime()]).then(([css]) => {
      if (cancelled) return;
      const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${css}</style>${SHELL}`;
      (window as unknown as { laInit: (r: ShadowRoot, p: string[]) => void }).laInit(root, initial.current ? initial.current.split('/') : []);
      ready.current = true;
      setLoaded(true);
    });

    return () => {
      cancelled = true;
      ready.current = false;
      window.removeEventListener('la:chrome', onChrome);
      (window as unknown as { __laRoot: ShadowRoot | null }).__laRoot = null;
      setLaChrome(null);
    };
  }, []);

  // Back/Forward or a pasted link changed the URL: move the runtime to the matching screen.
  useEffect(() => {
    if (!ready.current) return;
    const want = restKey ? restKey.split('/') : [];
    if (want.join('/') === laCurrentPath().join('/')) return;
    fromUrl.current = true;
    (window as unknown as { laGoto: (p: string[]) => void }).laGoto(want);
    fromUrl.current = false;
  }, [restKey]);

  return (
    <>
      <div ref={ref} />
      {!loaded && <LaBoot />}
    </>
  );
}

/** Placeholder with the module's page rhythm, shown while the runtime downloads so the page never flashes blank. */
function LaBoot() {
  return (
    <div className="la-boot" aria-busy="true" aria-label="Loading Leave & Attendance">
      <div className="la-boot-bar" />
      <div className="la-boot-tiles">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="la-boot-card" />
    </div>
  );
}
