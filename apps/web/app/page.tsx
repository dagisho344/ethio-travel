const categories = [
  'Hotels',
  'Restaurants',
  'Attractions',
  'Tours',
  'Transport',
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-highland">
          Phase 0 Foundation
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-normal text-slate-950 sm:text-6xl">
          EthioTravel
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
          A foundation for Ethiopia-focused travel discovery, verified local
          businesses, bookings, and trip planning.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-5">
          {categories.map((category) => (
            <div
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm"
              key={category}
            >
              {category}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
