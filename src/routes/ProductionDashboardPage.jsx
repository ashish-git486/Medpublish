import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCategoryBySlug } from '../data/mockData.js'
import {
  ADVANCE_ACTION_LABEL,
  PRODUCTION_STATUS_FILTERS,
  nextProductionStatus,
  productionStatusBadgeClassName,
  productionStatusLabel,
} from '../data/productionStatus.js'
import {
  advanceProductionStatus,
  getProductionQueue,
  getProductionStats,
} from '../services/productionService.js'

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide ${productionStatusBadgeClassName(status)}`}
    >
      {productionStatusLabel(status)}
    </span>
  )
}

function formatDate(isoDate) {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="font-mono text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 font-serif text-3xl font-semibold text-ink">{value}</div>
    </div>
  )
}

function matchesFilter(record, filterKey) {
  if (filterKey === 'all') return true
  return record.productionStatus === filterKey
}

function ProductionDashboardPage() {
  const [records, setRecords] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    accepted: 0,
    copyediting: 0,
    metadataVerification: 0,
    readyForTypesetting: 0,
  })
  const [activeFilter, setActiveFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [advancingId, setAdvancingId] = useState(null)

  async function load() {
    setLoading(true)
    setLoadError(false)
    const [{ data: queue, error: queueError }, { data: statsData, error: statsError }] =
      await Promise.all([getProductionQueue(), getProductionStats()])

    if (queueError || statsError) {
      console.error('MedPublish: failed to load production dashboard data', queueError ?? statsError)
      setLoadError(true)
    } else {
      setRecords(queue)
      setStats(statsData)
    }
    setLoading(false)
  }

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      if (!isMounted) return
      await load()
    })()
    return () => {
      isMounted = false
    }
  }, [])

  const visibleRecords = useMemo(
    () => records.filter((record) => matchesFilter(record, activeFilter)),
    [records, activeFilter],
  )

  async function handleQuickAdvance(record) {
    const next = nextProductionStatus(record.productionStatus)
    if (!next) return

    setAdvancingId(record.manuscriptId)
    const { error } = await advanceProductionStatus(record.manuscriptId, next)
    setAdvancingId(null)

    if (error) {
      window.alert(error.message)
      return
    }
    await load()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold text-ink">Production Dashboard</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Track accepted manuscripts through copyediting and metadata verification on their way
        to typesetting.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading production queue…</p>
      ) : loadError ? (
        <div className="mt-8 rounded-xl border border-dashed border-red-200 bg-red-50 p-10 text-center">
          <p className="text-red-600">
            We couldn't load the production queue right now. Please try again shortly.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="In production" value={stats.total} />
            <StatCard label="Accepted" value={stats.accepted} />
            <StatCard label="Copyediting" value={stats.copyediting} />
            <StatCard label="Metadata verification" value={stats.metadataVerification} />
            <StatCard label="Ready for typesetting" value={stats.readyForTypesetting} />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2">
            {PRODUCTION_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeFilter === filter.key
                    ? 'bg-ink text-white'
                    : 'bg-white text-slate-600 hover:text-teal-700'
                } border border-slate-200`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            {visibleRecords.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-slate-500">
                  {records.length === 0
                    ? 'No manuscripts are currently in production.'
                    : 'No manuscripts match this filter right now.'}
                </p>
              </div>
            )}

            {visibleRecords.map((record) => {
              const category = getCategoryBySlug(record.manuscript?.categorySlug)
              const nextStatus = nextProductionStatus(record.productionStatus)
              const advanceLabel = ADVANCE_ACTION_LABEL[record.productionStatus]

              return (
                <div
                  key={record.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-slate-500">
                        <span>{category?.name ?? record.manuscript?.categorySlug}</span>
                        <span className="text-slate-300">·</span>
                        <span>{record.manuscript?.articleType}</span>
                        <span className="text-slate-300">·</span>
                        <span>Accepted {formatDate(record.manuscript?.acceptedAt)}</span>
                      </div>
                      <h3 className="mt-2 font-serif text-lg font-semibold text-ink">
                        {record.manuscript?.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">{record.manuscript?.authors}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Production editor: {record.productionEditorName || 'Unassigned'} · Copyeditor:{' '}
                        {record.copyeditorName || 'Unassigned'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={record.productionStatus} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {nextStatus && (
                        <button
                          type="button"
                          onClick={() => handleQuickAdvance(record)}
                          disabled={advancingId === record.manuscriptId}
                          className="rounded-lg border border-teal-700 px-3 py-1.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {advancingId === record.manuscriptId ? 'Working…' : advanceLabel}
                        </button>
                      )}
                    </div>
                    <Link
                      to={`/production/${record.manuscriptId}`}
                      className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                    >
                      Open production workspace →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default ProductionDashboardPage
