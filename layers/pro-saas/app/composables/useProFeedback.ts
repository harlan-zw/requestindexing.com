// The dashboard's Send feedback drawer (`ProShellFeedbackDrawer`): one open
// state for every place that opens it (the page header, the user menu), and
// the submit adapter that posts a report to `/api/pro/feedback`.
import type { FeedbackIntent, FeedbackSubmitInput } from '@nuxtseo/pro-shell/shared/contracts'
import type { FeedbackSubmitAdapter, FeedbackSubmitResult } from '@nuxtseo/pro-shell/shared/feedback'
import type { DashboardFeedbackWrite } from '#layers/pro-saas/server/utils/dashboard-feedback'
import type { FeedbackHistoryItem, FeedbackHistoryResponse } from '#layers/pro-saas/shared/feedback'
import { readProErrorMessage } from '#layers/pro-saas/shared/errors'

export type FeedbackHistoryResult
  = | { readonly _tag: 'Loaded', readonly items: readonly FeedbackHistoryItem[], readonly hasMore: boolean }
    | { readonly _tag: 'Failed', readonly message: string | null }

interface ProFeedbackState {
  open: boolean
  intent: FeedbackIntent | undefined
}

const SENT: FeedbackSubmitResult = { _tag: 'Sent' }

export function useProFeedback() {
  const state = useState<ProFeedbackState>('pro:feedback', () => ({ open: false, intent: undefined }))
  const proFetch = useProFetch()

  function open(context?: { readonly intent?: FeedbackIntent }) {
    state.value = { open: true, intent: context?.intent }
  }

  const submit: FeedbackSubmitAdapter = (input: FeedbackSubmitInput) =>
    proFetch<DashboardFeedbackWrite>('/api/pro/feedback', { method: 'POST', body: input })
      .then((write): FeedbackSubmitResult => write._tag === 'Recorded' ? SENT : { _tag: 'Failed', message: null })
      .catch((error: unknown): FeedbackSubmitResult => ({ _tag: 'Failed', message: readProErrorMessage(error) }))

  const loadHistory = (): Promise<FeedbackHistoryResult> =>
    proFetch<FeedbackHistoryResponse>('/api/pro/feedback')
      .then((data): FeedbackHistoryResult => ({ _tag: 'Loaded', items: data.items, hasMore: data.hasMore }))
      .catch((error: unknown): FeedbackHistoryResult => ({ _tag: 'Failed', message: readProErrorMessage(error) }))

  const isOpen = computed({
    get: () => state.value.open,
    set: (value: boolean) => { state.value = { ...state.value, open: value } },
  })

  return { isOpen, intent: computed(() => state.value.intent), open, submit, loadHistory }
}
