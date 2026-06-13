import { useState, useEffect, useMemo, useCallback } from 'react';
import { api, type LLMLogEntry } from '../api/client';

const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  team_leader: { label: 'TL', color: 'bg-emerald-500/15 text-emerald-400' },
  pd: { label: 'PD', color: 'bg-violet-500/15 text-violet-400' },
  frontend: { label: 'FE', color: 'bg-cyan-500/15 text-cyan-400' },
  backend: { label: 'BE', color: 'bg-indigo-500/15 text-indigo-400' },
  qa: { label: 'QA', color: 'bg-teal-500/15 text-teal-400' },
};

const TIER_COLORS: Record<string, string> = {
  powerful: 'bg-amber-500/15 text-amber-400',
  fast: 'bg-sky-500/15 text-sky-400',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function LLMLogs() {
  const [entries, setEntries] = useState<LLMLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    try {
      const res = await api.getLLMLogs(50, 0);
      setEntries(res.entries);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load LLM logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const totalTokens = entries.reduce((s, e) => s + e.total_tokens, 0);
    const totalInputTokens = entries.reduce((s, e) => s + e.input_tokens, 0);
    const totalOutputTokens = entries.reduce((s, e) => s + e.output_tokens, 0);
    const avgDuration = entries.reduce((s, e) => s + e.duration_ms, 0) / entries.length;
    const errorCount = entries.filter((e) => e.error).length;
    return { totalTokens, totalInputTokens, totalOutputTokens, avgDuration, errorCount };
  }, [entries]);

  // Sort by timestamp descending (newest first)
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [entries],
  );

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total Calls" value={String(total)} sub={`${entries.length} shown`} />
          <StatCard label="Total Tokens" value={formatTokens(stats.totalTokens)} sub={`${formatTokens(stats.totalInputTokens)} in / ${formatTokens(stats.totalOutputTokens)} out`} />
          <StatCard label="Avg Duration" value={formatDuration(Math.round(stats.avgDuration))} />
          <StatCard label="Errors" value={String(stats.errorCount)} sub={stats.errorCount > 0 ? `${((stats.errorCount / entries.length) * 100).toFixed(1)}% rate` : '0%'} accent="text-destructive" />
          <StatCard label="Models" value={String(new Set(entries.map((e) => e.model)).size)} sub={Array.from(new Set(entries.map((e) => e.model))).join(', ')} />
        </div>
      )}

      {/* Log table */}
      <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border/80 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-fg">LLM Call Logs</h2>
          <button
            onClick={loadLogs}
            className="text-[11px] text-muted-fg hover:text-fg transition-colors flex items-center gap-1"
          >
            <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>

        {entries.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-fg/40">
            <svg className="w-14 h-14 mb-3 opacity-25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
              <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 0 1 9-9" />
            </svg>
            <p className="text-sm font-medium text-muted-fg/50">No LLM calls logged yet</p>
            <p className="text-xs mt-1">Logs will appear when agents make LLM requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[10px] font-semibold text-muted-fg uppercase tracking-wider px-4 py-2.5">Time</th>
                  <th className="text-left text-[10px] font-semibold text-muted-fg uppercase tracking-wider px-4 py-2.5">Agent</th>
                  <th className="text-left text-[10px] font-semibold text-muted-fg uppercase tracking-wider px-4 py-2.5">Model</th>
                  <th className="text-left text-[10px] font-semibold text-muted-fg uppercase tracking-wider px-4 py-2.5">Req / Task</th>
                  <th className="text-right text-[10px] font-semibold text-muted-fg uppercase tracking-wider px-4 py-2.5">Tokens</th>
                  <th className="text-right text-[10px] font-semibold text-muted-fg uppercase tracking-wider px-4 py-2.5">Duration</th>
                  <th className="text-center text-[10px] font-semibold text-muted-fg uppercase tracking-wider px-4 py-2.5">Status</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => {
                  const agent = AGENT_LABELS[entry.agent_id] || { label: entry.agent_id, color: 'bg-muted text-muted-fg' };
                  const isExpanded = expandedId === entry.id;
                  const isError = !!entry.error;

                  return (
                    <tr key={entry.id} className="group">
                      <td
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="px-4 py-2.5 border-b border-border/30 group-hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <span className="text-[11px] text-muted-fg tabular-nums">{formatTime(entry.timestamp)}</span>
                      </td>
                      <td
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="px-4 py-2.5 border-b border-border/30 group-hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${agent.color}`}>
                          {agent.label}
                        </span>
                      </td>
                      <td
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="px-4 py-2.5 border-b border-border/30 group-hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-fg font-medium">{entry.model}</span>
                          <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${TIER_COLORS[entry.model_tier] || 'bg-muted text-muted-fg'}`}>
                            {entry.model_tier}
                          </span>
                        </div>
                      </td>
                      <td
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="px-4 py-2.5 border-b border-border/30 group-hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <span className="text-[10px] text-muted-fg font-mono">
                          {entry.requirement_id ? entry.requirement_id.slice(0, 12) : '—'}
                          {entry.task_id && <> / {entry.task_id.slice(0, 12)}</>}
                        </span>
                      </td>
                      <td
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="px-4 py-2.5 border-b border-border/30 group-hover:bg-muted/30 cursor-pointer transition-colors text-right"
                      >
                        <span className="text-[11px] text-fg tabular-nums font-medium">
                          {formatTokens(entry.total_tokens)}
                        </span>
                        <span className="text-[9px] text-muted-fg ml-1">
                          ({formatTokens(entry.input_tokens)}/{formatTokens(entry.output_tokens)})
                        </span>
                      </td>
                      <td
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="px-4 py-2.5 border-b border-border/30 group-hover:bg-muted/30 cursor-pointer transition-colors text-right"
                      >
                        <span className={`text-[11px] tabular-nums ${entry.duration_ms > 30000 ? 'text-amber-400' : 'text-muted-fg'}`}>
                          {formatDuration(entry.duration_ms)}
                        </span>
                      </td>
                      <td
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="px-4 py-2.5 border-b border-border/30 group-hover:bg-muted/30 cursor-pointer transition-colors text-center"
                      >
                        {isError ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                            Error
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 border-b border-border/30 text-right">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="text-muted-fg hover:text-fg transition-colors"
                        >
                          <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      </td>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 bg-muted/20 border-b border-border/30">
                            <LogDetail entry={entry} />
                          </td>
                        </tr>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-3.5">
      <div className="text-[10px] text-muted-fg uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${accent || 'text-fg'}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-fg mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function LogDetail({ entry }: { entry: LLMLogEntry }) {
  return (
    <div className="space-y-4 text-[12px]">
      {/* Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DetailItem label="Log ID" value={entry.id} mono />
        <DetailItem label="Provider" value={entry.provider} />
        <DetailItem label="Finish Reason" value={entry.finish_reason} />
        <DetailItem label="Config" value={`max ${entry.max_tokens} tokens, temp ${entry.temperature}`} />
      </div>

      {/* Error */}
      {entry.error && (
        <div>
          <div className="text-[10px] font-semibold text-destructive uppercase tracking-wider mb-1">Error</div>
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-destructive font-mono text-[11px] whitespace-pre-wrap">
            {entry.error}
          </div>
        </div>
      )}

      {/* Tool Calls */}
      {entry.tool_calls.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-fg uppercase tracking-wider mb-1.5">
            Tool Calls ({entry.tool_calls.length})
          </div>
          <div className="space-y-1.5">
            {entry.tool_calls.map((tc, i) => (
              <div key={i} className="rounded-lg bg-muted/50 border border-border/50 p-2.5">
                <div className="text-[11px] font-semibold text-primary mb-1">{tc.name}</div>
                <pre className="text-[10px] text-muted-fg font-mono whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(tc.arguments, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Messages */}
      <div>
        <div className="text-[10px] font-semibold text-muted-fg uppercase tracking-wider mb-1.5">
          Input Messages ({entry.input_messages.length})
        </div>
        <div className="space-y-1.5">
          {entry.input_messages.map((msg, i) => (
            <div key={i} className="rounded-lg bg-muted/30 border border-border/40 p-2.5">
              <div className="text-[10px] font-semibold text-primary uppercase mb-1">{msg.role}</div>
              <pre className="text-[10px] text-muted-fg font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
                {msg.content}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Output */}
      {entry.output_text && (
        <div>
          <div className="text-[10px] font-semibold text-muted-fg uppercase tracking-wider mb-1.5">Output</div>
          <div className="rounded-lg bg-muted/30 border border-border/40 p-2.5">
            <pre className="text-[10px] text-muted-fg font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
              {entry.output_text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-muted-fg uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-[11px] text-fg ${mono ? 'font-mono' : ''} truncate`}>{value}</div>
    </div>
  );
}
