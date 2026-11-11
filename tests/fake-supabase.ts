// An in-memory stand-in for Supabase, so tests can see exactly what the app saves.
import type { BrowserContext, Page } from '@playwright/test';

export const FAKE_SUPABASE_URL = 'https://fake-project.supabase.co';
const USER_ID = '00000000-0000-0000-0000-000000000001';

type Row = Record<string, unknown> & { id: string };

export interface FakeDatabase {
  lists: Row[];
  cards: Row[];
}

export interface FakeSupabase {
  db: FakeDatabase;
  // Every successful update, in the order it was saved
  updates: { table: string; id: string; body: Record<string, unknown> }[];
  // Tables that rows were inserted into
  inserts: string[];
  // Order in which requests started/finished, e.g. "update cards c done"
  timeline: string[];
  // Make writes slow or fail
  options: { writeDelayMs: number; failWrites: boolean };
}

const now = new Date().toISOString();

function list(id: string, title: string, position: number, extra: Partial<Row> = {}): Row {
  return { id, title, position, width: 260, archived: false, board: 'work', shared: false, minimized: false, user_id: USER_ID, created_at: now, ...extra };
}

function card(id: string, listId: string, position: number): Row {
  return { id, title: `Card ${id.toUpperCase()}`, description: '', position, list_id: listId, completed: false, user_id: USER_ID, created_at: now };
}

// List One: A B C D   List Two: E F   List Three: G H I J (H, I and J share position 1)
export function sampleBoard(): FakeDatabase {
  return {
    lists: [list('L1', 'List One', 0), list('L2', 'List Two', 1), list('L3', 'List Three', 2)],
    cards: [
      card('a', 'L1', 0), card('b', 'L1', 1), card('c', 'L1', 2), card('d', 'L1', 3),
      card('e', 'L2', 0), card('f', 'L2', 1),
      card('g', 'L3', 0), card('h', 'L3', 1), card('i', 'L3', 1), card('j', 'L3', 1),
    ],
  };
}

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

// Log in as a fake user by setting the cookie the Supabase client reads its session from
async function signIn(context: BrowserContext, baseURL: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600;
  const accessToken = [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: USER_ID, exp: expiresAt, role: 'authenticated', aud: 'authenticated' }),
    'signature',
  ].join('.');
  const session = {
    access_token: accessToken,
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: expiresAt,
    user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: { full_name: 'Test User' }, created_at: now },
  };
  const projectRef = new URL(FAKE_SUPABASE_URL).host.split('.')[0];
  await context.addCookies([{ name: `sb-${projectRef}-auth-token`, value: `base64-${base64url(session)}`, url: baseURL }]);
}

// Apply PostgREST-style filters (?board=eq.work&archived=eq.false&or=(board.eq.work,shared.eq.true))
function matchesFilters(row: Row, params: URLSearchParams): boolean {
  for (const [key, value] of params) {
    if (key === 'or') {
      const options = value.replace(/^\(|\)$/g, '').split(',');
      if (!options.some((option) => {
        const [column, , expected] = option.split('.');
        return String(row[column]) === expected;
      })) return false;
    } else if (value.startsWith('eq.') && key in row) {
      if (String(row[key]) !== value.slice(3)) return false;
    }
  }
  return true;
}

export async function useFakeSupabase(page: Page, baseURL: string, db: FakeDatabase = sampleBoard()): Promise<FakeSupabase> {
  const fake: FakeSupabase = { db, updates: [], inserts: [], timeline: [], options: { writeDelayMs: 0, failWrites: false } };
  await signIn(page.context(), baseURL);

  await page.route(`${FAKE_SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/rest/v1/')) return route.fulfill({ status: 200, json: {} });

    const table = url.pathname.split('/').pop() as keyof FakeDatabase;
    const rows = db[table];
    const method = request.method();
    const id = url.searchParams.get('id')?.replace('eq.', '');

    if (method === 'HEAD') {
      const count = rows.filter((row) => matchesFilters(row, url.searchParams)).length;
      return route.fulfill({
        status: 200,
        headers: { 'content-range': `*/${count}`, 'access-control-expose-headers': 'content-range' },
        body: '',
      });
    }

    if (method === 'GET') {
      fake.timeline.push(`load ${table}`);
      const result = rows
        .filter((row) => matchesFilters(row, url.searchParams))
        .sort((a, b) => (a.position as number) - (b.position as number))
        .map((row) => (table === 'lists' ? { ...row, cards: db.cards.filter((c) => c.list_id === row.id) } : row));
      return route.fulfill({ status: 200, json: result });
    }

    // Writes
    fake.timeline.push(`${method} ${table} ${id ?? ''} start`.replace('  ', ' '));
    if (fake.options.writeDelayMs) await new Promise((resolve) => setTimeout(resolve, fake.options.writeDelayMs));
    if (fake.options.failWrites) {
      fake.timeline.push(`${method} ${table} failed`);
      return route.fulfill({ status: 400, json: { message: 'Simulated failure', code: 'XX000' } });
    }

    if (method === 'PATCH' && id) {
      const body = request.postDataJSON();
      Object.assign(rows.find((row) => row.id === id)!, body);
      fake.updates.push({ table, id, body });
      fake.timeline.push(`update ${table} ${id} done`);
      return route.fulfill({ status: 204, body: '' });
    }

    if (method === 'DELETE' && id) {
      db[table] = rows.filter((row) => row.id !== id);
      return route.fulfill({ status: 204, body: '' });
    }

    if (method === 'POST') {
      const body = request.postDataJSON();
      const created = (Array.isArray(body) ? body : [body]).map((row) => ({ id: crypto.randomUUID(), created_at: now, ...row }));
      rows.push(...created);
      fake.inserts.push(table);
      const wantsSingle = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return route.fulfill({ status: 201, json: wantsSingle ? created[0] : created });
    }

    return route.fulfill({ status: 400, json: { message: `Fake Supabase can't handle ${method}` } });
  });

  return fake;
}
