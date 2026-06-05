export default function PeoplePage() {
  return (
    <main className="flex-1">
      <div className="navy-texture relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--akp-gold) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-8" style={{ background: "var(--akp-gold)" }} />
            <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: "var(--akp-gold)" }}>
              Alpha Kappa Psi · AKPD
            </span>
          </div>
          <h1
            className="text-5xl sm:text-6xl font-extrabold leading-[1.05] text-white mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Our
            <br />
            <span style={{ color: "var(--akp-gold)" }}>People.</span>
          </h1>
          <p className="text-blue-200 text-lg max-w-lg leading-relaxed">
            Meet the members of Alpha Kappa Psi — their roles, stories, and what they bring to the chapter.
          </p>
        </div>
        <div className="h-[3px]" style={{ background: "var(--akp-gold)" }} />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold mb-8"
          style={{
            background: "rgba(201,168,76,0.1)",
            color: "var(--akp-gold)",
            border: "1px solid rgba(201,168,76,0.25)",
          }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--akp-gold)" }} />
          Coming soon
        </div>
        <h2
          className="text-3xl font-extrabold mb-4"
          style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
        >
          Member directory launching soon
        </h2>
        <p className="text-base max-w-md mx-auto leading-relaxed" style={{ color: "var(--akp-gray-600)" }}>
          Browse every member of AKPD — photos, bios, pledge classes, and the roles they've held in the chapter.
        </p>
      </div>
    </main>
  );
}
