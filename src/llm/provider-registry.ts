import type { LLMProviderDefinition } from '../types/llm.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('provider-registry');

/** Internal registry of all available LLM providers. */
const providers = new Map<string, LLMProviderDefinition>();

/**
 * Register a provider definition. If a provider with the same name already
 * exists it will be overwritten (useful for replacing built-in providers).
 */
export function registerProvider(provider: LLMProviderDefinition): void {
  providers.set(provider.name, provider);
  logger.info({ provider: provider.name }, 'LLM provider registered');
}

/** Retrieve a provider by name. Returns undefined when not found. */
export function getProvider(name: string): LLMProviderDefinition | undefined {
  return providers.get(name);
}

/** List all registered provider names. */
export function listProviders(): string[] {
  return Array.from(providers.keys());
}

/** Check whether a provider is registered. */
export function hasProvider(name: string): boolean {
  return providers.has(name);
}

/** Remove all registered providers (mainly for testing). */
export function clearProviders(): void {
  providers.clear();
}
