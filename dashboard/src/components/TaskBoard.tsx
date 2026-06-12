import { useTaskStore } from '../stores';
import type { Task } from '../api/client';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 ring-red-500/25',
  high: 'bg-orange-500/15 text-orange-400 ring-orange-500/25',
  medium: 'bg-amber-500/15 text-amber-400 ring-amber-500/25',
  low: 'bg-sky-500/15 text-sky-400 ring-sky-500/25',
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-400',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
  low: 'bg-sky-400',
};

const ASSIGNEE_COLORS: Record<string, string> = {
  pd: 'bg-violet-500/15 text-violet-400',
  frontend: 'bg-cyan-500/15 text-cyan-400',
  backend: 'bg-indigo-500/15 text-indigo-400',
  qa: 'bg-teal-500/15 text-teal-400',
  team_leader: 'bg-emerald-500/15 text-emerald-400',
};

const COLUMNS: { id: Task['status']; label: string; dot: string; gradient: string }[] = [
  { id: 'pending', label: 'Pending', dot: 'bg-amber-400', gradient: 'from-amber-500/8 to-transparent' },
  { id: 'in_progress', label: 'In Progress', dot: 'bg-blue-400', gradient: 'from-blue-500/8 to-transparent' },
  { id: 'completed', label: 'Completed', dot: 'bg-emerald-400', gradient: 'from-emerald-500/8 to-transparent' },
];

function TaskCard({ task }: { task: Task }) {
  const priorityDot = PRIORITY_DOT[task.priority] || 'bg-muted-fg';

  return (
    <div className="group rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm hover:shadow-lg hover:border-primary/20 hover:bg-card transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${priorityDot}`} />
          <h4 className="text-[13px] font-medium text-fg leading-snug truncate">{task.title}</h4>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md ring-1 ring-inset uppercase tracking-wide ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority}
        </span>
      </div>
      {task.description && (
        <p className="text-[12px] text-muted-fg line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.assignee && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${ASSIGNEE_COLORS[task.assignee] || 'bg-muted text-muted-fg'}`}>
            {task.assignee}
          </span>
        )}
        {task.dependencies.length > 0 && (
          <span className="text-[10px] text-muted-fg flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {task.dependencies.length}
          </span>
        )}
        {task.artifacts.length > 0 && (
          <span className="text-[10px] text-primary/80 flex items-center gap-1 ml-auto">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            {task.artifacts.length}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TaskBoard() {
  const tasks = useTaskStore((s) => s.tasks);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        return (
          <div key={col.id} className="flex flex-col gap-3">
            {/* Column header */}
            <div className={`rounded-xl bg-gradient-to-b ${col.gradient} border border-border/80 p-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${col.dot} shadow-[0_0_6px] shadow-current/30`} />
                  <h3 className="text-[13px] font-semibold text-fg">{col.label}</h3>
                </div>
                <span className="text-[11px] font-semibold text-muted-fg bg-muted/80 px-2 py-0.5 rounded-full min-w-[24px] text-center">
                  {colTasks.length}
                </span>
              </div>
            </div>
            {/* Task list */}
            <div className="flex flex-col gap-2 min-h-[200px]">
              {colTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {colTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-muted-fg/50 rounded-xl border border-dashed border-border/60">
                  <svg className="w-8 h-8 mb-2 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <span className="text-[11px]">No tasks</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
