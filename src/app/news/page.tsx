export default function NewsPage() {
  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8 px-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Latest News
          </h1>
          <p className="text-base-content/60 mt-1 font-medium">
            Updates from the National Poker League
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Featured Article */}
        <div className="card bg-base-100 shadow-xl border border-white/5 lg:col-span-2 overflow-hidden group cursor-pointer">
          <div className="h-64 bg-neutral flex items-center justify-center text-base-content/20 bg-cover bg-center" style={{backgroundImage: 'url(/poker-hero.jpg)'}}>
            {/* Image Placeholder */}
          </div>
          <div className="card-body">
            <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Featured</div>
            <h2 className="card-title text-3xl font-black italic group-hover:text-primary transition-colors">
              Season 8 Grand Final Announced
            </h2>
            <p className="text-base-content/70 mt-2">
              The dates are set for the biggest showdown of the year. Join us in London for the final event...
            </p>
            <div className="card-actions justify-end mt-4">
              <button className="btn btn-ghost btn-sm uppercase font-bold">Read More →</button>
            </div>
          </div>
        </div>

        {/* Smaller Articles */}
        {[1, 2].map((i) => (
          <div key={i} className="card bg-base-100 shadow-lg border border-white/5 hover:border-primary/30 transition-all cursor-pointer">
            <div className="card-body">
              <div className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Tournament Report</div>
              <h3 className="card-title text-xl font-bold">GUKPT Leeds: Weekend Recap</h3>
              <p className="text-sm text-base-content/60 mt-2">
                A stunning victory for the underdog as chips flew in the final table...
              </p>
              <div className="mt-4 text-xs font-mono opacity-50">Oct 12, 2025</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}