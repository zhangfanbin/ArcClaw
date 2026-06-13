#!/usr/bin/env node

import 'dotenv/config';
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
  start              Start ArcClaw (default if no command given)
  dashboard          Start the dashboard (requires ArcClaw API running)
  init               Print a sample .env configuration
  providers          List registered LLM providers
  help               Show this help message
  version            Show version

OPTIONS
  --config <path>    Path to arcclaw.config.json
  --port <number>    Override API port
  --provider <name>  Override LLM provider
  --model <name>     Override LLM model

ENVIRONMENT
  ArcClaw is configured via environment variables or a .env file.
  Run "arcclaw init" to see all available options.

EXAMPLES
  arcclaw start
  arcclaw start --config ./my-config.json
  arcclaw dashboard
  arcclaw dashboard --port 8080 --api-port 3000
  arcclaw providers
`);
}

function printInit(): void {
  console.log(`
# Copy this into your .env file and adjust values:

# LLM Provider: openai | anthropic | ollama | deepseek
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

# Runtime directory (default: .arcclaw)
# All runtime data (tasks, messages, llm-logs, agent configs) lives under this directory.
# ARCCLAW_HOME=.arcclaw

# Legacy path overrides (prefer ARCCLAW_HOME instead)
# DATA_DIR=.arcclaw/data
# WORKSPACE_DIR=.arcclaw
# PROMPTS_DIR=./prompts   # override to use custom prompts
`);
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

  // Resolve dashboard dist path relative to this module
  const pkgDir = path.dirname(fileURLToPath(import.meta.url));
  const dashboardDist = path.join(pkgDir, '..', 'dashboard', 'dist');

  if (!fs.existsSync(dashboardDist)) {
    console.error(`Dashboard build not found at ${dashboardDist}`);
    console.error('Run "npm run build:dashboard" first or clone the full repo.');
    process.exit(1);
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

  app.listen(dashboardPort, () => {
    logger.info(
      { dashboardPort, apiHost, apiPort },
      `Dashboard ready at http://localhost:${dashboardPort} → /api → ${apiHost}:${apiPort}`,
    );
    console.log(`\n  🎛️  Dashboard: http://localhost:${dashboardPort}`);
    console.log(`  🔗 API proxy: /api → http://${apiHost}:${apiPort}\n`);
  });
}

async function startCommand(args: string[]): Promise<void> {
  console.log(`\n  🚀 arcclaw v${VERSION}\n`);

  const configPath = getArgValue(args, '--config', '-c');
  const portStr = getArgValue(args, '--port', '-p');
  const provider = getArgValue(args, '--provider');
  const model = getArgValue(args, '--model');

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

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    await app.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
  });

  await app.start();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
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
      printInit();
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
