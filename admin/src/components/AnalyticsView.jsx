import { useEffect, useState } from 'react'
import { api } from '../api'

const RANGES = [7, 14, 30]

const fmt = (n) => (n ?? 0).toLocaleString()
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`
const dayLabel = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

// Visitors and page views from Vercel Web Analytics
export default function AnalyticsView({ onError }) {
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .analytics(days)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && (setData(false), onError(err)))
    return () => {
      cancelled = true
    }
  }, [days, onError])

  // Switching ranges keeps the old numbers visible (dimmed) until the new ones arrive
  const loading = data === null || (data && data.days !== days)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="nb-eyebrow mr-1">Last</span>
        {RANGES.map((n) => (
          <button
            key={n}
            className={`nb-btn nb-btn-sm nb-press ${n === days ? 'nb-btn-yellow' : ''}`}
            onClick={() => setDays(n)}
          >
            {n} days
          </button>
        ))}
      </div>

      {data === null && <p className="nb-eyebrow m-0">Loading…</p>}
      {data === false && <p className="m-0 text-(--color-muted)">Couldn't load analytics.</p>}

      {data && (
        <div className={`grid gap-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Visitors" value={data.totals.visitors} />
            <Stat label="Page views" value={data.totals.pageviews} />
          </div>
          <DailyChart rows={data.daily} />
          <div className="grid sm:grid-cols-2 gap-4">
            <TopList title="Top pages" rows={data.pages} field="requestPath" />
            <TopList title="Referrers" rows={data.referrers} field="referrerHostname" empty="Direct" />
            <TopList title="Countries" rows={data.countries} field="country" />
            <TopList title="Devices" rows={data.devices} field="deviceType" />
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="nb-box px-5 py-4">
      <p className="nb-eyebrow m-0">{label}</p>
      <p className="m-0 mt-2 font-display font-bold text-[40px] leading-none">{fmt(value)}</p>
    </div>
  )
}

// Visitors per day as bars; hovering a bar shows that day's numbers in the header
function DailyChart({ rows }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...rows.map((r) => r.visitors))
  const shown = hover ?? rows.at(-1)

  return (
    <div className="nb-box px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <p className="nb-eyebrow m-0">Visitors per day</p>
        {shown && (
          <p className="m-0 text-[14px]">
            <span className="font-semibold">{dayLabel(shown.timestamp)}</span>
            <span className="text-(--color-muted)">
              {' '}
              · {plural(shown.visitors, 'visitor')} · {plural(shown.pageviews, 'view')}
            </span>
          </p>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="m-0 text-(--color-muted)">No visits yet.</p>
      ) : (
        <div className="flex items-end gap-[2px] h-40 border-b-[3px] border-(--color-ink)" onMouseLeave={() => setHover(null)}>
          {rows.map((r) => (
            <div
              key={r.timestamp}
              className="flex-1 h-full flex items-end cursor-default"
              onMouseEnter={() => setHover(r)}
              aria-label={`${dayLabel(r.timestamp)}: ${r.visitors} visitors, ${r.pageviews} page views`}
            >
              <div
                className={`w-full ${r === shown ? 'bg-(--color-red)' : 'bg-(--color-blue)'}`}
                style={{ height: `${(r.visitors / max) * 100}%`, minHeight: r.visitors ? 2 : 0 }}
              />
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div className="flex justify-between mt-2 text-[12px] text-(--color-muted)">
          <span>{dayLabel(rows[0].timestamp)}</span>
          <span>{dayLabel(rows.at(-1).timestamp)}</span>
        </div>
      )}
    </div>
  )
}

function TopList({ title, rows, field, empty = 'Unknown' }) {
  const max = Math.max(1, ...rows.map((r) => r.visitors))
  return (
    <div className="nb-box px-5 py-4">
      <div className="flex justify-between mb-3">
        <p className="nb-eyebrow m-0">{title}</p>
        <p className="nb-eyebrow m-0">Visitors</p>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 text-(--color-muted)">No data yet.</p>
      ) : (
        <ul className="m-0 p-0 list-none grid gap-1">
          {rows.map((r) => (
            <li key={r[field] ?? empty} className="relative flex justify-between gap-3 px-2 py-1 text-[14px]">
              <span
                className="absolute inset-y-0 left-0 bg-(--color-sunken)"
                style={{ width: `${(r.visitors / max) * 100}%` }}
              />
              <span className="relative truncate">{r[field] || empty}</span>
              <span className="relative font-semibold">{fmt(r.visitors)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
