import React from 'react';

// Escape special regex characters to safely use user input in regex
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight matching text with a yellow background
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const escapedQuery = escapeRegex(query.trim());
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-slate-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
