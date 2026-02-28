import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Draft } from '../types';
import * as db from '../services/db';

interface DraftsState {
  draftCount: number;
  drafts: Draft[];
  loadDraftCount: () => Promise<void>;
  loadDrafts: () => Promise<void>;
  addDraft: (transcript: string) => Promise<Draft>;
  updateDraftStatus: (id: string, status: Draft['status']) => Promise<void>;
  removeDraft: (id: string) => Promise<void>;
}

export const useDraftsStore = create<DraftsState>((set, get) => ({
  draftCount: 0,
  drafts: [],

  loadDraftCount: async () => {
    const draftCount = await db.getDraftCount();
    set({ draftCount });
  },

  loadDrafts: async () => {
    const drafts = await db.getPendingDrafts();
    set({ drafts, draftCount: drafts.length });
  },

  addDraft: async (transcript) => {
    const draft: Draft = {
      id: uuidv4(),
      transcript,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    await db.createDraft(draft);
    set((s) => ({ drafts: [...s.drafts, draft], draftCount: s.draftCount + 1 }));
    return draft;
  },

  updateDraftStatus: async (id, status) => {
    await db.updateDraftStatus(id, status);
    set((s) => ({
      drafts: s.drafts.map((d) => (d.id === id ? { ...d, status } : d)),
    }));
  },

  removeDraft: async (id) => {
    await db.deleteDraft(id);
    set((s) => ({
      drafts: s.drafts.filter((d) => d.id !== id),
      draftCount: Math.max(0, s.draftCount - 1),
    }));
  },
}));
