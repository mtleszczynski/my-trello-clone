'use client';

import type { User } from '@supabase/supabase-js';
import { ViewMode } from '../types';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  user: User;
  onSignOut: () => void;
}

const TABS: { viewMode: ViewMode; label: string }[] = [
  { viewMode: 'work', label: 'Work' },
  { viewMode: 'personal', label: 'Personal' },
  { viewMode: 'work-archive', label: 'Work Archive' },
  { viewMode: 'personal-archive', label: 'Pers Archive' },
];

export default function Header({ viewMode, onViewModeChange, searchQuery, onSearchChange, user, onSignOut }: HeaderProps) {
  function tabButton({ viewMode: tab, label }: (typeof TABS)[number]) {
    return (
      <button
        key={tab}
        onClick={() => onViewModeChange(tab)}
        className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
          viewMode === tab
            ? 'bg-slate-700 text-slate-100'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
      <div className="px-4 py-2.5 overflow-x-auto hide-scrollbar">
        <div className="flex items-center justify-between gap-4 min-w-max">
          <div className="flex items-center gap-4 flex-shrink-0">
            <h1 className="text-lg font-semibold text-slate-100 whitespace-nowrap leading-tight">My Trello Clone</h1>

            {/* View Mode Tabs */}
            <div className="flex gap-1 flex-shrink-0">
              {TABS.slice(0, 2).map(tabButton)}
              <span className="text-slate-600 px-1">|</span>
              {TABS.slice(2).map(tabButton)}
            </div>
          </div>

          {/* Search and User info */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-40 sm:w-52 pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-md text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>

            {user.user_metadata?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element -- small Google avatar; next/image would need remote image config
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                className="w-8 h-8 rounded-full border border-slate-600"
              />
            )}
            <span className="text-sm text-slate-300 hidden sm:inline">
              {user.user_metadata?.full_name || user.email}
            </span>
            <button
              onClick={onSignOut}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-slate-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
