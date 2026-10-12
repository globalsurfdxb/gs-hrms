import { redirect } from 'next/navigation';

/** The module opens on its dashboard: /hiring/dashboard. */
export default function HiringIndex() {
  redirect('/hiring/dashboard');
}
