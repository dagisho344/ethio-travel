import { Map } from 'lucide-react';
import { Container } from '../../components/ui/Container';
import { CardSkeleton, SectionHeading } from '../../components/ui/States';

export default function DestinationsLoading() {
  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Destinations"
          title="Explore Destinations"
          description="Find published places across active Ethiopian cities and regions."
        />
        <div className="mb-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(220px,1fr)_220px_220px_auto] lg:items-end">
          <div className="h-16 rounded-md bg-slate-100" />
          <div className="h-16 rounded-md bg-slate-100" />
          <div className="h-16 rounded-md bg-slate-100" />
          <div className="flex h-11 items-center justify-center rounded-md bg-highland/20 text-highland">
            <Map className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </Container>
    </main>
  );
}
