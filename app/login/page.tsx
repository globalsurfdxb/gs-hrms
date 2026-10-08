'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EMPLOYEES, PERSONAS } from '@/lib/data';
import { Role } from '@/lib/types';
import { accountFor, safeNext, signIn, useAuth } from '@/lib/auth';
import { ENTITY_NAME } from '@/lib/org';

const DEMO_ROLES: Role[] = ['Super Admin', 'HR', 'Office Admin', 'Team Lead', 'Employee'];

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const I = {
  users: icon(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.8c1.8.7 3 2.4 3 5.2" />
    </>,
  ),
  cube: icon(
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M4 7.5L12 12l8-4.5M12 12v9" />
    </>,
  ),
  wallet: icon(
    <>
      <path d="M4 7a2 2 0 0 1 2-2h11v4" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <circle cx="16.5" cy="13.5" r="1.2" />
    </>,
  ),
  sync: icon(
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 4v4.5h4.5" />
      <path d="M4 13a8 8 0 0 0 14.3 4.5l1.7-2M20 20v-4.5h-4.5" />
    </>,
  ),
  shield: icon(
    <>
      <path d="M12 3l7.5 3v5.5c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V6L12 3z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>,
  ),
  cal: icon(
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h3" />
    </>,
  ),
  bell: icon(
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
      <path d="M10 21h4" />
    </>,
  ),
  mail: icon(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>,
  ),
  lock: icon(
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>,
  ),
  eye: icon(
    <>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  eyeOff: icon(
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6a9.6 9.6 0 0 1 1.4-.1C18.4 5.9 22 12 22 12a17 17 0 0 1-3.2 3.9M6.6 7.6A17 17 0 0 0 2 12s3.6 6.1 10 6.1a9.5 9.5 0 0 0 3.6-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>,
  ),
};

const SLIDES = [
  { title: 'Every people process in one place', text: 'Onboarding, directory, performance, expenses and offboarding — connected, so nothing is entered twice.', centre: I.users, bubbles: [I.users, I.cube, I.sync, I.wallet] },
  { title: 'Leave & attendance by location', text: 'Working weeks, holidays and policies are set per location, with approvals in a single inbox.', centre: I.cal, bubbles: [I.users, I.cube, I.sync, I.wallet] },
  { title: 'Always up to date', text: 'Real-time records mean decisions are always based on the latest information.', centre: I.shield, bubbles: [I.users, I.cube, I.sync, I.wallet] },
  { title: 'Never miss a renewal', text: 'Visas, Emirates IDs, licences and insurance are tracked, with reminders before they expire.', centre: I.bell, bubbles: [I.users, I.cube, I.sync, I.wallet] },
];

const initials = (name: string) => {
  const words = name.trim().split(/\s+/);
  return (words.length === 1 ? words[0].slice(0, 2) : words.map((w) => w[0]).slice(0, 2).join('')).toUpperCase();
};

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<{ field: 'email' | 'password' | 'form'; msg: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  const [demo, setDemo] = useState(false);
  const [slide, setSlide] = useState(2);

  // Already signed in → straight to the app.
  useEffect(() => {
    if (auth.status === 'in') router.replace(safeNext(new URLSearchParams(window.location.search).get('next')));
  }, [auth.status, router]);

  useEffect(() => {
    const id = setTimeout(() => setSlide((s) => (s + 1) % SLIDES.length), 5500);
    return () => clearTimeout(id);
  }, [slide]);

  const submit = () => {
    setNotice('');
    const v = email.trim();
    if (!v) return setError({ field: 'email', msg: 'Enter your work email address.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError({ field: 'email', msg: 'That doesn’t look like an email address.' });
    const acc = accountFor(v);
    if (!acc) return setError({ field: 'email', msg: 'We couldn’t find an account with that email. Check it or contact your HR administrator.' });
    if (acc.employee.employmentStatus === 'Inactive') return setError({ field: 'email', msg: 'This account has been deactivated. Contact your HR administrator.' });
    if (!password) return setError({ field: 'password', msg: 'Enter your password.' });
    setError(null);
    setBusy(true);
    // No sign-in service is connected yet, so the session is created locally after a short pause.
    setTimeout(() => {
      signIn(v, remember);
      router.replace(safeNext(new URLSearchParams(window.location.search).get('next')));
    }, 650);
  };

  const pickDemo = (role: Role) => {
    const emp = EMPLOYEES.find((e) => e.id === PERSONAS[role].employeeId);
    if (!emp) return;
    setEmail(emp.email);
    if (!password) setPassword('demo1234');
    setError(null);
  };

  if (auth.status === 'in') return <div className="boot" aria-busy="true" />;

  const s = SLIDES[slide];
  const bad = (f: 'email' | 'password') => (error?.field === f ? 'bad' : '');

  return (
    <div className="sg">
      <div className="sg-wrap">
        <div className="sg-card">
          <section className="sg-left">
            <div className="sg-logo" aria-label="GS">
              <span>GS</span>
              <i>
                <b style={{ background: '#2b4a9b' }} />
                <b style={{ background: '#e5434e' }} />
                <b style={{ background: '#8bc53f' }} />
                <b style={{ background: '#1fa5a0' }} />
              </i>
            </div>
            <h1>Sign in</h1>
            <p className="sg-sub">to access GS HRMS</p>

            <button type="button" className="sg-ms" onClick={() => setNotice('Microsoft sign-in isn’t connected in this prototype. Use your work email and password below.')}>
              <svg viewBox="0 0 21 21" width="16" height="16" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Continue with Microsoft
            </button>
            {notice && <div className="sg-note warn">{notice}</div>}

            <div className="sg-or">
              <span>OR</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              noValidate
            >
              <label className="sg-lbl" htmlFor="sg-email">
                Email
              </label>
              <div className={`sg-field ${bad('email')}`}>
                {I.mail}
                <input
                  id="sg-email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error?.field === 'email') setError(null);
                  }}
                  placeholder="name@gs-it.ae"
                />
              </div>
              {error?.field === 'email' && <div className="sg-err">{error.msg}</div>}

              <div className="sg-lblrow">
                <label className="sg-lbl" htmlFor="sg-pass">
                  Password
                </label>
                <button type="button" className="sg-link" onClick={() => setForgot((v) => !v)}>
                  Forgot password?
                </button>
              </div>
              <div className={`sg-field ${bad('password')}`}>
                {I.lock}
                <input
                  id="sg-pass"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error?.field === 'password') setError(null);
                  }}
                  placeholder="Enter your password"
                />
                <button type="button" className="sg-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? I.eyeOff : I.eye}
                </button>
              </div>
              {error?.field === 'password' && <div className="sg-err">{error.msg}</div>}

              {forgot && (
                <div className="sg-note">
                  {sent ? (
                    <>
                      <b>Check your inbox.</b> If an account exists for {email.trim() || 'that email'}, a reset link would be sent. (Prototype — no email is sent.)
                    </>
                  ) : (
                    <>
                      We’ll send a password reset link to <b>{email.trim() || 'your work email'}</b>.{' '}
                      <button type="button" className="sg-link" onClick={() => setSent(true)}>
                        Send link
                      </button>
                    </>
                  )}
                </div>
              )}

              <label className="sg-check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span className="sg-box" aria-hidden="true" />
                Keep me signed in
              </label>

              <button type="submit" className="sg-next" disabled={busy}>
                {busy ? <span className="sg-spin" /> : 'Next'}
              </button>
            </form>

            <p className="sg-demo-note">
              Demo build — no password is checked until the sign-in service is connected.{' '}
              <button type="button" className="sg-link" onClick={() => setDemo((v) => !v)} aria-expanded={demo}>
                {demo ? 'Hide demo accounts' : 'Use a demo account'}
              </button>
            </p>
            {demo && (
              <div className="sg-accts">
                {DEMO_ROLES.map((r) => {
                  const emp = EMPLOYEES.find((e) => e.id === PERSONAS[r].employeeId);
                  if (!emp) return null;
                  return (
                    <button key={r} type="button" className={`sg-acct ${email.toLowerCase() === emp.email.toLowerCase() ? 'on' : ''}`} onClick={() => pickDemo(r)} title={emp.email}>
                      <span className="sg-av">{initials(emp.name)}</span>
                      <span className="sg-acct-t">
                        <b>{emp.name}</b>
                        <small>{emp.email}</small>
                      </span>
                      <em>{r}</em>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="sg-right" aria-label="About GS HRMS">
            <div className="sg-art" key={`art-${slide}`}>
              <span className="sg-bub b1">{s.bubbles[0]}</span>
              <span className="sg-bub b2">{s.bubbles[1]}</span>
              <span className="sg-bub b3">{s.bubbles[2]}</span>
              <span className="sg-bub b4">{s.bubbles[3]}</span>
              <div className="sg-halo">
                <div className="sg-tile">{s.centre}</div>
              </div>
            </div>
            <div className="sg-copy" key={`copy-${slide}`}>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              <button type="button" className="sg-more" onClick={() => setSlide((x) => (x + 1) % SLIDES.length)}>
                Learn more
              </button>
            </div>
            <div className="sg-dots">
              {SLIDES.map((x, i) => (
                <button key={x.title} type="button" className={i === slide ? 'on' : ''} onClick={() => setSlide(i)} aria-label={`Show: ${x.title}`} />
              ))}
            </div>
          </aside>
        </div>
        <footer className="sg-foot">© {new Date().getFullYear()}, {ENTITY_NAME}. All Rights Reserved.</footer>
      </div>
    </div>
  );
}
