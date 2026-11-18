import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { exportTasksToCsv, isOverdue } from '../lib/utils';
import {
  PriorityBarChart,
  StatusDonutChart,
  VelocityTrendChart,
} from '../components/Charts';
import { Avatar } from '../components/Avatar';

export function AnalyticsPage() {
  const { activeWorkspace, projects, tasks, members } = useWorkspace();

  const statusCounts = useMemo(
    () => ({
      todo: tasks.filter((t) => t.status === 'todo').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      in_review: tasks.filter((t) => t.status === 'in_review').length,
      done: tasks.filter((t) => t.status === 'done').length,
    }),
    [tasks]
  );

  const priorityCounts = useMemo(
    () => ({
      urgent: tasks.filter((t) => t.priority === 'urgent').length,
      high: tasks.filter((t) => t.priority === 'high').length,
      medium: tasks.filter((t) => t.priority === 'medium').length,
      low: tasks.filter((t) => t.priority === 'low').length,
    }),
    [tasks]
  );

  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t.dueDate, t.status)).length,
    [tasks]
  );

  const completionRate =
    tasks.length > 0 ? Math.round((statusCounts.done / tasks.length) * 100) : 0;

  const velocityPoints = useMemo(() => {
    const days: Array<{ label: string; iso: string; created: number; completed: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      days.push({ label, iso, created: 0, completed: 0 });
    }

    for (const t of tasks) {
      if (t.createdAt) {
        const createdIso = t.createdAt.toDate().toISOString().slice(0, 10);
        const bucket = days.find((d) => d.iso === createdIso);
        if (bucket) bucket.created += 1;
      }
      if (t.status === 'done' && t.updatedAt) {
        const doneIso = t.updatedAt.toDate().toISOString().slice(0, 10);
        const bucket = days.find((d) => d.iso === doneIso);
        if (bucket) bucket.completed += 1;
      }
    }
    return days;
  }, [tasks]);

  const memberWorkload = useMemo(() => {
    return members.map((m) => {
      const assigned = tasks.filter((t) => t.assigneeId === m.userId);
      const completed = assigned.filter((t) => t.status === 'done').length;
      const overdue = assigned.filter((t) => isOverdue(t.dueDate, t.status)).length;
      const open = assigned.length - completed;
      return { member: m, total: assigned.length, completed, open, overdue };
    });
  }, [members, tasks]);

  if (!activeWorkspace) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Select a workspace to inspect analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Live productivity metrics, delivery velocity, and workload balance for{' '}
            {activeWorkspace.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportTasksToCsv(tasks, `${activeWorkspace.slug}-tasks.csv`)}
          disabled={tasks.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Projects</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{projects.length}</div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {projects.filter((p) => p.status === 'active').length} active
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Tasks</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{tasks.length}</div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {statusCounts.in_progress + statusCounts.in_review} in flight
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Completion Rate</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {completionRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {statusCounts.done} tasks completed
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Overdue Tasks</div>
          <div
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''
            }`}
          >
            {overdueCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {tasks.length > 0 ? Math.round((overdueCount / tasks.length) * 100) : 0}% of total
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Task Status Breakdown
          </h2>
          <StatusDonutChart counts={statusCounts} />
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Priority Distribution
          </h2>
          <PriorityBarChart counts={priorityCounts} />
        </section>
      </div>

      {/* 14-Day Velocity Trend */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          14-Day Task Creation vs Completion
        </h2>
        <VelocityTrendChart points={velocityPoints} />
      </section>

      {/* Team Workload Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Member Workload & Productivity
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-6">Member</th>
                <th className="py-3 px-4 text-right">Assigned</th>
                <th className="py-3 px-4 text-right">Open</th>
                <th className="py-3 px-4 text-right">Completed</th>
                <th className="py-3 px-6 text-right">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {memberWorkload.map(({ member, total, open, completed, overdue }) => (
                <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-6">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.displayName} photoURL={member.photoURL} size="xs" />
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {member.displayName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{total}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{open}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {completed}
                  </td>
                  <td
                    className={`py-3 px-6 text-right font-mono tabular-nums ${
                      overdue > 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : ''
                    }`}
                  >
                    {overdue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
