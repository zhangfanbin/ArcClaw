#!/usr/bin/env node

import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ArcClaw } from './index.js';
import { listProviders } from './llm/provider-registry.js';
import { registerBuiltinProviders } from './llm/provider-factory.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('cli');

function getVersion(): string {
  try {
    const cliDir = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.join(cliDir, '..', 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    return JSON.parse(raw).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

const VERSION = getVersion();

// ---------------------------------------------------------------------------
// Arg helpers
// ---------------------------------------------------------------------------

function hasFlag(args: string[], ...flags: string[]): boolean {
  return flags.some((f) => args.includes(f));
}

function getArgValue(args: string[], ...flags: string[]): string | undefined {
  for (const flag of flags) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`
arcclaw v${VERSION}
Multi-agent AI collaboration platform for end-to-end software delivery.

USAGE
  arcclaw [command] [options]

COMMANDS
  start              Start API server + Dashboard (default if no command given)
  dashboard          Start only the Dashboard (requires API server running)
  init               Create .arcclaw/.env configuration file
  providers          List registered LLM providers
  help               Show this help message
  version            Show version

OPTIONS
  --config <path>    Path to arcclaw.config.json
  --port <number>    Override API port
  --provider <name>  Override LLM provider
  --model <name>     Override LLM model
  --no-dashboard     Start API server only (skip Dashboard)

ENVIRONMENT
  ArcClaw reads configuration from .arcclaw/.env.
  Run "arcclaw init" to generate the file.

EXAMPLES
  arcclaw init
  arcclaw start
  arcclaw start --config ./my-config.json
  arcclaw dashboard
  arcclaw dashboard --port 8080 --api-port 3000
  arcclaw providers
`);
}

function initCommand(): void {
  const arcclawDir = path.resolve('.arcclaw');
  const envPath = path.join(arcclawDir, '.env');

  if (!fs.existsSync(arcclawDir)) {
    fs.mkdirSync(arcclawDir, { recursive: true });
  }

  if (fs.existsSync(envPath)) {
    console.log(`.arcclaw/.env already exists. Edit it directly:\n  ${envPath}`);
    return;
  }

  const content = `# LLM Provider: openai | anthropic | ollama | deepseek
LLM_PROVIDER=openai

# API key for your chosen provider
OPENAI_API_KEY=sk-your-openai-key
# ANTHROPIC_API_KEY=sk-ant-your-key
# DEEPSEEK_API_KEY=sk-your-deepseek-key
# OLLAMA_BASE_URL=http://localhost:11434

# Models
LLM_MODEL=gpt-4o
LLM_MODEL_FAST=gpt-4o
LLM_MAX_TOKENS=4096
LLM_TEMPERATURE=0.7

# Agent settings
AGENT_MAX_STEPS=15
AGENT_CONTEXT_TOKEN_BUDGET=100000
AGENT_CONCURRENT_TASKS=1

# Server
API_PORT=3000
API_HOST=0.0.0.0
DASHBOARD_PORT=5173
`;

  fs.writeFileSync(envPath, content, 'utf-8');
  console.log(`Created ${envPath}`);
  console.log('Edit this file to configure your LLM provider and API keys.');
}

/**
 * Start the dashboard Express server (proxy + static files).
 * Returns a close function for graceful shutdown.
 */
async function startDashboardServer(
  dashboardPort: number,
  apiPort: number,
  apiHost: string,
): Promise<{ close: () => void }> {
  const pkgDir = path.dirname(fileURLToPath(import.meta.url));
  const dashboardDist = path.join(pkgDir, '..', 'dashboard', 'dist');

  if (!fs.existsSync(dashboardDist)) {
    logger.warn('Dashboard build not found, skipping dashboard. Run "npm run build:dashboard" first.');
    return { close: () => {} };
  }

  const { default: express } = await import('express');
  const app = express();

  // Proxy /api requests to the ArcClaw backend
  app.use('/api', (req, res) => {
    const headers: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key !== 'host') headers[key] = value;
    }

    const options: http.RequestOptions = {
      hostname: apiHost === '0.0.0.0' ? '127.0.0.1' : apiHost,
      port: apiPort,
      path: '/api' + req.url,
      method: req.method,
      headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') {
        res.status(502).json({
          error: 'API backend unreachable',
          detail: `Is arcclaw running on ${apiHost}:${apiPort}?`,
        });
      } else {
        res.status(502).json({ error: 'Proxy error', detail: err.message });
      }
    });

    req.pipe(proxyReq);
  });

  // Serve static dashboard files
  app.use(express.static(dashboardDist));

  // SPA fallback — serve index.html for any non-API route
  app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
      res.sendFile(path.join(dashboardDist, 'index.html'));
    }
  });

  return new Promise((resolve) => {
    const server = app.listen(dashboardPort, () => {
      logger.info(
        { dashboardPort, apiHost, apiPort },
        `Dashboard ready at http://localhost:${dashboardPort}`,
      );
      console.log(`  🎛️  Dashboard: http://localhost:${dashboardPort}`);
      resolve({ close: () => server.close() });
    });
  });
}

async function dashboardCommand(args: string[]): Promise<void> {
  console.log(`\n  🎛️  arcclaw dashboard v${VERSION}`);

  const portStr = getArgValue(args, '--port', '-p');
  const apiPortStr = getArgValue(args, '--api-port');

  const dashboardPort = portStr
    ? parseInt(portStr, 10)
    : parseInt(process.env.DASHBOARD_PORT || '5173', 10);
  const apiPort = apiPortStr
    ? parseInt(apiPortStr, 10)
    : parseInt(process.env.API_PORT || '3000', 10);
  const apiHost = process.env.API_HOST || 'localhost';

  await startDashboardServer(dashboardPort, apiPort, apiHost);
}

async function startCommand(args: string[]): Promise<void> {
  console.log(`\n  🚀 arcclaw v${VERSION}\n`);

  const configPath = getArgValue(args, '--config', '-c');
  const portStr = getArgValue(args, '--port', '-p');
  const provider = getArgValue(args, '--provider');
  const model = getArgValue(args, '--model');
  const noDashboard = hasFlag(args, '--no-dashboard');

  const overrides: any = {};
  if (portStr || provider || model) {
    overrides.api = portStr ? { port: parseInt(portStr, 10) } : undefined;
    overrides.llm = {};
    if (provider) overrides.llm.provider = provider;
    if (model) overrides.llm.model = model;
  }

  const app = new ArcClaw({
    config: Object.keys(overrides).length > 0 ? overrides : undefined,
    configPath,
  });

  let dashboardServer: { close: () => void } | null = null;

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    if (dashboardServer) dashboardServer.close();
    await app.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
  });

  await app.start();

  // Start dashboard alongside the API server
  if (!noDashboard) {
    const config = app.getConfig();
    const apiPort = config.api.port;
    const apiHost = config.api.host;
    const dashboardPort = config.dashboard.port;

    dashboardServer = await startDashboardServer(dashboardPort, apiPort, apiHost);

    console.log(`  🔗 API:       http://localhost:${apiPort}/api/health`);
    console.log(`  🎛️  Dashboard: http://localhost:${dashboardPort}\n`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Load .env from .arcclaw/.env (only affects start/dashboard commands)
  const dotenvPath = path.resolve('.arcclaw', '.env');
  dotenv.config({ path: dotenvPath });

  const args = process.argv.slice(2);
  const command = args[0] && !args[0].startsWith('-') ? args[0] : 'start';

  if (hasFlag(args, '--help', '-h') || command === 'help') {
    printHelp();
    return;
  }
  if (hasFlag(args, '--version', '-v') || command === 'version') {
    console.log(`arcclaw v${VERSION}`);
    return;
  }

  switch (command) {
    case 'start':
      await startCommand(args);
      break;
    case 'dashboard':
      await dashboardCommand(args);
      break;
    case 'init':
      initCommand();
      break;
    case 'providers':
      registerBuiltinProviders();
      console.log('Registered LLM providers:', listProviders().join(', '));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((error: any) => {
  const msg = error?.message || String(error);
  logger.error({ error: msg, stack: error?.stack }, 'Fatal error');
  process.exit(1);
});
