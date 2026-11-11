'use client';

import { useState } from 'react';

interface AddListFormProps {
  // Resolves to whether the list was created
  onCreate: (title: string) => Promise<boolean>;
}

export default function AddListForm({ onCreate }: AddListFormProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');

  function close() {
    setTitle('');
    setIsAdding(false);
  }

  async function handleCreate() {
    if (!title.trim()) return;
    if (await onCreate(title)) close();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') close();
  }

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="flex-shrink-0 w-64 bg-white/30 hover:bg-white/50 border border-white/40 rounded-md px-3 py-2 text-slate-200 hover:text-white transition-all text-left text-sm"
      >
        + Add a list
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-64 glass rounded-md p-2">
      <input
        type="text"
        placeholder="Enter list title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 focus:outline-none focus:border-blue-500 text-slate-700 text-base sm:text-sm placeholder-slate-400"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          Add list
        </button>
        <button onClick={close} className="text-slate-400 hover:text-slate-600 px-2 transition-colors">
          ✕
        </button>
      </div>
    </div>
  );
}
