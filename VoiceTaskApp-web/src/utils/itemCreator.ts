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
        const reminder = await addReminder(result.text, result.datetime);
        try {
          const notifId = await scheduleReminder(reminder);
          await updateNotificationId(reminder.id, notifId);
        } catch {
          // Notification scheduling may fail — item still saved
        }
        return { created: true };
      }
      return { created: false, needsReminderDate: result.text };
    }

    case 'thought': {
      await addThought(result.text, sourceType);
      return { created: true };
    }

    default:
      await addThought((result as any).text ?? '', sourceType);
      return { created: true };
  }
}
