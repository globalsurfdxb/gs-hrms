import { redirect } from 'next/navigation';

/* Employee Separation was merged into Offboarding (its register is now the "Register" view there). */
export default function EmployeeSeparationRedirect() {
  redirect('/offboarding');
}
