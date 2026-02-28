/**
 * itemCreator — takes a parsed OllamaResult and creates the right store item.
 *
 * Uses zustand getState() so it can be called outside React components.
 *
 * Returns:
 *   { created: true }  — item was created successfully
 *   { created: false, needsReminderDate: text }
 *     — Ollama classified as 'reminder' but extracted no datetime;
 *       caller should show the ReminderModal with this text.
 */

import { OllamaResult } from '../types';
import { useTodosStore } from '../store/useTodosStore';
import { useRemindersStore } from '../store/useRemindersStore';
import { useThoughtsStore } from '../store/useThoughtsStore';
import { scheduleReminder } from '../services/notificationService';

export type CreateResult =
  | { created: true }
  | { created: false; needsReminderDate: string };

export async function createItemFromOllamaResult(
  result: OllamaResult,
  sourceType: 'voice' | 'text' = 'text'
): Promise<CreateResult> {
  const { addTodo }                            = useTodosStore.getState();
  const { addReminder, updateNotificationId }  = useRemindersStore.getState();
  const { addThought }                         = useThoughtsStore.getState();

  switch (result.type) {
    case 'todo': {
      await addTodo(result.text, result.priority ?? 'medium');
      return { created: true };
    }

    case 'reminder': {
      if (result.datetime) {
        // Ollama gave us a concrete datetime → schedule immediately
        const reminder = await addReminder(result.text, result.datetime);
        try {
          const notifId = await scheduleReminder(reminder);
          await updateNotificationId(reminder.id, notifId);
        } catch {
          // Notification scheduling can fail in simulators — item still saved
        }
        return { created: true };
      }
      // No datetime — tell the caller to show the date picker
      return { created: false, needsReminderDate: result.text };
    }

    case 'thought': {
      await addThought(result.text, sourceType);
      return { created: true };
    }

    default:
      // Unknown type — treat as thought so nothing is lost
      await addThought((result as any).text ?? '', sourceType);
      return { created: true };
  }
}
