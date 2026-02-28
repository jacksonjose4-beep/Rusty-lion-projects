import { useEffect, useRef } from 'react';
import { useDraftsStore } from '../store/useDraftsStore';
import { ping, parseTranscript } from '../services/ollamaService';
import { createItemFromOllamaResult } from './itemCreator';

const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useDraftRetry() {
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);

  const processPendingDrafts = async () => {
    if (runningRef.current) return;

    const { drafts: currentDrafts, loadDrafts, removeDraft, updateDraftStatus, loadDraftCount } =
      useDraftsStore.getState();

    const pending = currentDrafts.filter((d) => d.status === 'pending');
    if (pending.length === 0) return;

    const reachable = await ping();
    if (!reachable) return;

    runningRef.current = true;
    let changed = false;

    for (const draft of pending) {
      await updateDraftStatus(draft.id, 'processing');
      try {
        const result  = await parseTranscript(draft.transcript);
        const outcome = await createItemFromOllamaResult(result, 'voice');
        if (outcome.created) {
          await removeDraft(draft.id);
          changed = true;
        } else {
          await updateDraftStatus(draft.id, 'pending');
        }
      } catch {
        await updateDraftStatus(draft.id, 'pending');
      }
    }

    if (changed) {
      await loadDrafts();
      await loadDraftCount();
    }

    runningRef.current = false;
  };

  useEffect(() => {
    processPendingDrafts();
    timerRef.current = setInterval(processPendingDrafts, RETRY_INTERVAL_MS);

    // Also retry when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') processPendingDrafts();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      timerRef.current && clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
