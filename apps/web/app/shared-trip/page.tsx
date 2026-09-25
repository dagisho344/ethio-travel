import type { Metadata } from 'next';
import { SharedTripClient } from '../../components/trips/SharedTripClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Shared trip | EthioTravel',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default function SharedTripPage() {
  return <SharedTripClient />;
}
