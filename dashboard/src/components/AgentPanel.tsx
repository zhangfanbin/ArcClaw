import { useAgentStore } from '../stores';

const STATE_STYLES: Record<string, { dot: string; text: string; bg: string; label: string; pulse?: boolean }> = {
  idle: { dot: 'bg-slate-400', text: 'text-slate-400', bg: 'bg-slate-500/10', label: 'Idle' },
  thinking: { dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Thinking...', pulse: true },
  executing_tool: { dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Executing', pulse: true },
  waiting: { dot: 'bg-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Waiting' },
  error: { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10', label: 'Error' },
};

const AGENTS: Record<string, { name: string; role: string; icon: React.ReactNode; accent: string }> = {
  team_leader: {
    name: 'Team Leader', role: 'Orchestrator', accent: 'from-emerald-500/20 to-emerald-500/5',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 21v-2a4 4 0 0 1 4-4h5" />
        <circle cx="11" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  pd: {
    name: 'PD Agent', role: 'Product Manager', accent: 'from-violet-500/20 to-violet-500/5',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  frontend: {
    name: 'Frontend Agent', role: 'UI Developer', accent: 'from-cyan-500/20 to-cyan-500/5',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  backend: {
    name: 'Backend Agent', role: 'API Developer', accent: 'from-indigo-500/20 to-indigo-500/5',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  qa: {
    name: 'QA Agent', role: 'Test Engineer', accent: 'from-teal-500/20 to-teal-500/5',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
};

function AgentIcon({ id, accent }: { id: string; accent: string }) {
  const info = AGENTS[id];
  if (!info) return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-muted-fg`}>
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8" />
        <path d="M12 8v8" />
      </svg>
    </div>
  );
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-fg`}>
      {info.icon}
    </div>
  );
}

export default function AgentPanel() {
  const agents = useAgentStore((s) => s.agents);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {agents.map((agent) => {
        const info = AGENTS[agent.id];
        const accent = info?.accent || 'from-slate-500/20 to-slate-500/5';
        const state = STATE_STYLES[agent.state] || STATE_STYLES.idle;
        const contextPct = Math.min((agent.context_usage / 100000) * 100, 100);
        const barColor = contextPct > 80 ? 'from-yellow-400 to-orange-400' : contextPct > 50 ? 'from-primary to-emerald-400' : 'from-primary/60 to-primary';

        return (
          <div
            key={agent.id}
            className="group rounded-xl border border-border/80 bg-card p-5 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-200"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <AgentIcon id={agent.id} accent={accent} />
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-semibold text-fg truncate">{info?.name || agent.id}</h3>
                <p className="text-[11px] text-muted-fg">{info?.role || 'Agent'}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full ${state.text} ${state.bg} border border-current/10`}>
                <span className={`w-1.5 h-1.5 rounded-full ${state.dot} ${state.pulse ? 'animate-pulse shadow-[0_0_6px] shadow-current' : ''}`} />
                {state.label}
              </span>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-border via-border/60 to-transparent mb-4" />

            {/* Context Usage */}
            <div className="mb-4">
              <div className="flex justify-between text-[11px] text-muted-fg mb-1.5">
                <span>Context Usage</span>
                <span className="font-medium tabular-nums">{agent.context_usage.toLocaleString()} tokens</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700 ease-out`}
                  style={{ width: `${Math.max(contextPct, 2)}%` }}
                />
              </div>
            </div>

            {/* Current Task */}
            {agent.current_task_id && (
              <div className="text-[12px] bg-muted/60 rounded-lg px-3 py-2 mb-3 border border-border/50 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-muted-fg">Working on </span>
                <span className="text-fg font-medium truncate">{agent.current_task_id}</span>
              </div>
            )}

            {/* Error */}
            {agent.error && (
              <div className="text-[12px] text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-3 border border-destructive/20 flex items-start gap-2">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {agent.error}
              </div>
            )}

            {/* Last Activity */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-fg">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {new Date(agent.last_activity).toLocaleTimeString()}
            </div>
          </div>
        );
      })}

      {agents.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-24 text-muted-fg/40">
          <svg className="w-16 h-16 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
            <circle cx="9" cy="7" r="3" />
            <circle cx="15" cy="17" r="3" />
            <path d="M5 21v-2a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v2" />
            <path d="M19 9v-2a4 4 0 0 0-4-4h0a4 4 0 0 0-4 4v2" />
          </svg>
          <p className="text-base font-medium mb-1 text-muted-fg/60">No agents connected</p>
          <p className="text-sm">Start the ArcClaw server to see agent status</p>
        </div>
      )}
    </div>
  );
}
