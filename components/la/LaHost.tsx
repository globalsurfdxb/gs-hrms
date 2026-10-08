'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { EMPLOYEES, REFERENCE_TODAY } from '@/lib/data';
import { useOrg } from '@/context/OrgContext';
import { useApp, useCurrentEmployee } from '@/context/AppContext';
import { Role } from '@/lib/types';
import { useEmployeeVersion } from '@/lib/employeeStore';
import { LaChrome, laCurrentPath, laPath, setLaChrome } from '@/lib/laStore';
import { leaveOrgPayload } from '@/lib/leaveBridge';

const BASE = '/modules/leave-attendance';

/* The signed-in role decides which Leave & Attendance spaces and Operations tools the runtime offers. */
const PERSONA_FOR: Partial<Record<Role, string>> = { 'Super Admin': 'admin', HR: 'hr', 'Office Admin': 'hr', 'Team Lead': 'lead', Employee: 'employee' };

const FONTS_ID = 'la-fonts';
const SCRIPT_ID = 'la-runtime';

const SHELL = `
<main class="content" id="view"></main>
<div class="modal-ov" id="modalOv" onclick="if(event.target===this)closeModal()"><div id="modalHost"></div></div>
<div class="toast-wrap" id="toastWrap"></div>
`;

let cssPromise: Promise<string> | null = null;
let scriptPromise: Promise<void> | null = null;

function loadCss() {
  cssPromise ??= fetch(`/la/la.css?v=${BUILD}`).then((r) => r.text());
  return cssPromise;
}

/* The prototype runtime plus the active layer that gives every screen real behaviour (order matters). */
const SCRIPTS = ['la.js', 'la-core.js', 'la-att.js', 'la-leave.js', 'la-home.js', 'la-ops1.js', 'la-ops2.js'];
const BUILD = Date.now();

function loadScript(name: string) {
  return new Promise<void>((resolve, reject) => {
    const id = `${SCRIPT_ID}-${name}`;
    if (document.getElementById(id)) return resolve();
    const s = document.createElement('script');
    s.id = id;
    s.src = `/la/${name}?v=${BUILD}`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load /la/${name}`));
    document.head.appendChild(s);
  });
}

function loadRuntime() {
  scriptPromise ??= SCRIPTS.reduce((p, n) => p.then(() => loadScript(n)), Promise.resolve()).catch((e) => {
    scriptPromise = null;
    throw e;
  });
  return scriptPromise;
}

function ensureFonts() {
  if (document.getElementById(FONTS_ID)) return;
  const l = document.createElement('link');
  l.id = FONTS_ID;
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(l);
}

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
      employees: EMPLOYEES.map((e) => ({ id: e.id, code: e.employeeCode, name: e.name, company: e.company, department: e.department, designation: e.designation, location: e.location, managerId: e.reportingManagerId, status: e.employmentStatus, email: e.email, phone: e.phone, doj: e.dateOfJoining, exitDate: e.exitDate, exitReason: e.exitReason })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locations, companies, me.employeeCode, role, empVersion],
  );
  // Declared before the mount effect below so the organisation is published before the runtime loads.
  useEffect(() => {
    (window as unknown as { __laOrg: unknown }).__laOrg = org;
    (window as unknown as { LA?: { orgChanged?: () => void } }).LA?.orgChanged?.();
  }, [org]);

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

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let cancelled = false;
    ensureFonts();

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

    Promise.all([loadCss(), loadRuntime()]).then(([css]) => {
      if (cancelled) return;
      const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${css}</style>${SHELL}`;
      (window as unknown as { laInit: (r: ShadowRoot, p: string[]) => void }).laInit(root, initial.current ? initial.current.split('/') : []);
      ready.current = true;
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

  return <div ref={ref} />;
}
