'use client';

import { useState } from 'react';
import { fullDocument } from '@/lib/hiringLetters';

/** Shows an offer letter as a page, on its letterhead. The letter is rendered inside a sandboxed frame, so nothing in
    an uploaded template can run script or reach the rest of the app. With `autoHeight` the frame grows to the whole
    letter, so a surrounding panel does the scrolling instead of the frame. With `editable` the body of the letter (not
    the letterhead) can be edited in place; read it back with {@link readEditedBody}. */
export function LetterFrame({
  html,
  title = 'Offer letter',
  height = 560,
  location,
  companyId,
  autoHeight,
  editable,
  frameRef,
}: {
  html: string;
  title?: string;
  height?: number | string;
  location?: string;
  companyId?: string;
  autoHeight?: boolean;
  editable?: boolean;
  frameRef?: React.Ref<HTMLIFrameElement>;
}) {
  const [grown, setGrown] = useState<number | null>(null);
  return (
    <iframe
      ref={frameRef}
      className="hm-letter"
      title={title}
      sandbox="allow-same-origin"
      srcDoc={fullDocument(html, title, location, companyId)}
      style={{ height: autoHeight ? (grown ?? height) : height, border: autoHeight ? 0 : undefined, borderRadius: autoHeight ? 0 : undefined }}
      onLoad={(e) => {
        const doc = e.currentTarget.contentDocument;
        if (!doc) return;
        const resize = () => autoHeight && setGrown(doc.documentElement.scrollHeight + 4);
        if (editable) {
          const body = doc.querySelector<HTMLElement>('.lh-body');
          if (body) {
            body.contentEditable = 'true';
            body.spellcheck = true;
            body.style.outline = '2px dashed #28469a';
            body.style.outlineOffset = '-2px';
            body.style.minHeight = '320px';
            doc.addEventListener('input', resize);
          }
        }
        resize();
      }}
    />
  );
}

/** The edited body of a letter shown in an editable {@link LetterFrame}, or null when it is not there. */
export function readEditedBody(frame: HTMLIFrameElement | null): string | null {
  return frame?.contentDocument?.querySelector('.lh-body')?.innerHTML ?? null;
}

/** Runs a formatting command (bold, list, undo…) in the letter being edited. */
export function formatEdited(frame: HTMLIFrameElement | null, command: string) {
  const doc = frame?.contentDocument;
  if (!doc) return;
  frame.contentWindow?.focus();
  doc.execCommand(command);
}
