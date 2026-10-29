'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TEXTAREA_STYLE, useActor } from '@/components/hiring/HiringBits';
import { appById, candById, offerById, useHiring, withdrawAcceptedOffer } from '@/lib/hiringStore';

const REASONS = ['Accepted another offer', 'Changed their mind', 'Counter-offer from current employer', 'Personal or family reasons', 'Could not agree on joining date', 'Other'];

/** Closes an accepted offer the candidate has backed out of. It asks for the reason, then removes the candidate from
    onboarding and opens the position again. */
export function WithdrawOfferDialog({ offerId, onClose, onDone }: { offerId: string | null; onClose: () => void; onDone: (text: string, ok: boolean) => void }) {
  const s = useHiring();
  const actor = useActor();
  const offer = offerId ? offerById(s, offerId) : undefined;
  const cand = offer ? candById(s, appById(s, offer.applicationId)?.candidateId ?? '') : undefined;
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  return (
    <ConfirmDialog
      open={!!offer}
      title="Candidate backed out?"
      confirmLabel="Remove from onboarding"
      danger
      onCancel={() => {
        setError('');
        onClose();
      }}
      onConfirm={() => {
        if (!offer) return;
        const text = reason === 'Other' ? note.trim() : note.trim() ? `${reason}: ${note.trim()}` : reason;
        const r = withdrawAcceptedOffer(offer.id, text, actor);
        if (!r.ok) return setError(r.error);
        setError('');
        setNote('');
        onDone(`${cand?.name ?? 'The candidate'} was removed from onboarding. ${offer.code} is closed as declined and the position is open again.`, true);
      }}
      message={
        <div style={{ display: 'grid', gap: 10, textAlign: 'left' }}>
          <span>
            {cand?.name ?? 'This candidate'} accepted {offer?.code}, then decided not to join. The offer is closed as declined, they leave the Hired column and onboarding, and the position counts as open again.
          </span>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            {reason === 'Other' ? 'Details (required)' : 'Details (optional)'}
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={TEXTAREA_STYLE} />
          </label>
          {error && <span style={{ color: '#B91C1C', fontSize: 13, fontWeight: 600 }}>{error}</span>}
        </div>
      }
    />
  );
}
