import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { PRIORITY_LABELS, priorityColorClasses, todayIsoDate } from '../lib/utils';

export function CalendarPage() {
  const { activeWorkspace, projects, tasks } = useWorkspace();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [projectFilter, setProjectFilter] = useState('all');
  const [onlyMilestones, setOnlyMilestones] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(todayIsoDate());

  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.dueDate) return false;
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      if (onlyMilestones && !t.isMilestone) return false;
      return true;
    });
  }, [tasks, projectFilter, onlyMilestones]);

  const filteredDeadlines = useMemo(() => {
    return projects.filter((p) => {
      if (!p.deadline) return false;
      if (projectFilter !== 'all' && p.id !== projectFilter) return false;
      return true;
    });
  }, [projects, projectFilter]);

  const toIso = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const selectedTasks = filteredTasks.filter((t) => t.dueDate === selectedDay);
  const selectedProjects = filteredDeadlines.filter((p) => p.deadline === selectedDay);

  if (!activeWorkspace) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Select a workspace to view the schedule calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Calendar
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Track task due dates, milestones, and project target deadlines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={onlyMilestones}
              onChange={(e) => setOnlyMilestones(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600"
            />
            Milestones only
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {monthName}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = new Date();
                  setYear(t.getFullYear());
                  setMonth(t.getMonth());
                  setSelectedDay(todayIsoDate());
                }}
                className="px-3 py-1 text-xs font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
              >
                Today
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2 px-2 text-center">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: firstWeekday }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="min-h-[96px] border-b border-r border-slate-100 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-950/30"
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const iso = toIso(day);
              const dayTasks = filteredTasks.filter((t) => t.dueDate === iso);
              const dayProjs = filteredDeadlines.filter((p) => p.deadline === iso);
              const isToday = iso === todayIsoDate();
              const isSelected = iso === selectedDay;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(iso)}
                  className={`min-h-[96px] p-2 border-b border-r border-slate-100 dark:border-slate-800/70 text-left align-top flex flex-col gap-1 transition-colors ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <span
                    className={`font-mono text-xs tabular-nums inline-flex items-center justify-center w-6 h-6 rounded-md ${
                      isToday
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {day}
                  </span>

                  <div className="w-full space-y-1">
                    {dayProjs.map((p) => (
                      <div
                        key={p.id}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 truncate"
                      >
                        {p.key} Deadline
                      </div>
                    ))}
                    {dayTasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 truncate flex items-center gap-1"
                      >
                        {t.isMilestone && <Flag className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                        <span className="truncate">{t.taskKey}</span>
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-[10px] text-slate-400 font-mono pl-1">
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details */}
        <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Selected Date</div>
            <div className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {selectedDay}
            </div>
          </div>

          {selectedProjects.length === 0 && selectedTasks.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No deadlines or milestones scheduled for this date.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedProjects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="block p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20"
                >
                  <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                    Project Deadline · {p.key}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {p.name}
                  </div>
                </Link>
              ))}

              {selectedTasks.map((t) => (
                <Link
                  key={t.id}
                  to={`/tasks/${t.id}`}
                  className="block p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-500">{t.taskKey}</span>
                    <span className={priorityColorClasses(t.priority)}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100 mt-1">
                    {t.title}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
