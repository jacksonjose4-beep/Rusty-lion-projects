/**
 * useDraftRetry — background hook that silently processes pending drafts
 * whenever Ollama becomes reachable. Checks every 5 minutes.
 *
 * Mount this once at the root (App.tsx) so it runs for the app's lifetime.
 * Reminders with no extracted date are left as pending for manual review.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDraftsStore } from '../store/useDraftsStore';
import { ping, parseTranscript } from '../services/ollamaService';
import { createItemFromOllamaResult } from './itemCreator';

const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useDraftRetry() {
  const { drafts, loadDrafts, removeDraft, updateDraftStatus, loadDraftCount } =
    useDraftsStore.getState();

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef  = useRef(false);

  const processPendingDrafts = async () => {
    if (runningRef.current) return;

    const { drafts: currentDrafts } = useDraftsStore.getState();
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
          // Reminder with no date — leave pending for manual review
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
    // Initial attempt on mount
    processPendingDrafts();

    // Recurring timer
    timerRef.current = setInterval(processPendingDrafts, RETRY_INTERVAL_MS);

    // Also retry when app comes to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') processPendingDrafts();
    });

    return () => {
      timerRef.current && clearInterval(timerRef.current);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
