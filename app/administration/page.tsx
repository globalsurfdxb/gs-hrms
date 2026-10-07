import { ADMIN } from '@/lib/nav';
import { HubGrid } from '@/components/shell/HubGrid';

export default function AdministrationPage() {
  return (
    <div className="ops-wrap">
      <div className="ops-head">
        <h1>Administration</h1>
        <div className="sub">Common to every module — roles, permissions, workflow rules, notifications and system-wide settings.</div>
      </div>
      <HubGrid sections={ADMIN} hub="/administration" />
    </div>
  );
}
