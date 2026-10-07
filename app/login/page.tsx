'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EMPLOYEES, PERSONAS } from '@/lib/data';
import { Role } from '@/lib/types';
import { accountFor, safeNext, signIn, useAuth } from '@/lib/auth';

const DEMO_ROLES: Role[] = ['Super Admin', 'HR', 'Office Admin', 'Team Lead', 'Employee'];

const SLIDES = [
  { title: 'Every people process in one place', text: 'Onboarding, directory, performance, expense claims and offboarding — connected, so nothing is re-entered.', tag: 'Employee Management' },
  { title: 'Leave & attendance that follows each location', text: 'Working weeks, holidays, shifts and policies set per location, with approvals in a single inbox.', tag: 'Leave & Attendance' },
  { title: 'Never miss a renewal again', text: 'Visas, Emirates IDs, licences and insurance tracked with reminders before they expire.', tag: 'Renewal Management' },
];

const initials = (name: string) => {
  const words = name.trim().split(/\s+/);
  return (words.length === 1 ? words[0].slice(0, 2) : words.map((w) => w[0]).slice(0, 2).join('')).toUpperCase();
};

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  const [slide, setSlide] = useState(0);
  const passRef = useRef<HTMLInputElement>(null);

  const account = accountFor(email);

  // Already signed in → straight to the app.
  useEffect(() => {
    if (auth.status === 'in') router.replace(safeNext(new URLSearchParams(window.location.search).get('next')));
  }, [auth.status, router]);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (step === 'password') passRef.current?.focus();
  }, [step]);

  const next = () => {
    const v = email.trim();
    if (!v) return setError('Enter your work email address.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError('That doesn’t look like an email address.');
    const acc = accountFor(v);
    if (!acc) return setError('We couldn’t find an account with that email. Check it or contact your HR administrator.');
    if (acc.employee.employmentStatus === 'Inactive') return setError('This account has been deactivated. Contact your HR administrator.');
    setError('');
    setForgot(false);
    setSent(false);
    setStep('password');
  };

  const submit = () => {
    if (!password) return setError('Enter your password.');
    setError('');
    setBusy(true);
    // No sign-in service is connected yet, so the session is created locally after a short pause.
    setTimeout(() => {
      signIn(email, remember);
      router.replace(safeNext(new URLSearchParams(window.location.search).get('next')));
    }, 650);
  };

  const pickDemo = (role: Role) => {
    const emp = EMPLOYEES.find((e) => e.id === PERSONAS[role].employeeId);
    if (!emp) return;
    setEmail(emp.email);
    setError('');
    setStep('email');
  };

  if (auth.status === 'in') return <div className="boot" aria-busy="true" />;

  return (
    <div className="lg">
      <section className="lg-left">
        <div className="lg-top">
          <div className="lg-logo">GS</div>
          <div>
            <div className="lg-brand">Global Surf IT</div>
            <div className="lg-prod">GSIT ERP</div>
          </div>
        </div>

        <div className="lg-form">
          <h1>Sign in</h1>
          <p className="lg-sub">Use your work email to continue to GSIT ERP.</p>

          {step === 'email' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
              noValidate
            >
              <label className="lg-lbl" htmlFor="lg-email">
                Work email
              </label>
              <input
                id="lg-email"
                className={`lg-in ${error ? 'bad' : ''}`}
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="name@gs-it.ae"
              />
              {error && <div className="lg-err">{error}</div>}
              <button type="submit" className="lg-btn">
                Next
              </button>

              <div className="lg-or">
                <span>Demo accounts</span>
              </div>
              <div className="lg-demo">
                {DEMO_ROLES.map((r) => {
                  const emp = EMPLOYEES.find((e) => e.id === PERSONAS[r].employeeId);
                  if (!emp) return null;
                  return (
                    <button key={r} type="button" className={`lg-chip ${email.toLowerCase() === emp.email.toLowerCase() ? 'on' : ''}`} onClick={() => pickDemo(r)} title={emp.email}>
                      <span className="lg-chip-av">{initials(emp.name)}</span>
                      <span className="lg-chip-t">
                        <b>{emp.name}</b>
                        <small>{emp.email}</small>
                      </span>
                      <em className="lg-role">{r}</em>
                    </button>
                  );
                })}
              </div>
              <p className="lg-note">This is a prototype: choose a demo account above, or type any registered work email. No password is checked until the sign-in service is connected.</p>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              noValidate
            >
              <div className="lg-acc">
                <span className="lg-acc-av">{account ? initials(account.employee.name) : '?'}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="lg-acc-n">{account?.employee.name}</div>
                  <div className="lg-acc-e">{email.trim().toLowerCase()}</div>
                </div>
                <button
                  type="button"
                  className="lg-link"
                  onClick={() => {
                    setStep('email');
                    setPassword('');
                    setError('');
                  }}
                >
                  Change
                </button>
              </div>

              <div className="lg-lblrow">
                <label className="lg-lbl" htmlFor="lg-pass">
                  Password
                </label>
                <button type="button" className="lg-link" onClick={() => setForgot((v) => !v)}>
                  Forgot password?
                </button>
              </div>
              <div className="lg-pw">
                <input
                  id="lg-pass"
                  ref={passRef}
                  className={`lg-in ${error ? 'bad' : ''}`}
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your password"
                />
                <button type="button" className="lg-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
              {error && <div className="lg-err">{error}</div>}

              {forgot && (
                <div className="lg-forgot">
                  {sent ? (
                    <>
                      <b>Check your inbox.</b> If an account exists for {email.trim().toLowerCase()}, a reset link would be sent. <span style={{ color: 'var(--faint)' }}>(Prototype — no email is actually sent.)</span>
                    </>
                  ) : (
                    <>
                      We’ll send a password reset link to <b>{email.trim().toLowerCase()}</b>.
                      <button type="button" className="lg-btn sm" onClick={() => setSent(true)}>
                        Send reset link
                      </button>
                    </>
                  )}
                </div>
              )}

              <label className="lg-check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Keep me signed in on this device
              </label>

              <button type="submit" className="lg-btn" disabled={busy}>
                {busy ? <span className="lg-spin" /> : 'Sign in'}
              </button>
              <p className="lg-note">Signing in as {account?.role}. Prototype: any password is accepted.</p>
            </form>
          )}
        </div>

        <div className="lg-foot">
          <span>© {new Date().getFullYear()} Global Surf IT</span>
          <span className="lg-dots">·</span>
          <button type="button" className="lg-link muted" onClick={() => setForgot(false)}>
            Privacy
          </button>
          <span className="lg-dots">·</span>
          <button type="button" className="lg-link muted">
            Terms
          </button>
        </div>
      </section>

      <aside className="lg-right" aria-hidden="true">
        <div className="lg-orb a" />
        <div className="lg-orb b" />
        <div className="lg-mock">
          <div className="lg-card c1">
            <span className="lg-ci g">✓</span>
            <div>
              <b>Leave approved</b>
              <small>Nived · 3 days · Annual leave</small>
            </div>
          </div>
          <div className="lg-card c2">
            <div className="lg-dash-h">
              <b>Attendance today</b>
              <span>Dubai · Mon–Fri</span>
            </div>
            <div className="lg-kpis">
              <div>
                <strong>86%</strong>
                <small>Present</small>
              </div>
              <div>
                <strong>9</strong>
                <small>On leave</small>
              </div>
              <div>
                <strong>4</strong>
                <small>Approvals</small>
              </div>
            </div>
            <div className="lg-bars">
              {[48, 62, 55, 70, 66, 82, 74].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="lg-bar">
              <i style={{ width: '62%', background: '#34d399' }} />
              <i style={{ width: '20%', background: '#60a5fa' }} />
              <i style={{ width: '10%', background: '#fbbf24' }} />
              <i style={{ width: '8%', background: '#f87171' }} />
            </div>
            <div className="lg-legend">In office · WFH · Leave · Absent</div>
          </div>
          <div className="lg-card c3">
            <span className="lg-ci a">!</span>
            <div>
              <b>Residence visa renewal</b>
              <small>Due in 14 days · reminder sent</small>
            </div>
          </div>
        </div>

        <div className="lg-copy" key={slide}>
          <span className="lg-tag">{SLIDES[slide].tag}</span>
          <h2>{SLIDES[slide].title}</h2>
          <p>{SLIDES[slide].text}</p>
          <div className="lg-pager">
            {SLIDES.map((s, i) => (
              <span key={s.tag} className={i === slide ? 'on' : ''} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
