import type { Metadata } from 'next';
import { McuTab } from '@/components/Tabs';

export const metadata: Metadata = { title: 'MCU' };

export default function McuPage() {
  return <McuTab />;
}
