import { supabase } from './supabase';
import { BoardType, List } from '../types';

// Create sample data for new users
export async function createSampleData(userId: string): Promise<List[] | null> {
  // Sample lists with different widths
  const sampleLists = [
    { title: '📋 To Do', width: 240, position: 0 },
    { title: '🚀 In Progress', width: 300, position: 1 },
    { title: '✅ Completed', width: 240, position: 2 },
    { title: '💡 Ideas & Notes', width: 380, position: 3 },
    { title: '📚 Resources', width: 280, position: 4 },
  ];

  // Create lists
  const { data: createdLists, error: listsError } = await supabase
    .from('lists')
    .insert(sampleLists.map(list => ({ ...list, user_id: userId, archived: false, board: 'work', shared: false, minimized: false })))
    .select();

  if (listsError || !createdLists) {
    console.error('Error creating sample lists:', listsError);
    return null;
  }

  // Sample cards for each list
  const sampleCards = [
    // To Do (4 short items)
    { list_id: createdLists[0].id, title: 'Review weekly goals', position: 0 },
    { list_id: createdLists[0].id, title: 'Reply to emails', position: 1 },
    { list_id: createdLists[0].id, title: 'Schedule team meeting', position: 2 },
    { list_id: createdLists[0].id, title: 'Update project timeline', position: 3 },
    
    // In Progress (3 items, one with description)
    { list_id: createdLists[1].id, title: 'Design new dashboard layout', position: 0, description: 'Focus on mobile responsiveness and accessibility. Check competitor designs for inspiration.' },
    { list_id: createdLists[1].id, title: 'Write documentation', position: 1 },
    { list_id: createdLists[1].id, title: 'Fix login bug', position: 2, description: 'Users on Safari are seeing a timeout error. Need to investigate the auth flow.' },
    
    // Completed (5 items, some completed)
    { list_id: createdLists[2].id, title: 'Set up project repository', position: 0, completed: true },
    { list_id: createdLists[2].id, title: 'Create database schema', position: 1, completed: true },
    { list_id: createdLists[2].id, title: 'Implement user authentication', position: 2, completed: true },
    { list_id: createdLists[2].id, title: 'Deploy to production', position: 3, completed: true },
    { list_id: createdLists[2].id, title: 'Add drag and drop', position: 4 },
    
    // Ideas & Notes (2 longer items with descriptions)
    { list_id: createdLists[3].id, title: 'Add dark mode support', position: 0, description: 'Many users prefer dark mode, especially for apps they use frequently. Consider adding a toggle in the header and saving the preference.' },
    { list_id: createdLists[3].id, title: 'Keyboard shortcuts for power users', position: 1, description: 'Common shortcuts: N for new card, L for new list, arrow keys to navigate, Enter to edit, Escape to cancel.' },
    
    // Resources (6 items)
    { list_id: createdLists[4].id, title: 'React documentation', position: 0 },
    { list_id: createdLists[4].id, title: 'Tailwind CSS cheatsheet', position: 1 },
    { list_id: createdLists[4].id, title: 'Supabase guides', position: 2, description: 'Check out the auth and real-time sections' },
    { list_id: createdLists[4].id, title: 'dnd-kit examples', position: 3 },
    { list_id: createdLists[4].id, title: 'Next.js app router docs', position: 4 },
    { list_id: createdLists[4].id, title: 'TypeScript handbook', position: 5 },
  ];

  // Create cards
  const { error: cardsError } = await supabase
    .from('cards')
    .insert(sampleCards.map(card => ({ 
      ...card, 
      user_id: userId, 
      completed: card.completed || false,
      description: card.description || '',
    })));

  if (cardsError) {
    console.error('Error creating sample cards:', cardsError);
  }

  // Fetch the complete data with cards
  const { data: finalData } = await supabase
    .from('lists')
    .select('*, cards(*)')
    .eq('user_id', userId)
    .eq('board', 'work')
    .eq('archived', false)
    .order('position', { ascending: true });

  return finalData;
}

// Generate mock data for dev bypass mode (no database needed)
export function getDevMockData(board: BoardType): List[] {
  const now = new Date().toISOString();
  const userId = 'dev-bypass-user';
  return [
    {
      id: 'mock-list-1', title: '📋 To Do', position: 0, width: 240,
      archived: false, board, shared: false, minimized: false, user_id: userId, created_at: now,
      cards: [
        { id: 'mock-card-1', title: 'Review weekly goals', description: '', position: 0, list_id: 'mock-list-1', user_id: userId, completed: false, created_at: now },
        { id: 'mock-card-2', title: 'Reply to emails', description: '', position: 1, list_id: 'mock-list-1', user_id: userId, completed: false, created_at: now },
        { id: 'mock-card-3', title: 'Schedule team meeting', description: '', position: 2, list_id: 'mock-list-1', user_id: userId, completed: false, created_at: now },
        { id: 'mock-card-4', title: 'Update project timeline', description: '', position: 3, list_id: 'mock-list-1', user_id: userId, completed: false, created_at: now },
      ],
    },
    {
      id: 'mock-list-2', title: '🚀 In Progress', position: 1, width: 300,
      archived: false, board, shared: false, minimized: false, user_id: userId, created_at: now,
      cards: [
        { id: 'mock-card-5', title: 'Design new dashboard layout', description: 'Focus on mobile responsiveness and accessibility.', position: 0, list_id: 'mock-list-2', user_id: userId, completed: false, created_at: now },
        { id: 'mock-card-6', title: 'Write documentation', description: '', position: 1, list_id: 'mock-list-2', user_id: userId, completed: false, created_at: now },
        { id: 'mock-card-7', title: 'Fix login bug', description: 'Users on Safari are seeing a timeout error.', position: 2, list_id: 'mock-list-2', user_id: userId, completed: false, created_at: now },
      ],
    },
    {
      id: 'mock-list-3', title: '✅ Completed', position: 2, width: 240,
      archived: false, board, shared: false, minimized: false, user_id: userId, created_at: now,
      cards: [
        { id: 'mock-card-8', title: 'Set up project repository', description: '', position: 0, list_id: 'mock-list-3', user_id: userId, completed: true, created_at: now },
        { id: 'mock-card-9', title: 'Create database schema', description: '', position: 1, list_id: 'mock-list-3', user_id: userId, completed: true, created_at: now },
        { id: 'mock-card-10', title: 'Implement user authentication', description: '', position: 2, list_id: 'mock-list-3', user_id: userId, completed: true, created_at: now },
        { id: 'mock-card-11', title: 'Add drag and drop', description: '', position: 3, list_id: 'mock-list-3', user_id: userId, completed: false, created_at: now },
      ],
    },
    {
      id: 'mock-list-4', title: '💡 Ideas & Notes', position: 3, width: 380,
      archived: false, board, shared: false, minimized: false, user_id: userId, created_at: now,
      cards: [
        { id: 'mock-card-12', title: 'Add dark mode support', description: 'Many users prefer dark mode for frequent-use apps.', position: 0, list_id: 'mock-list-4', user_id: userId, completed: false, created_at: now },
        { id: 'mock-card-13', title: 'Keyboard shortcuts for power users', description: 'N for new card, L for new list, arrows to navigate.', position: 1, list_id: 'mock-list-4', user_id: userId, completed: false, created_at: now },
      ],
    },
    {
      id: 'mock-list-5', title: '📚 Resources', position: 4, width: 280,
      archived: false, board, shared: false, minimized: false, user_id: userId, created_at: now,
      cards: [
        { id: 'mock-card-14', title: 'React documentation', description: '', position: 0, list_id: 'mock-list-5', user_id: userId, completed: false, created_at: now },
        { id: 'mock-card-15', title: 'Tailwind CSS cheatsheet', description: '', position: 1, list_id: 'mock-list-5', user_id: userId, completed: false, created_at: now },
        { id: 'mock-card-16', title: 'Supabase guides', description: 'Check out the auth and real-time sections', position: 2, list_id: 'mock-list-5', user_id: userId, completed: false, created_at: now },
      ],
    },
  ];
}
