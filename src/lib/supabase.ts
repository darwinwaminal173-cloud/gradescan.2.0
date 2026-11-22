import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.SUPABASE_URL || 
  ''
).trim();

const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.SUPABASE_ANON_KEY || 
  import.meta.env.SUPABASE_PUBLISHABLE_KEY || 
  ''
).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder') &&
  supabaseAnonKey !== 'YOUR_PROVIDED_PUBLISHABLE_KEY' &&
  supabaseAnonKey !== 'placeholder-anon-key' &&
  supabaseAnonKey !== 'your-supabase-publishable-or-anon-key'
);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://gwlcjytuafdoflposdsn.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Utility to test active connectivity to Supabase Auth and Database
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  authHealthy: boolean;
  tablesFound: string[];
  tablesMissing: string[];
  message: string;
}> {
  const expectedTables = [
    'profiles',
    'classes',
    'students',
    'class_students',
    'quizzes',
    'answer_keys',
    'exam_results',
    'exam_answers',
  ];

  if (!isSupabaseConfigured) {
    return {
      connected: false,
      authHealthy: false,
      tablesFound: [],
      tablesMissing: expectedTables,
      message: 'Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not set. GradeScan is currently operating in High-Fidelity Local Sandbox Mode with full offline functionality.',
    };
  }

  let authHealthy = false;
  try {
    const { error } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: any; error: any }>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3500))
    ]);
    authHealthy = !error;
  } catch (e) {
    authHealthy = false;
  }

  const tablesFound: string[] = [];
  const tablesMissing: string[] = [];

  for (const table of expectedTables) {
    try {
      const { error } = await Promise.race([
        supabase.from(table).select('id', { count: 'exact', head: true }),
        new Promise<{ data: any; error: any }>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3500))
      ]);
      if (!error || error.code === 'PGRST116') {
        tablesFound.push(table);
      } else if (error.code === '42P01' || error.message?.includes('does not exist')) {
        tablesMissing.push(table);
      } else {
        // Table exists but RLS prevented access, which confirms table exists!
        tablesFound.push(table);
      }
    } catch {
      tablesMissing.push(table);
    }
  }

  const connected = authHealthy;
  const message = tablesMissing.length === 0
    ? 'All tables found and Supabase is fully configured!'
    : `Connected to Supabase, but ${tablesMissing.length} tables are missing. Please execute the schema migration script in your Supabase SQL editor.`;

  return {
    connected,
    authHealthy,
    tablesFound,
    tablesMissing,
    message,
  };
}
