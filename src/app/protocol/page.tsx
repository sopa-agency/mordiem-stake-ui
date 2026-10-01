import type { Metadata } from 'next';
import { ProtocolView } from '@/components/ProtocolView';

export const metadata: Metadata = { title: 'Protocol' };

export default function ProtocolPage() {
  return <ProtocolView />;
}
