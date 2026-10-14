'use client';

import { fullDocument } from '@/lib/hiringLetters';

/** Shows an offer letter as a page, on its letterhead. The letter is rendered inside a sandboxed frame, so nothing in
    an uploaded template can run script or reach the rest of the app. */
export function LetterFrame({ html, title = 'Offer letter', height = 560, location }: { html: string; title?: string; height?: number | string; location?: string }) {
  return <iframe className="hm-letter" title={title} sandbox="allow-same-origin" srcDoc={fullDocument(html, title, location)} style={{ height }} />;
}
