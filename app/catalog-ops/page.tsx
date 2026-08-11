import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  CATALOG_OPS_COOKIE,
  catalogOpsAuthConfigured,
  hasCatalogOpsAccess,
} from '@/lib/catalog-ops-auth';
import {
  getCatalogOpsStatus,
  type CatalogOpsQueue,
  type CatalogOpsSeverity,
} from '@/lib/catalog-ops-status';

export const dynamic = 'force-dynamic';

const severityStyles: Record<CatalogOpsSeverity, string> = {
  healthy: 'border-[#9cc6ac] bg-[#edf8f0] text-[#1e6240]',
  warning: 'border-[#dec889] bg-[#fff8df] text-[#785b10]',
  critical: 'border-[#e0aaaa] bg-[#fff0f0] text-[#8f2929]',
  unknown: 'border-[#c8cbc8] bg-[#f3f4f3] text-[#5b615d]',
};

function shortDate(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
    : 'Unknown';
}

function percent(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

export default async function CatalogOpsPage() {
  if (!catalogOpsAuthConfigured()) redirect('/catalog-ops/login');
  const headerStore = await headers();
  const cookieStore = await cookies();
  if (!hasCatalogOpsAccess({
    authorization: headerStore.get('authorization'),
    sessionCookie: cookieStore.get(CATALOG_OPS_COOKIE)?.value,
  })) {
    redirect('/catalog-ops/login');
  }

  const status = getCatalogOpsStatus();
  const maxStage = Math.max(...status.stages.map((stage) => stage.count), 1);
  const outcomeTotal = Math.max(Object.values(status.health.outcomes).reduce((sum, count) => sum + count, 0), 1);

  return (
    <main className="min-h-screen bg-[#f4f0e9] px-4 py-6 text-[#171a18] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-5 rounded-[26px] border border-[#d7d1c5] bg-[#fffefa] p-6 shadow-[0_20px_60px_rgba(45,49,46,.08)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#5d6e64]">Catalog operations</p>
              <StatusPill severity={status.overall}>{status.overall}</StatusPill>
              <StatusPill severity="unknown">{status.dataMode.replace('-', ' ')}</StatusPill>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Publishability and pipeline health</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5e655f]">
              Summary-first view of inventory flow, verified availability, review queues, source health, and release guards. Snapshot {shortDate(status.generatedAt)}.
            </p>
          </div>
          <form action="/api/catalog-ops/session" method="post">
            <input type="hidden" name="action" value="logout" />
            <button className="rounded-xl border border-[#c5c7c3] bg-white px-4 py-2 text-sm font-bold hover:bg-[#f4f5f3]" type="submit">Sign out</button>
          </form>
        </header>

        <section aria-label="Primary catalog health metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Client candidates" value={status.shrinkGuard.candidateCount.toLocaleString()} detail={`${status.shrinkGuard.delta >= 0 ? '+' : ''}${status.shrinkGuard.delta} vs last build evidence`} severity={status.shrinkGuard.passes ? 'healthy' : 'critical'} />
          <MetricCard label="Reviewable candidates" value={status.health.reviewCandidates.toLocaleString()} detail={`${status.health.exactPdpCandidates.toLocaleString()} own exact PDP links`} severity={status.health.reviewCandidates ? 'warning' : 'critical'} />
          <MetricCard label="Served / published" value={status.health.servedPublishedProducts.toLocaleString()} detail="strict fresh-positive shopping set" severity={status.health.meetsServedFreshCoverageTarget ? 'healthy' : 'critical'} />
          <MetricCard label="Served freshness" value={percent(status.health.servedFreshCoveragePct)} detail={`target ${status.health.targetServedFreshCoveragePct}%`} severity={status.health.meetsServedFreshCoverageTarget ? 'healthy' : 'critical'} />
          <MetricCard label="Candidate review coverage" value={percent(status.health.candidateReviewCoveragePct)} detail={`${status.health.candidateFreshChecked.toLocaleString()} checked within 24h · non-blocking throughput`} severity={status.health.meetsCandidateReviewCoverageTarget ? 'healthy' : 'warning'} />
          <MetricCard label="Withheld / retired" value={`${status.health.withheldCandidateProducts.toLocaleString()} / ${status.health.retiredProducts.toLocaleString()}`} detail="review queue / known unavailable" severity={status.health.withheldCandidateProducts || status.health.retiredProducts ? 'warning' : 'healthy'} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
          <Panel title="Catalog stage funnel" subtitle="Candidate, review, strict served, withheld, and retired sets are intentionally separate.">
            <div className="space-y-4">
              {status.stages.map((stage) => (
                <div key={stage.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-4">
                    <div>
                      <span className="font-black">{stage.label}</span>
                      <span className="ml-2 text-xs text-[#69716b]">{stage.detail}</span>
                    </div>
                    <span className="font-mono text-sm font-black">{stage.count.toLocaleString()}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#e4e1db]">
                    <div className={`h-full rounded-full ${stage.status === 'critical' ? 'bg-[#b54d4d]' : stage.status === 'warning' ? 'bg-[#c49a36]' : 'bg-[#2f7455]'}`} style={{ width: `${Math.max(1, (stage.count / maxStage) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Release guard" subtitle="Candidate and served-set shrink are guarded separately; candidate review coverage remains visible without weakening serving.">
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="Candidate baseline" value={status.shrinkGuard.baselineCount} />
              <MiniMetric label="Candidate now" value={status.shrinkGuard.candidateCount} />
              <MiniMetric label="Served baseline" value={status.servingShrinkGuard.baselineCount} />
              <MiniMetric label="Served now" value={status.servingShrinkGuard.candidateCount} />
            </div>
            <div className={`mt-4 rounded-2xl border p-4 text-sm font-bold ${severityStyles[status.shrinkGuard.passes && status.servingShrinkGuard.passes && status.health.meetsServedFreshCoverageTarget ? 'healthy' : 'critical']}`}>
              {status.shrinkGuard.passes && status.servingShrinkGuard.passes && status.health.meetsServedFreshCoverageTarget
                ? 'Strict served subset clears freshness and both shrink guards.'
                : `Release blocked: ${!status.shrinkGuard.passes ? 'candidate shrink guard failed. ' : ''}${!status.servingShrinkGuard.passes ? 'served-set shrink guard failed. ' : ''}${!status.health.meetsServedFreshCoverageTarget ? 'strict served freshness is below target or empty.' : ''}`}
            </div>
            {!status.health.meetsCandidateReviewCoverageTarget ? <p className="mt-3 text-xs leading-5 text-[#785b10]">Candidate review coverage is below its {status.health.targetCandidateReviewCoveragePct}% throughput target. These rows remain withheld; this warning does not make strict served products unsafe.</p> : null}
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[.8fr_1.45fr]">
          <Panel title="Link-health outcomes" subtitle={`Health snapshot ${shortDate(status.health.generatedAt)} · schema v${status.health.snapshotSchemaVersion}`}>
            {Object.keys(status.health.outcomes).length ? (
              <div className="space-y-3">
                {Object.entries(status.health.outcomes).sort((a, b) => b[1] - a[1]).map(([outcome, count]) => (
                  <div key={outcome}>
                    <div className="flex justify-between text-sm"><span className="font-bold">{outcome.replaceAll('_', ' ')}</span><span className="font-mono">{count}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#e6e3dd]"><div className="h-full rounded-full bg-[#4f7664]" style={{ width: `${(count / outcomeTotal) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-[#6a706b]">Legacy snapshot has no typed outcomes. The strict served set remains empty until a schema-v2 sweep succeeds.</p>}
          </Panel>

          <Panel title="Operator queues" subtitle="Counts are complete; each expandable queue shows the first 24 items for action.">
            <div className="grid gap-3 sm:grid-cols-2">
              {status.queues.map((queue) => <QueueCard key={queue.id} queue={queue} />)}
            </div>
          </Panel>
        </section>

        <Panel title="Source health" subtitle="Latest static source evidence; old successful runs are still marked warning until refreshed.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-y-1 text-left text-sm">
              <thead className="text-xs uppercase tracking-[.12em] text-[#687068]"><tr><th className="px-3 py-2">Source</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Last run</th><th className="px-3 py-2 text-right">Found</th><th className="px-3 py-2 text-right">Accepted</th><th className="px-3 py-2">Detail</th></tr></thead>
              <tbody>
                {status.sources.map((source) => (
                  <tr key={source.id} className="bg-[#faf9f6] align-top">
                    <td className="rounded-l-xl px-3 py-3"><div className="font-black">{source.label}</div><div className="text-xs text-[#747a75]">{source.id}</div></td>
                    <td className="px-3 py-3"><StatusPill severity={source.status}>{source.runStatus}</StatusPill></td>
                    <td className="px-3 py-3">{shortDate(source.lastRunAt)}{source.ageHours !== null ? <div className="text-xs text-[#747a75]">{source.ageHours}h old</div> : null}</td>
                    <td className="px-3 py-3 text-right font-mono">{source.found}</td>
                    <td className="px-3 py-3 text-right font-mono">{source.accepted}</td>
                    <td className="rounded-r-xl px-3 py-3 text-[#5d645f]">{source.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Last pipeline run" subtitle="Candidate-only runs are never publishable.">
            <div className="flex items-center justify-between gap-3"><StatusPill severity={status.lastRun.status === 'success' ? 'healthy' : status.lastRun.status === 'failed' ? 'critical' : 'warning'}>{status.lastRun.status}</StatusPill><span className="text-sm text-[#687068]">{shortDate(status.lastRun.at)}</span></div>
            <p className="mt-3 text-sm font-semibold">{status.lastRun.detail}</p>
            {status.lastRun.lastFailure ? <p className="mt-3 rounded-xl bg-[#fff0f0] p-3 text-sm text-[#8f2929]"><strong>Last failure:</strong> {status.lastRun.lastFailure}</p> : null}
          </Panel>
          <Panel title="Evidence caveats" subtitle="Visible limitations prevent operators from mistaking partial data for production truth.">
            <ul className="space-y-2 text-sm leading-6 text-[#5d645f]">{status.caveats.map((caveat) => <li key={caveat} className="flex gap-2"><span aria-hidden>•</span><span>{caveat}</span></li>)}</ul>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function StatusPill({ severity, children }: { severity: CatalogOpsSeverity; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[.12em] ${severityStyles[severity]}`}>{children}</span>;
}

function MetricCard({ label, value, detail, severity }: { label: string; value: string; detail: string; severity: CatalogOpsSeverity }) {
  return <article className="rounded-[22px] border border-[#d8d3ca] bg-[#fffefa] p-5"><div className="flex items-start justify-between gap-3"><p className="text-xs font-black uppercase tracking-[.14em] text-[#667069]">{label}</p><span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${severity === 'critical' ? 'bg-[#ba4a4a]' : severity === 'warning' ? 'bg-[#c99a2f]' : 'bg-[#39815e]'}`} /></div><p className="mt-3 text-3xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs leading-5 text-[#6e746f]">{detail}</p></article>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-[24px] border border-[#d8d3ca] bg-[#fffefa] p-5"><h2 className="text-lg font-black">{title}</h2><p className="mt-1 mb-5 text-xs leading-5 text-[#707670]">{subtitle}</p>{children}</section>;
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-[#f3f1ec] p-3"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6e746f]">{label}</p><p className="mt-1 font-mono text-xl font-black">{value}</p></div>;
}

function QueueCard({ queue }: { queue: CatalogOpsQueue }) {
  return (
    <details className="rounded-2xl border border-[#ded9d0] bg-[#faf9f6] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><StatusPill severity={queue.severity}>{queue.id}</StatusPill><p className="mt-2 text-sm font-black">{queue.label}</p></div><span className="font-mono text-2xl font-black">{queue.count}</span></summary>
      <div className="mt-4 max-h-72 space-y-2 overflow-auto border-t border-[#e1ddd5] pt-3">
        {queue.items.length ? queue.items.map((item) => <div key={`${queue.id}-${item.id}`} className="rounded-xl bg-white p-3 text-xs"><div className="font-black">{item.brand} · {item.name}</div><div className="mt-1 text-[#686f69]">{item.category} · {item.reason}{item.checkedAt ? ` · ${shortDate(item.checkedAt)}` : ''}</div></div>) : <p className="text-xs text-[#6a706b]">Queue is clear.</p>}
      </div>
    </details>
  );
}
