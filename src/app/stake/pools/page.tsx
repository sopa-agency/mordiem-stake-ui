import type { Metadata } from 'next';
import { PoolsTab } from '@/components/Tabs';

export const metadata: Metadata = { title: 'Capital pools' };

export default function PoolsPage() {
  return <PoolsTab />;
}
