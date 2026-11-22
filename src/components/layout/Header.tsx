import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Sun, 
  Moon, 
  Camera, 
  LogOut, 
  User as UserIcon,
  Database,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';
import { offlineSync } from '@/services/offlineSync';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileSidebar }) => {
  const { profile, signOut, isConfigured } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [isOnline, setIsOnline] = useState(offlineSync.isOnline());
  const [pendingCount, setPendingCount] = useState(offlineSync.getPendingCount());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    return offlineSync.subscribe((online, count) => {
      setIsOnline(online);
      setPendingCount(count);
    });
  }, []);

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await offlineSync.syncPendingRecords();
      if (res.synced > 0) {
        alert(`Successfully synchronized ${res.synced} offline exam record(s) to Supabase!`);
      } else if (res.failed > 0) {
        alert(`${res.failed} record(s) could not sync yet. Will retry automatically.`);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
      {/* Mobile Toggle & Quick Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          Academic Year 2025-2026
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Offline / Cloud Sync Status Badge */}
        {(!isOnline || pendingCount > 0) && (
          <button
            onClick={handleManualSync}
            disabled={!isOnline || syncing}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all shadow-sm ${
              !isOnline 
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700' 
                : 'bg-brand-700 text-white hover:bg-brand-800 animate-pulse'
            }`}
            title={!isOnline ? 'Offline mode: answers saved locally' : 'Click to sync pending scans to Supabase'}
          >
            {!isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Offline ({pendingCount} queued)</span>
              </>
            ) : (
              <>
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>Sync Now ({pendingCount})</span>
              </>
            )}
          </button>
        )}

        {/* Supabase status badge */}
        <div 
          onClick={() => navigate('/settings')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          title="Click to view database connection in Settings"
        >
          <Database className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400" />
          <span>{isConfigured ? 'Supabase Cloud' : 'Local Sandbox Mode'}</span>
          {isConfigured ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-brand-500" />
          )}
        </div>

        {/* Quick Launch Camera Scanner */}
        <Button
          size="sm"
          variant="primary"
          onClick={() => navigate('/scan')}
          leftIcon={<Camera className="w-4 h-4" />}
          className="hidden sm:inline-flex"
        >
          Scan Sheet
        </Button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Teacher Profile / Sign Out */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 ring-1 ring-brand-300 dark:ring-brand-700 flex items-center justify-center font-bold text-xs">
            {profile?.full_name ? profile.full_name[0] : 'T'}
          </div>
          <div className="hidden lg:block text-left text-xs">
            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
              {profile?.full_name || 'Educator'}
            </p>
            <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
              {profile?.school_name || 'Teacher'}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
