import { useState } from 'react';
import { api } from '../api/client';
import { useRequirementStore } from '../stores';

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending: 'bg-muted text-muted-fg border-border/50',
};

const DOT_COLORS: Record<string, string> = {
  completed: 'bg-emerald-400',
  in_progress: 'bg-blue-400',
  pending: 'bg-muted-fg/40',
};

export default function RequirementInput() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [retriggeringIds, setRetriggeringIds] = useState<Set<string>>(new Set());
  const [retriggerResult, setRetriggerResult] = useState<{ id: string; title: string } | null>(null);
  const { requirements, setRequirements } = useRequirementStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.submitRequirement({ title, description, priority });
      setResult(res);
      setTitle('');
      setDescription('');
      setPriority('medium');
      const reqs = await api.getRequirements();
      setRequirements(reqs.requirements);
    } catch (error) {
      console.error('Failed to submit requirement:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetrigger = async (reqId: string, reqTitle: string) => {
    setRetriggeringIds((prev) => new Set(prev).add(reqId));
    try {
      await api.retriggerRequirement(reqId);
      setRetriggerResult({ id: reqId, title: reqTitle });
      // Refresh requirements after a short delay to let the new task propagate
      setTimeout(async () => {
        const reqs = await api.getRequirements();
        setRequirements(reqs.requirements);
      }, 1000);
    } catch (error) {
      console.error('Failed to retrigger requirement:', error);
    } finally {
      setRetriggeringIds((prev) => {
        const next = new Set(prev);
        next.delete(reqId);
        return next;
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-fg">Submit New Requirement</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-fg">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Build a user authentication system"
              className="w-full h-9 px-3 text-[13px] rounded-lg border border-border/80 bg-bg text-fg placeholder:text-muted-fg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-fg">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe the requirement in detail..."
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-border/80 bg-bg text-fg placeholder:text-muted-fg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-fg">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full h-9 px-3 text-[13px] rounded-lg border border-border/80 bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238899b4%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !description.trim()}
            className="w-full h-10 text-[13px] font-semibold rounded-lg bg-gradient-to-r from-primary to-emerald-400 text-primary-fg hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm shadow-primary/20 active:scale-[0.98]"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </span>
            ) : 'Submit Requirement'}
          </button>
        </form>

        {result && (
          <div className="mt-4 flex items-start gap-2.5 bg-primary/10 border border-primary/20 rounded-lg p-3 animate-fade-in">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-px">
              <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-primary text-[13px] font-semibold">Requirement submitted successfully!</p>
              <p className="text-primary/60 text-[11px] mt-0.5">ID: {result.id}</p>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-muted-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-fg">Requirements History</h2>
          {requirements.length > 0 && (
            <span className="text-[11px] text-muted-fg ml-auto bg-muted px-2 py-0.5 rounded-full font-medium">
              {requirements.length} total
            </span>
          )}
        </div>

        {/* Retrigger success toast */}
        {retriggerResult && (
          <div className="mb-4 flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-lg p-3 animate-fade-in">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-primary text-[13px] font-semibold">Re-triggered successfully!</p>
              <p className="text-primary/60 text-[11px] mt-0.5 truncate">{retriggerResult.title}</p>
            </div>
            <button
              onClick={() => setRetriggerResult(null)}
              className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
          {requirements.map((req) => {
            const pct = req.total_tasks > 0 ? (req.completed_tasks / req.total_tasks) * 100 : 0;
            const barColor = req.status === 'completed'
              ? 'from-emerald-400 to-emerald-500'
              : req.status === 'in_progress'
              ? 'from-blue-400 to-primary'
              : 'from-muted-fg/30 to-muted-fg/40';
            const isRetriggering = retriggeringIds.has(req.id);

            return (
              <div key={req.id} className="rounded-xl border border-border/80 p-4 space-y-3 hover:border-primary/15 transition-colors duration-200 group">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[13px] font-semibold text-fg leading-snug">{req.title}</h3>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md border uppercase tracking-wide ${STATUS_STYLES[req.status] || ''}`}>
                    {req.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-muted-fg mb-1.5">
                    <span>Progress</span>
                    <span className="font-medium tabular-nums">{req.completed_tasks}/{req.total_tasks} tasks</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700 ease-out`}
                      style={{ width: `${Math.max(pct, req.total_tasks > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
                {req.tasks && req.tasks.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-border/50">
                    {req.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2.5 text-[12px]">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[task.status] || 'bg-muted-fg/40'}`} />
                        <span className="text-fg truncate">{task.title}</span>
                        {task.assignee && (
                          <span className="text-muted-fg shrink-0 ml-auto text-[10px]">{task.assignee}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Retrigger button */}
                <div className="flex justify-end pt-1 border-t border-border/30">
                  <button
                    onClick={() => handleRetrigger(req.id, req.title)}
                    disabled={isRetriggering}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-fg hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors py-1 px-2 rounded-md hover:bg-primary/5 opacity-0 group-hover:opacity-100 transition-all duration-200"
                  >
                    {isRetriggering ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Re-triggering...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        Re-trigger
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {requirements.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-fg/40">
              <svg className="w-14 h-14 mb-3 opacity-25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p className="text-sm font-medium text-muted-fg/50">No requirements yet</p>
              <p className="text-xs mt-1">Submit your first requirement to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
