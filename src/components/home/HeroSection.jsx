import { Link } from 'react-router-dom'

function NetworkGraphic() {
  const nodes = [
    { x: 60, y: 70, r: 5 },
    { x: 160, y: 40, r: 7 },
    { x: 230, y: 110, r: 4 },
    { x: 130, y: 150, r: 6 },
    { x: 40, y: 180, r: 4 },
    { x: 210, y: 200, r: 5 },
    { x: 280, y: 60, r: 4 },
  ]
  const edges = [
    [0, 1],
    [1, 2],
    [1, 3],
    [3, 4],
    [3, 5],
    [2, 6],
    [2, 5],
  ]

  return (
    <svg
      viewBox="0 0 320 240"
      className="h-auto w-full max-w-md text-teal-100"
      aria-hidden="true"
    >
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
      {nodes.map((node, i) => (
        <circle
          key={i}
          cx={node.x}
          cy={node.y}
          r={node.r}
          className={i === 1 ? 'text-gold-500' : 'text-teal-300'}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-ink">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-300">
            Peer-reviewed &middot; Open access &middot; Est. 2026
          </p>

          <h1 className="mt-5 font-serif text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Where medical research reaches the people who need it.
          </h1>

          <p className="mt-6 max-w-lg text-base text-slate-300 sm:text-lg">
            MedPublish helps researchers, clinicians, and academics discover
            trusted studies, share their own work, and publish openly for a
            global audience — without the friction of legacy publishing
            systems.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/library"
              className="inline-flex items-center justify-center rounded-lg bg-gold-500 px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-gold-600"
            >
              Explore Research
            </Link>
            <Link
              to="/submit"
              className="inline-flex items-center justify-center rounded-lg border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/50"
            >
              Submit Your Research
            </Link>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <NetworkGraphic />
        </div>
      </div>
    </section>
  )
}

export default HeroSection
