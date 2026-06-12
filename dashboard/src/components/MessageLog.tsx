import { useState, useMemo } from 'react';
import { useMessageStore } from '../stores';

const TYPE_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  task_assignment: { dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  task_completed: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  review_request: { dot: 'bg-violet-400', text: 'text-violet-400', bg: 'bg-violet-500/10' },
  review_result: { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  status_update: { dot: 'bg-cyan-400', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  error: { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10' },
  clarification: { dot: 'bg-pink-400', text: 'text-pink-400', bg: 'bg-pink-500/10' },
  artifact: { dot: 'bg-teal-400', text: 'text-teal-400', bg: 'bg-teal-500/10' },
};

export default function MessageLog() {
  const messages = useMessageStore((s) => s.messages);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const types = useMemo(() => {
    const set = new Set(messages.map((m) => m.type));
    return Array.from(set);
  }, [messages]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: messages.length };
    messages.forEach((m) => { map[m.type] = (map[m.type] || 0) + 1; });
    return map;
  }, [messages]);

  const filtered = useMemo(() => {
    return messages
      .filter((m) => filter === 'all' || m.type === filter)
      .filter((m) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return m.subject.toLowerCase().includes(q) || m.body.toLowerCase().includes(q) || m.from.includes(q) || m.to.includes(q);
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [messages, filter, search]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-[13px] rounded-lg border border-border/80 bg-card text-fg placeholder:text-muted-fg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {['all', ...types].map((t) => {
            const active = filter === t;
            const typeStyle = TYPE_STYLES[t];
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${
                  active
                    ? typeStyle
                      ? `${typeStyle.bg} ${typeStyle.text}`
                      : 'bg-primary/10 text-primary'
                    : 'text-muted-fg hover:text-fg hover:bg-muted'
                }`}
              >
                {typeStyle && <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} />}
                {t === 'all' ? 'All' : t.replace(/_/g, ' ')}
                <span className={`tabular-nums ${active ? 'opacity-70' : 'opacity-40'}`}>
                  {counts[t] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-2">
        {filtered.map((msg) => {
          const typeStyle = TYPE_STYLES[msg.type];
          return (
            <div
              key={msg.id}
              className="group rounded-xl border border-border/80 bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/15 transition-all duration-200"
            >
              <div className="flex items-center gap-2 flex-wrap mb-2.5">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide ${typeStyle ? `${typeStyle.bg} ${typeStyle.text}` : 'bg-muted text-muted-fg'}`}>
                  {typeStyle && <span className={`w-1 h-1 rounded-full ${typeStyle.dot}`} />}
                  {msg.type.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] text-muted-fg flex items-center gap-1">
                  <span className="font-medium text-fg/70">{msg.from}</span>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                  <span className="font-medium text-fg/70">{msg.to}</span>
                </span>
                <span className="text-[10px] text-muted-fg/60 ml-auto tabular-nums">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <h4 className="text-[13px] font-semibold text-fg mb-1">{msg.subject}</h4>
              <p className="text-[12px] text-muted-fg leading-relaxed line-clamp-3 whitespace-pre-wrap">{msg.body}</p>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-fg/40">
            <svg className="w-16 h-16 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-base font-medium mb-1 text-muted-fg/60">
              {search ? 'No matching messages' : 'No messages yet'}
            </p>
            <p className="text-sm">
              {search ? 'Try a different search term' : 'Messages between agents will appear here'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
