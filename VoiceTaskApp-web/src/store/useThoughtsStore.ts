import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Thought } from '../types';
import * as db from '../services/db';

interface ThoughtsState {
  thoughts: Thought[];
  loadThoughts: () => Promise<void>;
  searchThoughts: (query: string) => Promise<void>;
  addThought: (text: string, sourceType?: Thought['sourceType']) => Promise<void>;
  removeThought: (id: string) => Promise<void>;
}

export const useThoughtsStore = create<ThoughtsState>((set) => ({
  thoughts: [],

  loadThoughts: async () => {
    const thoughts = await db.getAllThoughts();
    set({ thoughts });
  },

  searchThoughts: async (query) => {
    if (!query.trim()) {
      const thoughts = await db.getAllThoughts();
      set({ thoughts });
      return;
    }
    const thoughts = await db.searchThoughts(query);
    set({ thoughts });
  },

  addThought: async (text, sourceType = 'text') => {
    const thought: Thought = {
      id: uuidv4(),
      text,
      createdAt: new Date().toISOString(),
      sourceType,
    };
    await db.createThought(thought);
    set((s) => ({ thoughts: [thought, ...s.thoughts] }));
  },

  removeThought: async (id) => {
    await db.deleteThought(id);
    set((s) => ({ thoughts: s.thoughts.filter((t) => t.id !== id) }));
  },
}));
