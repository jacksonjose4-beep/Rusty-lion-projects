export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  date: string;           // YYYY-MM-DD — which day this belongs to
  priority: 'low' | 'medium' | 'high';
  createdAt: string;      // ISO datetime
}

export interface Reminder {
  id: string;
  text: string;
  scheduledAt: string;    // ISO datetime
  recurring: 'none' | 'daily' | 'weekly';
  notificationId: string | null;
  completed: boolean;
  createdAt: string;
}

export interface Thought {
  id: string;
  text: string;
  createdAt: string;      // ISO datetime, sorted newest-first
  sourceType: 'voice' | 'text';
}

export interface Draft {
  id: string;
  transcript: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'failed';
}

export interface OllamaResult {
  type: 'todo' | 'reminder' | 'thought';
  text: string;
  datetime: string | null;
  priority: 'low' | 'medium' | 'high';
}

export interface AppSettings {
  ollamaUrl: string;
  ollamaModel: string;
  whisperModel: 'tiny' | 'base' | 'small';
  morningNotification: boolean;
}
