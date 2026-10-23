'use client';

import { useEffect, useRef, useState } from 'react';
import { LetterFrame } from '@/components/hiring/LetterFrame';
import { LETTER_PAGE, LetterPlan, pageDocument, planLetter } from '@/lib/hiringLetters';

/** The letter laid out page by page, the way it prints and downloads: each page is an A4 sheet with the letterhead at
    the top and the footer at the bottom, and the text moves to the next page when a page is full. With `fit`, the pages
    shrink to the width of their container (for phones) instead of scrolling sideways. */
export function PagedLetter({ html, title = 'Offer letter', location, companyId, fit }: { html: string; title?: string; location?: string; companyId?: string; fit?: boolean }) {
  const [plan, setPlan] = useState<LetterPlan | null>(null);
  const [zoom, setZoom] = useState(1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    planLetter(html, location, companyId)
      .then((p) => alive && setPlan(p))
      .catch(() => alive && setPlan(null));
    return () => {
      alive = false;
    };
  }, [html, location, companyId]);

  useEffect(() => {
    if (!fit || !box.current) return;
    const el = box.current;
    const measure = () => setZoom(Math.min(1, (el.clientWidth - 2) / LETTER_PAGE.width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, plan]);

  // Until the pages are worked out (or if that fails), show the letter as one long sheet.
  if (!plan) return <LetterFrame html={html} title={title} autoHeight location={location} companyId={companyId} />;
  return (
    <div ref={box} className={fit ? 'olm-fit' : undefined}>
      <div className="olm-pages" style={fit && zoom < 1 ? ({ zoom } as React.CSSProperties) : undefined} aria-label={`${plan.pages.length} page${plan.pages.length === 1 ? '' : 's'}`}>
        {plan.pages.map((_, i) => (
          <figure key={i} className="olm-page">
            <iframe title={`${title}, page ${i + 1} of ${plan.pages.length}`} sandbox="allow-same-origin" srcDoc={pageDocument(plan, i, title)} style={{ width: LETTER_PAGE.width, height: LETTER_PAGE.height }} />
            <figcaption>
              Page {i + 1} of {plan.pages.length}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
