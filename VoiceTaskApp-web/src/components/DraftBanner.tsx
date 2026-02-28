import React, { useState } from 'react';
import { useDraftsStore } from '../store/useDraftsStore';
import DraftReviewModal from './DraftReviewModal';

export default function DraftBanner() {
  const draftCount = useDraftsStore((s) => s.draftCount);
  const [showModal, setShowModal] = useState(false);

  if (draftCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 w-full bg-indigo-950 px-4 py-2.5 text-left"
      >
        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
        <span className="flex-1 text-xs text-indigo-300 font-medium">
          {draftCount} {draftCount === 1 ? 'note' : 'notes'} waiting to parse
        </span>
        <span className="text-indigo-400 text-lg leading-none">›</span>
      </button>

      <DraftReviewModal visible={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
