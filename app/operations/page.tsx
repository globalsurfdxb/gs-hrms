import { OPS } from '@/lib/nav';
import { HubGrid } from '@/components/shell/HubGrid';

export default function OperationsPage() {
  return (
    <div className="ops-wrap">
      <div className="ops-head">
        <h1>Operations</h1>
        <div className="sub">Management hub — employee lifecycle, documents and expense claims.</div>
      </div>
      <HubGrid sections={OPS} hub="/operations" />
    </div>
  );
}
