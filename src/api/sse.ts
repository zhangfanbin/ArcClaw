import type { Response } from 'express';

/**
 * Server-Sent Events broadcaster for real-time dashboard updates.
 */
export class SSEBroadcaster {
  private clients: Set<Response> = new Set();

  /**
   * Add a new SSE client.
   */
  addClient(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    this.clients.add(res);

    // Remove client on close
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  /**
   * Remove a client.
   */
  removeClient(res: Response): void {
    this.clients.delete(res);
  }

  /**
   * Broadcast an event to all connected clients.
   */
  broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Get the number of connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
