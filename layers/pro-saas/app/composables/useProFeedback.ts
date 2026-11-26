// The dashboard's Send feedback drawer (`ProShellFeedbackDrawer`): one open
// state for every place that opens it (the page header, the user menu), and
// the submit adapter that posts a report to `/api/pro/feedback`.
import type { FeedbackHistoryItem, FeedbackHistoryResponse, FeedbackIntent, FeedbackSubmitInput } from '@nuxtseo/pro-shell/shared/contracts'
import type { FeedbackHistoryAdapter, FeedbackHistoryResult, FeedbackSubmitAdapter, FeedbackSubmitResult } from '@nuxtseo/pro-shell/shared/feedback'
import type { DashboardFeedbackWrite } from '#layers/pro-saas/server/utils/dashboard-feedback'
import { countUnreadFeedbackUpdates } from '@nuxtseo/pro-shell/shared/feedback'
import { useLocalStorage } from '@vueuse/core'
import { readProErrorMessage } from '#layers/pro-saas/shared/errors'

interface ProFeedbackState {
  open: boolean
  intent: FeedbackIntent | undefined
}

const SENT: FeedbackSubmitResult = { _tag: 'Sent' }

export function useProFeedback() {
  const state = useState<ProFeedbackState>('pro:feedback', () => ({ open: false, intent: undefined }))
  const historyItems = useState<readonly FeedbackHistoryItem[]>('pro:feedback:items', () => [])
  const historyPrefetched = useState<boolean>('pro:feedback:prefetched', () => false)
  const historySeenAt = useLocalStorage<string | null>('requestindexing:feedback-history-seen-v1', null, { initOnMounted: true })
  const proFetch = useProFetch()
  const { loggedIn } = useUserSession()

  function open(context?: { readonly intent?: FeedbackIntent }) {
    state.value = { open: true, intent: context?.intent }
  }

  const submit: FeedbackSubmitAdapter = (input: FeedbackSubmitInput) =>
    proFetch<DashboardFeedbackWrite>('/api/pro/feedback', { method: 'POST', body: input })
      .then((write): FeedbackSubmitResult => write._tag === 'Recorded' ? SENT : { _tag: 'Failed', message: null })
      .catch((error: unknown): FeedbackSubmitResult => ({ _tag: 'Failed', message: readProErrorMessage(error) }))

  const loadHistory: FeedbackHistoryAdapter = () =>
    proFetch<FeedbackHistoryResponse>('/api/pro/feedback')
      .then((data): FeedbackHistoryResult => {
        historyItems.value = data.items
        return { _tag: 'Loaded', items: data.items, hasMore: data.hasMore }
      })
      .catch((error: unknown): FeedbackHistoryResult => ({ _tag: 'Failed', message: readProErrorMessage(error) }))

  function prefetchUnread() {
    if (!import.meta.client || !loggedIn.value || historyPrefetched.value)
      return
    historyPrefetched.value = true
    void proFetch<FeedbackHistoryResponse>('/api/pro/feedback')
      .then((data) => { historyItems.value = data.items })
      .catch(() => {
        // Non-blocking unread badge check; opening the drawer retries with full error surfacing.
        historyPrefetched.value = false
      })
  }

  const unreadCount = computed(() => countUnreadFeedbackUpdates(historyItems.value, historySeenAt.value))

  function markHistorySeen(seenAt: string) {
    if (!historySeenAt.value || Date.parse(seenAt) > Date.parse(historySeenAt.value))
      historySeenAt.value = seenAt
  }

  const isOpen = computed({
    get: () => state.value.open,
    set: (value: boolean) => { state.value = { ...state.value, open: value } },
  })

  return {
    isOpen,
    intent: computed(() => state.value.intent),
    open,
    submit,
    loadHistory,
    unreadCount,
    markHistorySeen,
    prefetchUnread,
  }
}
