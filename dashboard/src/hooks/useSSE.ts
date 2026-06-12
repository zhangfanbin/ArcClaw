import { useEffect, useRef } from 'react';
import { useTaskStore, useAgentStore, useMessageStore } from '../stores';

const MAX_RETRIES = 5;
const RECONNECT_DELAY = 5000;

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const { addTask, updateTask } = useTaskStore();
  const { updateAgent } = useAgentStore();
  const { addMessage } = useMessageStore();

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const es = new EventSource('/api/events');
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        console.log('SSE connected');
        retriesRef.current = 0;
      });

      es.addEventListener('task_created', (event) => {
        const task = JSON.parse(event.data);
        addTask(task);
      });

      es.addEventListener('task_updated', (event) => {
        const task = JSON.parse(event.data);
        updateTask(task);
      });

      es.addEventListener('task_status_changed', (event) => {
        const { task } = JSON.parse(event.data);
        updateTask(task);
      });

      es.addEventListener('new_message', (event) => {
        const message = JSON.parse(event.data);
        addMessage(message);
      });

      es.addEventListener('agent_status', (event) => {
        const agent = JSON.parse(event.data);
        updateAgent(agent);
      });

      es.onerror = () => {
        es.close();
        if (cancelled) return;

        retriesRef.current += 1;
        if (retriesRef.current > MAX_RETRIES) {
          console.warn('SSE: max reconnection attempts reached, giving up');
          return;
        }

        console.log(`SSE disconnected, retry ${retriesRef.current}/${MAX_RETRIES} in ${RECONNECT_DELAY / 1000}s...`);
        timeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
      };
    };

    connect();

    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
}
