import type { GscdumpDataRow } from '@gscdump/contracts'
import type { UiTableColumn, UiTableFeatures } from '@nuxtseo/design-system/app/shared/table'
import type { CellContext } from '@tanstack/vue-table'
import type { VNodeChild } from 'vue'
import type { Period } from '../../composables/useGscPeriod'
import UiPositionMetric from '@nuxtseo/design-system/app/components/data/UiPositionMetric.vue'
import { calcTrendPercent, formatNumber } from '@nuxtseo/design-system/app/composables/formatting'
import { h } from 'vue'
import { UiTableDash, UiTableMetricCell, UiTableTrendCell, UiTrend } from '#components'
import ProSparklineCell from '../components/pro/ProSparklineCell.vue'

type ProGscCell<T extends GscdumpDataRow> = CellContext<UiTableFeatures, T, unknown>

interface ProGscSparklineOptions<T extends GscdumpDataRow> {
  getData: (row: T) => number[] | null
  pending: () => boolean
  period: Period
  getDates?: () => string[]
  getLabel?: (row: T) => string
}

export function getProGscColumnKey<T extends object>(column: UiTableColumn<T>): string | undefined {
  return 'accessorKey' in column && typeof column.accessorKey === 'string'
    ? column.accessorKey
    : undefined
}

/**
 * Reusable metric column builders for the GSC data tables. Headers render
 * through `UiTable`'s own sortable header, so the builders own only the cell.
 *
 * The clicks sparkline takes a pre-resolved series rather than fetching per
 * row: the caller resolves every visible series in one read through
 * `useProEntitySparklines`.
 */
export function createProGscColumns<T extends GscdumpDataRow = GscdumpDataRow>(hasPrevData?: () => boolean) {
  function dash() {
    return h(UiTableDash)
  }

  function clicksColumn(opts?: { sparkline?: ProGscSparklineOptions<T>, noInlineTrend?: boolean }): UiTableColumn<T> {
    return {
      accessorKey: 'clicks',
      header: 'Clicks',
      tooltip: 'Total clicks from Google Search results',
      numeric: true,
      enableSorting: true,
      cell: ({ row }: ProGscCell<T>) => {
        const r = row.original
        const display = r.clicks == null ? null : formatNumber(r.clicks)
        const slots: Record<string, () => VNodeChild> = {}
        if (opts?.sparkline) {
          slots.after = () => h(ProSparklineCell, {
            data: opts.sparkline!.getData(r),
            pending: opts.sparkline!.pending(),
            dates: opts.sparkline!.getDates?.(),
            label: opts.sparkline!.getLabel?.(r),
            period: opts.sparkline!.period,
            width: 80,
            height: 24,
          })
        }
        else if (r.prevClicks && !opts?.noInlineTrend) {
          slots.trend = () => h(UiTrend, {
            value: calcTrendPercent(r.clicks, r.prevClicks!),
            format: 'percent',
            size: '2xs',
          })
        }
        return h(UiTableMetricCell, { value: r.clicks, display, align: 'right' }, slots)
      },
    }
  }

  function clicksChangeColumn(): UiTableColumn<T> {
    return {
      accessorKey: 'clicksChange',
      header: '',
      numeric: true,
      visibleFrom: 'lg',
      enableSorting: false,
      cell: ({ row }: ProGscCell<T>) => h(UiTableTrendCell, {
        current: row.original.clicks,
        previous: row.original.prevClicks,
      }),
    }
  }

  function impressionsColumn(): UiTableColumn<T> {
    return {
      accessorKey: 'impressions',
      header: 'Impr',
      tooltip: 'Number of times your site appeared in Google Search results',
      numeric: true,
      visibleFrom: 'sm',
      enableSorting: true,
      cell: ({ row }: ProGscCell<T>) => {
        const r = row.original
        return h(UiTableMetricCell, {
          value: r.impressions,
          display: r.impressions == null ? null : formatNumber(r.impressions),
          muted: true,
          align: 'right',
        })
      },
    }
  }

  function ctrColumn(): UiTableColumn<T> {
    return {
      accessorKey: 'ctr',
      header: 'CTR',
      tooltip: 'Click-through rate: the share of impressions that earned a click',
      numeric: true,
      visibleFrom: 'md',
      enableSorting: true,
      cell: ({ row }: ProGscCell<T>) => {
        const r = row.original
        return h(UiTableMetricCell, {
          value: r.ctr,
          display: r.impressions > 0 && r.ctr != null ? `${(r.ctr * 100).toFixed(1)}%` : null,
          muted: true,
          align: 'right',
        })
      },
    }
  }

  function positionColumn(opts?: { withTrend?: boolean }): UiTableColumn<T> {
    return {
      accessorKey: 'position',
      header: 'Pos',
      tooltip: 'Average Google Search ranking position. Lower is better.',
      numeric: true,
      visibleFrom: 'sm',
      enableSorting: true,
      cell: ({ row }: ProGscCell<T>) => {
        const r = row.original
        if (!r.position)
          return h(UiTableDash)
        const children = [h(UiPositionMetric, { value: r.position })]
        if (opts?.withTrend && r.prevPosition) {
          children.push(h(UiTrend, {
            value: calcTrendPercent(r.position, r.prevPosition, true),
            format: 'percent',
            inverted: true,
            size: '2xs',
          }))
        }
        return opts?.withTrend
          ? h('div', { class: 'flex flex-col items-end gap-1' }, children)
          : children[0]
      },
    }
  }

  /** A "New" badge for a row with impressions but no previous data. */
  function newBadge(r: GscdumpDataRow) {
    if (hasPrevData?.() && !r.prevImpressions && r.impressions > 0)
      return [h(UiTrend, { isNew: true, size: '2xs' })]
    return []
  }

  return {
    clicksColumn,
    clicksChangeColumn,
    impressionsColumn,
    ctrColumn,
    positionColumn,
    newBadge,
    dash,
  }
}
