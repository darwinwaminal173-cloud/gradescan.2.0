import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  FileQuestion, 
  FileText, 
  Camera, 
  ClipboardCheck, 
  BarChart3, 
  Settings, 
  ScanLine,
  CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const { isConfigured } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Students', href: '/students', icon: Users },
    { name: 'Classes', href: '/classes', icon: GraduationCap },
    { name: 'Quizzes', href: '/quizzes', icon: FileQuestion },
    { name: 'Answer Sheets', href: '/answer-sheets', icon: FileText },
    { name: 'Scan Papers', href: '/scan', icon: Camera, highlight: true },
    { name: 'Exam Results', href: '/results', icon: ClipboardCheck },
    { name: 'Reports & Analytics', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-800 to-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-700/20 ring-1 ring-brand-500/30">
          <ScanLine className="w-5 h-5 text-teal-100" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              Grade<span className="text-brand-700 dark:text-brand-400">Scan</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950/80 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800">
              PRO
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">OMR Examination System</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative',
                  isActive
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-950/70 dark:text-brand-300 font-semibold ring-1 ring-brand-200/50 dark:ring-brand-800/60 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50',
                  item.highlight && !isActive && 'text-brand-700 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-950/30'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={clsx(
                      'w-5 h-5 shrink-0 transition-colors',
                      isActive ? 'text-brand-700 dark:text-brand-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300',
                      item.highlight && !isActive && 'text-brand-700 dark:text-brand-400'
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                  {item.highlight && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs">
          <div className={clsx('w-2 h-2 rounded-full', isConfigured ? 'bg-emerald-500' : 'bg-brand-500 animate-ping')} />
          <span className="text-slate-600 dark:text-slate-400 font-medium truncate">
            {isConfigured ? 'Supabase Connected' : 'Local Sandbox Mode'}
          </span>
        </div>
      </div>
    </aside>
  );
};
