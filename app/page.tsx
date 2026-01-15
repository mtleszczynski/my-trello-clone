'use client';

import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { List as ListType } from './types';
import List from './components/List';

export default function Home() {
  const [lists, setLists] = useState<ListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch lists from Supabase when the page loads
  useEffect(() => {
    async function fetchLists() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('archived', false)
        .order('position', { ascending: true });

      if (error) {
        console.error('Error fetching lists:', error);
        setError('Failed to load lists. Please try again.');
        setLoading(false);
        return;
      }

      setLists(data || []);
      setLoading(false);
    }

    fetchLists();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <p className="text-gray-600">Loading your board...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">My Trello Clone</h1>
      </header>

      {/* Board */}
      <main className="p-4 overflow-x-auto">
        <div className="flex gap-4 items-start">
          {/* Display all lists */}
          {lists.map((list) => (
            <List key={list.id} list={list} />
          ))}

          {/* Show message if no lists */}
          {lists.length === 0 && (
            <div className="text-gray-500 p-4">
              No lists yet. Add your first list to get started!
            </div>
          )}

          {/* Add List Button (placeholder for now) */}
          <button className="flex-shrink-0 w-72 bg-white/50 hover:bg-white/80 rounded-lg p-3 text-gray-600 hover:text-gray-800 transition-colors text-left">
            + Add a list
          </button>
        </div>
      </main>
    </div>
  );
}
