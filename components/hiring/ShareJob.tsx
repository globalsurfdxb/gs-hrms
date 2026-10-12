'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Card';
import { useCurrentEmployee } from '@/context/AppContext';
import { BOARDS, acceptingApplications, careersPath } from '@/components/hiring/Careers';
import { Job } from '@/lib/hiringTypes';

/** Copies text; falls back to selecting it when the clipboard API is blocked. */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Link box with a Copy button. */
export function LinkBox({ label, url, hint }: { label: string; url: string; hint?: string }) {
  const [ok, setOk] = useState<'' | 'copied' | 'manual'>('');
  return (
    <div className="fg full">
      <label>{label}</label>
      <div className="hm-linkbox">
        <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label={label} />
        <Button
          size="sm"
          variant="primary"
          onClick={async () => setOk((await copy(url)) ? 'copied' : 'manual')}
        >
          {ok === 'copied' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {ok === 'manual' && <span className="hint">Copy is blocked here: select the link and press Ctrl+C.</span>}
      {hint && ok !== 'manual' && <span className="hint">{hint}</span>}
    </div>
  );
}

/** Share a job: the public apply link, quick share buttons, and the person's own referral link. */
export function ShareJobDrawer({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  const me = useCurrentEmployee();
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const live = acceptingApplications(job);
  const link = `${origin}${careersPath(job)}`;
  const refLink = `${origin}${careersPath(job, me.employeeCode)}`;
  const place = job.location === 'Kochi' ? 'Kochi, India' : 'Dubai, UAE';
  const text = `We're hiring: ${job.title} (${job.department}, ${place}). Apply here: ${link}`;
  const enc = encodeURIComponent;
  const [copied, setCopied] = useState(false);
  const boardLink = (id: string) => `${origin}${careersPath(job, undefined, id)}`;
  // Plain text to paste into a job board's "Post a job" form.
  const posting = [
    job.title,
    `${place} · ${job.employmentType}`,
    '',
    'About the role',
    job.description,
    '',
    `Key skills: ${job.skills.join(', ')}`,
    `Experience: ${job.expMin}–${job.expMax} years`,
    job.qualifications ? `Qualifications: ${job.qualifications}` : '',
    '',
    `Apply: ${boardLink('indeed')}`,
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Share ${job.title}`}
      description={`${job.code} · anyone with the link can read the role and apply, no sign-in needed.`}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      }
    >
      {!live && (
        <div className="note-box hm-warn" style={{ marginBottom: 14 }}>
          <div>
            {job.status === 'Open' ? 'The closing date has passed' : `This job is ${job.status.toLowerCase()}`}, so the link shows “no longer accepting applications”. Open the job (and set a future closing date) before sharing.
          </div>
        </div>
      )}
      <div className="form-grid hm-form">
        <LinkBox label="Public application link" url={link} hint="Put it on your careers page, a LinkedIn post, a job board or an email." />
        <div className="fg full">
          <label>Share on</label>
          <div className="hm-share">
            <a className="btn sm ghost" href={`mailto:?subject=${enc(`Job opening: ${job.title}`)}&body=${enc(text)}`}>
              Email
            </a>
            <a className="btn sm ghost" href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(link)}`} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a className="btn sm ghost" href={`https://wa.me/?text=${enc(text)}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a className="btn sm ghost" href={link} target="_blank" rel="noreferrer">
              Preview page
            </a>
          </div>
        </div>
        <div className="fg full">
          <label>Post on job boards</label>
          <p className="hint" style={{ margin: '0 0 8px' }}>
            In the board&apos;s “Post a job” form, paste the job text and use that board&apos;s link as the apply link. Applicants who come through it are labelled with that source.
          </p>
          <div className="hm-boards">
            {BOARDS.map((b) => (
              <LinkBox key={b.id} label={`${b.label} apply link`} url={boardLink(b.id)} />
            ))}
          </div>
          <div className="hm-share" style={{ marginTop: 10 }}>
            <Button
              size="sm"
              onClick={async () => {
                setCopied(await copy(posting));
              }}
            >
              {copied ? 'Job text copied' : 'Copy job text for a job board'}
            </Button>
            <a className="btn sm ghost" href="https://employers.indeed.com/" target="_blank" rel="noreferrer">
              Open Indeed for employers
            </a>
          </div>
          <span className="hint">These links only work for applicants once the app is on a public web address; on localhost they open on this computer only.</span>
        </div>
        {job.referralEligible && (
          <LinkBox label="Your referral link" url={refLink} hint="Applications that come through this link are credited to you as an employee referral." />
        )}
        <div className="fg full">
          <div className="note-box">
            <div>
              Applications from the link land in this job&apos;s pipeline at <b>Applied</b>, with the source set to Careers Page (or Employee Referral when a referral link is used). People already in the system are matched by email or phone and added to this job instead of duplicated.
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
