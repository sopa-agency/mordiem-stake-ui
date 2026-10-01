import { redirect } from 'next/navigation';

/** The old Positions page: its content lives on the Overview now. */
export default function PositionsPage() {
  redirect('/');
}
