import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAddress, isAddress } from 'viem';
import { Dashboard } from '@/components/Dashboard';

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  return { title: isAddress(address, { strict: false }) ? `Viewing ${address.slice(0, 6)}…${address.slice(-4)}` : 'Not found' };
}

export default async function AddressPage({ params }: Props) {
  const { address } = await params;
  if (!isAddress(address, { strict: false })) notFound();
  return <Dashboard address={getAddress(address)} readOnly />;
}
