import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, schoolName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  loginAsDemo: () => void;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo fallback teacher for offline / zero-config preview
const DEMO_USER: User = {
  id: 'default-teacher',
  app_metadata: {},
  user_metadata: { full_name: 'Dr. Evelyn Reed', school_name: 'Horizon Science Academy' },
  aud: 'authenticated',
  email: 'teacher@gradescan.edu',
  created_at: new Date().toISOString(),
} as User;

const DEMO_PROFILE: Profile = {
  id: 'default-teacher',
  email: 'teacher@gradescan.edu',
  full_name: 'Dr. Evelyn Reed',
  school_name: 'Horizon Science Academy',
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Helper for timeout on promises
function withTimeout<T>(promiseLike: Promise<T> | PromiseLike<T>, ms = 3500): Promise<T> {
  const promise = Promise.resolve(promiseLike);
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Network timeout')), ms))
  ]);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to load saved local session
  const restoreLocalSession = () => {
    try {
      const savedUser = localStorage.getItem('gradescan_local_user') || localStorage.getItem('smartgrade_local_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.user && parsed?.profile) {
          setUser(parsed.user);
          setProfile(parsed.profile);
          return true;
        }
      }
    } catch (e) {
      console.warn('Failed restoring local user session:', e);
    }
    return false;
  };

  useEffect(() => {
    const initAuth = async () => {
      // 1. If Supabase is not configured, load local user
      if (!isSupabaseConfigured) {
        if (!restoreLocalSession()) {
          setUser(DEMO_USER);
          setProfile(DEMO_PROFILE);
        }
        setIsLoading(false);
        return;
      }

      // 2. If Supabase is configured, try to fetch session with timeout
      try {
        const { data: { session: currentSession } } = await withTimeout(supabase.auth.getSession(), 3000);
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await fetchProfile(currentSession.user);
        } else {
          // If no Supabase session, check if there's an active local session
          restoreLocalSession();
        }
      } catch (e) {
        console.warn('Supabase session check skipped or unreachable, checking local session:', e);
        restoreLocalSession();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Setup listener only if Supabase is configured
    let subscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured) {
      try {
        const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (newSession?.user) {
            setSession(newSession);
            setUser(newSession.user);
            await fetchProfile(newSession.user);
            setIsLoading(false);
          }
        });
        subscription = data.subscription;
      } catch (e) {
        console.warn('Supabase onAuthStateChange error:', e);
      }
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const fetchProfile = async (currentUser: User) => {
    try {
      const { data, error } = await withTimeout<any>(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single(),
        3000
      );

      if (!error && data) {
        setProfile(data);
        return;
      }
    } catch {
      // Fallback
    }

    setProfile({
      id: currentUser.id,
      email: currentUser.email || '',
      full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Educator',
      school_name: currentUser.user_metadata?.school_name || 'Academic Institution',
      avatar_url: null,
      created_at: currentUser.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  /**
   * One-Click Instant Demo Login (Zero network latency, 100% offline-ready)
   */
  const loginAsDemo = () => {
    setUser(DEMO_USER);
    setProfile(DEMO_PROFILE);
    localStorage.setItem('gradescan_local_user', JSON.stringify({ user: DEMO_USER, profile: DEMO_PROFILE }));
    setIsLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    // 1. Quick Demo Bypass
    if (email === 'teacher@gradescan.edu' || email === 'teacher@smartgrade.edu' || email === 'demo@gradescan.edu') {
      loginAsDemo();
      return;
    }

    // 2. Try Supabase Auth if configured and reachable
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          4000
        );

        if (!error && data?.user) {
          setUser(data.user);
          await fetchProfile(data.user);
          localStorage.removeItem('gradescan_local_user');
          return;
        }

        // If server responded with actual authentication error (e.g. invalid credentials)
        if (error && !error.message?.includes('fetch') && !error.message?.includes('Load failed')) {
          throw error;
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        const isNetworkErr = msg.includes('Load failed') || msg.includes('Failed to fetch') || msg.includes('timeout') || msg.includes('Network');
        if (!isNetworkErr) {
          throw err;
        }
        console.warn('Supabase offline or unreachable, checking local credentials:', msg);
      }
    }

    // 3. Check Local Accounts Registry (Offline / Local Mode)
    let localAccounts: Record<string, { password?: string; user: User; profile: Profile }> = {};
    try {
      localAccounts = JSON.parse(localStorage.getItem('gradescan_local_accounts') || localStorage.getItem('smartgrade_local_accounts') || '{}');
    } catch {}

    const localAcc = localAccounts[email.toLowerCase()];
    if (localAcc) {
      if (localAcc.password && localAcc.password !== password) {
        throw new Error('Incorrect password. Please verify your credentials.');
      }
      setUser(localAcc.user);
      setProfile(localAcc.profile);
      localStorage.setItem('gradescan_local_user', JSON.stringify({ user: localAcc.user, profile: localAcc.profile }));
      return;
    }

    // 4. Check if currently saved local session matches
    try {
      const saved = localStorage.getItem('smartgrade_local_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.user?.email?.toLowerCase() === email.toLowerCase()) {
          setUser(parsed.user);
          setProfile(parsed.profile);
          return;
        }
      }
    } catch {}

    // 5. If first time logging in without Supabase, automatically create local educator session!
    const localId = 'teacher_' + email.replace(/[^a-z0-9]/gi, '_');
    const newLocalUser: User = {
      id: localId,
      app_metadata: {},
      user_metadata: { full_name: email.split('@')[0], school_name: 'School' },
      aud: 'authenticated',
      email,
      created_at: new Date().toISOString(),
    } as User;

    const newLocalProfile: Profile = {
      id: localId,
      email,
      full_name: email.split('@')[0],
      school_name: 'School',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUser(newLocalUser);
    setProfile(newLocalProfile);
    localStorage.setItem('gradescan_local_user', JSON.stringify({ user: newLocalUser, profile: newLocalProfile }));
    localAccounts[email.toLowerCase()] = { password, user: newLocalUser, profile: newLocalProfile };
    localStorage.setItem('gradescan_local_accounts', JSON.stringify(localAccounts));
  };

  const signUp = async (email: string, password: string, fullName: string, schoolName?: string) => {
    // 1. Attempt Supabase Auth first
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName, school_name: schoolName }
            }
          }),
          4000
        );

        if (!error && data?.user) {
          setUser(data.user);
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: data.user.email!,
              full_name: fullName,
              school_name: schoolName || null,
            });
          } catch (e) {
            console.warn('Profiles table insert deferred:', e);
          }
          await fetchProfile(data.user);
          return;
        }

        // Real auth error from server (e.g., user already exists)
        if (error && !error.message?.includes('fetch') && !error.message?.includes('Load failed')) {
          throw error;
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        const isNetworkErr = msg.includes('Load failed') || msg.includes('Failed to fetch') || msg.includes('timeout') || msg.includes('Network');
        if (!isNetworkErr) {
          throw err;
        }
        console.warn('Supabase offline or unreachable, activating local account registration:', msg);
      }
    }

    // 2. Local Account Registration (Guaranteed 100% Success)
    const localId = 'teacher_' + email.replace(/[^a-z0-9]/gi, '_') + '_' + Date.now().toString(36);
    const mockUser: User = {
      id: localId,
      app_metadata: {},
      user_metadata: { full_name: fullName, school_name: schoolName || 'School' },
      aud: 'authenticated',
      email,
      created_at: new Date().toISOString(),
    } as User;

    const mockProf: Profile = {
      id: localId,
      email,
      full_name: fullName,
      school_name: schoolName || 'Educational Institute',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUser(mockUser);
    setProfile(mockProf);
    localStorage.setItem('gradescan_local_user', JSON.stringify({ user: mockUser, profile: mockProf }));

    // Save in local accounts registry
    try {
      const localAccounts = JSON.parse(localStorage.getItem('gradescan_local_accounts') || localStorage.getItem('smartgrade_local_accounts') || '{}');
      localAccounts[email.toLowerCase()] = { password, user: mockUser, profile: mockProf };
      localStorage.setItem('gradescan_local_accounts', JSON.stringify(localAccounts));
    } catch {}
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    setSession(null);
    localStorage.removeItem('gradescan_local_user');
    localStorage.removeItem('smartgrade_local_user');

    if (isSupabaseConfigured) {
      try {
        await withTimeout(supabase.auth.signOut(), 2000);
      } catch {}
    }
  };

  const resetPassword = async (email: string) => {
    if (isSupabaseConfigured) {
      try {
        const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email), 3000);
        if (error) throw error;
      } catch {}
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (isSupabaseConfigured) {
      try {
        const { error } = await withTimeout(supabase.auth.updateUser({ password: newPassword }), 4000);
        if (error) throw error;
      } catch (err: any) {
        console.warn('Supabase updateUser password note:', err);
        throw err;
      }
    }
    // Also update in local user account registry
    if (user?.email) {
      try {
        const localAccounts = JSON.parse(
          localStorage.getItem('gradescan_local_accounts') || 
          localStorage.getItem('smartgrade_local_accounts') || 
          '{}'
        );
        if (localAccounts[user.email.toLowerCase()]) {
          localAccounts[user.email.toLowerCase()].password = newPassword;
          localStorage.setItem('gradescan_local_accounts', JSON.stringify(localAccounts));
        }
      } catch {}
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    if (profile) {
      const updated = { ...profile, ...updates, updated_at: new Date().toISOString() };
      setProfile(updated);
      localStorage.setItem('gradescan_local_user', JSON.stringify({ user, profile: updated }));
    }

    if (isSupabaseConfigured) {
      try {
        await withTimeout<any>(
          supabase.from('profiles').update(updates).eq('id', user.id),
          3000
        );
      } catch (e) {
        console.warn('Profile update deferred:', e);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      isLoading,
      isConfigured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      loginAsDemo,
      resetPassword,
      updatePassword,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
