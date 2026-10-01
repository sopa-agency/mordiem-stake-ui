import type { Metadata } from 'next';
import { CreditTab } from '@/components/Tabs';

export const metadata: Metadata = { title: 'Credit' };

export default function CreditPage() {
  return <CreditTab />;
}
