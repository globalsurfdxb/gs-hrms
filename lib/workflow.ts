/* Approval chains as configured under Administration → Workflow Settings. Screens that route work through a chain
   (for example the onboarding review step) read the steps from here so they never drift from the settings page. */

export interface WorkflowChain {
  key: string;
  title: string;
  steps: string[];
}

export const WORKFLOW_CHAINS: WorkflowChain[] = [
  { key: 'onboarding', title: 'Onboarding', steps: ['HR initiates', 'Manager review', 'HR approval', 'Payroll notified'] },
  { key: 'offboarding', title: 'Offboarding', steps: ['Resignation logged', 'Manager clearance', 'IT clearance', 'Finance clearance', 'HR final approval'] },
  { key: 'requests', title: 'Employee Requests', steps: ['Employee raises', 'Routed to HR / Manager', 'Approved or rejected'] },
];

export const chainSteps = (key: string): string[] => WORKFLOW_CHAINS.find((c) => c.key === key)?.steps ?? [];
