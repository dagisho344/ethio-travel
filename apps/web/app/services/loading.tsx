import { Sparkles } from 'lucide-react';
import { Container } from '../../components/ui/Container';
import { CardSkeleton, SectionHeading } from '../../components/ui/States';

export default function ServicesLoading() {
  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="SERVICES"
          title="Published Services"
          description="Browse available travel experiences and services from verified local businesses."
        />
        <div className="mb-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_190px_170px_110px_110px_auto] xl:items-end">
          <div className="h-16 rounded-md bg-slate-100 md:col-span-2 xl:col-span-1" />
          <div className="h-16 rounded-md bg-slate-100" />
          <div className="h-16 rounded-md bg-slate-100" />
          <div className="h-16 rounded-md bg-slate-100" />
          <div className="h-16 rounded-md bg-slate-100" />
          <div className="h-16 rounded-md bg-slate-100" />
          <div className="h-16 rounded-md bg-slate-100" />
          <div className="flex h-11 items-center justify-center rounded-md bg-highland/20 text-highland md:col-span-2 xl:col-span-1">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
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
