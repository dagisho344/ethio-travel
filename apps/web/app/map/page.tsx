import { redirect } from 'next/navigation';

export default function MapPage() {
  redirect('/search?view=map');
}
