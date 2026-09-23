import { redirect } from 'next/navigation';
import { publicSearchParamKeys } from '../../lib/public-discovery-query';

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const source = await searchParams;
  const query = new URLSearchParams();
  for (const key of publicSearchParamKeys) {
    const value = source[key];
    if (typeof value === 'string' && value) query.set(key, value);
  }
  const suffix = query.toString();
  redirect(suffix ? `/search?${suffix}` : '/search');
}
