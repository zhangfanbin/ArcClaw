# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2025-06-12

### Added

- **Multi-agent system** with 5 specialized agents: Team Leader, PD (Product Designer), Frontend, Backend, QA
- **Extensible LLM provider system** — built-in support for OpenAI, Anthropic, DeepSeek, and Ollama
- **Provider registration API** — `arcclaw.registerProvider()` for custom providers
- **Task board** with dependency resolution and state machine transitions
- **Agent-to-agent messaging bus** with file-based persistence and chokidar watchers
- **Tool system** — bash execution, file read/write/edit, code search with per-agent permissions
- **REST API** with Server-Sent Events (SSE) for real-time updates
- **CLI binary** — `arcclaw start`, `arcclaw init`, `arcclaw providers`
- **Programmatic API** — use ArcClaw as a library via `new ArcClaw()`
- **LLM call logging** — full audit trail with token usage and duration tracking
- **Three-layer configuration** — programmatic overrides → config file → environment variables → defaults
- **React dashboard** (separate package) for monitoring agents, tasks, and LLM logs
