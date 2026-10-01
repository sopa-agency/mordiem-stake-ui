import type { Metadata } from 'next';
import { StakeTab } from '@/components/Tabs';

export const metadata: Metadata = { title: 'Stake MDM' };

export default function StakePage() {
  return <StakeTab />;
}
