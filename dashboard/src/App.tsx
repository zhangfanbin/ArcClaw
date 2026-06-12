import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api/client';
import { useSSE } from './hooks/useSSE';
import { useTaskStore, useAgentStore, useMessageStore, useRequirementStore } from './stores';
import TaskBoard from './components/TaskBoard';
import AgentPanel from './components/AgentPanel';
import MessageLog from './components/MessageLog';
import RequirementInput from './components/RequirementInput';
import LLMLogs from './components/LLMLogs';
import { ThemeProvider } from './components/ThemeProvider';
import { ModeToggle } from './components/ModeToggle';

type Tab = 'board' | 'agents' | 'messages' | 'requirements' | 'llm-logs';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'board', label: 'Task Board', icon: <BoardIcon /> },
  { id: 'agents', label: 'Agents', icon: <AgentsIcon /> },
  { id: 'messages', label: 'Messages', icon: <MessagesIcon /> },
  { id: 'requirements', label: 'Requirements', icon: <RequirementsIcon /> },
  { id: 'llm-logs', label: 'LLM Logs', icon: <LLMLogsIcon /> },
];

function BoardIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function AgentsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" />
      <circle cx="15" cy="17" r="3" />
      <path d="M5 21v-2a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v2" />
      <path d="M19 9v-2a4 4 0 0 0-4-4h0a4 4 0 0 0-4 4v2" />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function RequirementsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function LLMLogsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('board');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const { setTasks } = useTaskStore();
  const { setAgents } = useAgentStore();
  const { setMessages } = useMessageStore();
  const { setRequirements } = useRequirementStore();

  useSSE();

  const loadData = useCallback(async () => {
    const [tasksRes, agentsRes, messagesRes, reqsRes] = await Promise.allSettled([
      api.getTasks(),
      api.getAgents(),
      api.getMessages(),
      api.getRequirements(),
    ]);
    if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.tasks);
    if (agentsRes.status === 'fulfilled') setAgents(agentsRes.value.agents);
    if (messagesRes.status === 'fulfilled') setMessages(messagesRes.value.messages);
    if (reqsRes.status === 'fulfilled') setRequirements(reqsRes.value.requirements);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const activeIndex = TABS.findIndex((t) => t.id === activeTab);
  const activeTabEl = tabRefs.current[activeTab];

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-bg">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/50">
          <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-primary-fg font-bold text-sm shadow-sm shadow-primary/25">
                A
              </div>
              <span className="text-base font-semibold text-fg tracking-tight">ArcClaw</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-muted-fg">
                <span className="w-1 h-1 rounded-full bg-primary/60" />
                Team Agent Dashboard
              </span>
            </div>

            {/* Tabs */}
            <nav className="flex items-center gap-0.5 relative">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'text-primary'
                      : 'text-muted-fg hover:text-fg'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
              {/* Animated indicator */}
              {activeTabEl && (
                <div
                  className="absolute bottom-0 h-0.5 bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{
                    left: activeTabEl.offsetLeft,
                    width: activeTabEl.offsetWidth,
                  }}
                />
              )}
            </nav>

            <ModeToggle />
          </div>
        </header>

        {/* Content */}
        <main className="max-w-[1440px] mx-auto px-6 py-6">
          <div key={activeTab} className="animate-fade-in">
            {activeTab === 'board' && <TaskBoard />}
            {activeTab === 'agents' && <AgentPanel />}
            {activeTab === 'messages' && <MessageLog />}
            {activeTab === 'requirements' && <RequirementInput />}
            {activeTab === 'llm-logs' && <LLMLogs />}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
