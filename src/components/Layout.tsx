import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Kanban,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { createTask, createWorkspace } from '../lib/firestoreService';
import { Avatar } from './Avatar';
import { TaskModal, WorkspaceModal } from './Modals';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

function getBreadcrumb(pathname: string): string {
  if (pathname.startsWith('/dashboard')) return 'Overview';
  if (pathname.startsWith('/workspaces')) return 'Workspaces & Team';
  if (pathname.startsWith('/projects/')) return 'Projects / Details';
  if (pathname.startsWith('/projects')) return 'Projects';
  if (pathname.startsWith('/kanban')) return 'Kanban Board';
  if (pathname.startsWith('/tasks/')) return 'Tasks / Details';
  if (pathname.startsWith('/chat')) return 'Team Chat';
  if (pathname.startsWith('/calendar')) return 'Calendar';
  if (pathname.startsWith('/analytics')) return 'Analytics';
  if (pathname.startsWith('/notifications')) return 'Notifications';
  if (pathname.startsWith('/settings')) return 'Settings';
  return 'Dashboard';
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    projects,
    tasks,
    members,
    unreadNotificationsCount,
    totalUnreadMessages,
  } = useWorkspace();

  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const actor = {
    uid: user?.uid || '',
    displayName: profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  };

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/workspaces', label: 'Workspaces', icon: Layers },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/kanban', label: 'Kanban Board', icon: Kanban },
    {
      to: '/chat',
      label: 'Team Chat',
      icon: MessageSquare,
      badge: totalUnreadMessages,
    },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    {
      to: '/notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationsCount,
    },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isNavActive = (to: string) =>
    location.pathname === to ||
    (to === '/projects' && location.pathname.startsWith('/projects/')) ||
    (to === '/kanban' && location.pathname.startsWith('/tasks/'));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Brand Row */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <Link
          to="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100 font-semibold tracking-tight whitespace-nowrap shrink-0"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <CheckSquare className="w-4 h-4" />
          </div>
          {!collapsed && <span className="font-display text-base">TaskForge</span>}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:inline-flex p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Workspace Switcher */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 relative">
        <button
          type="button"
          onClick={() => setWsDropdownOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-md bg-indigo-600/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center justify-center shrink-0">
              {activeWorkspace ? activeWorkspace.name.slice(0, 1).toUpperCase() : 'W'}
            </span>
            {!collapsed && (
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                {activeWorkspace ? activeWorkspace.name : 'Select Workspace'}
              </span>
            )}
          </div>
          {!collapsed && <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        </button>

        {wsDropdownOpen && !collapsed && (
          <div className="absolute left-3 right-3 top-14 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1.5">
            <div className="px-3 py-1 text-[11px] font-medium text-slate-400">Workspaces</div>
            {workspaces.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                No workspaces yet
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      setWsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                      ws.id === activeWorkspace?.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-slate-200 dark:border-slate-800 mt-1 pt-1 px-1.5">
              <button
                type="button"
                onClick={() => {
                  setWsDropdownOpen(false);
                  setShowCreateWs(true);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                active
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </span>
              {!collapsed && typeof item.badge === 'number' && item.badge > 0 && (
                <span className="font-mono tabular-nums text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity"
          >
            <Avatar name={actor.displayName} photoURL={actor.photoURL} size="sm" />
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                  {actor.displayName}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {actor.email}
                </div>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-200 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, primary action + theme/notifications on right */}
        <header className="sticky top-0 z-20 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                {activeWorkspace ? activeWorkspace.name : 'TaskForge'}
              </span>
              <span aria-hidden="true">/</span>
              <span className="text-slate-900 dark:text-slate-100 font-medium truncate">
                {getBreadcrumb(location.pathname)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600" />
              )}
            </Link>

            {activeWorkspace && projects.some((p) => p.status !== 'archived') && (
              <button
                type="button"
                onClick={() => setShowCreateTask(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                New Task
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {showCreateWs && (
        <WorkspaceModal
          onClose={() => setShowCreateWs(false)}
          onSubmit={async (data) => {
            const newId = await createWorkspace(actor, data);
            setActiveWorkspaceId(newId);
          }}
        />
      )}

      {showCreateTask && (
        <TaskModal
          projects={projects}
          members={members}
          onClose={() => setShowCreateTask(false)}
          onSubmit={async (data) => {
            const proj = projects.find((p) => p.id === data.projectId);
            if (!proj) return;
            const projTasks = tasks.filter((t) => t.projectId === proj.id);
            await createTask({
              project: proj,
              existingProjectTasks: projTasks,
              actor,
              input: data,
            });
          }}
        />
      )}
    </div>
  );
}
