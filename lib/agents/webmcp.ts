import { markdownPath } from "./discovery.ts";
import { PUBLIC_TOOLS, toolRequest, type PublicToolName } from "./tools-contract.ts";

type Tool = { name: string; description: string; inputSchema: object; annotations: object;
  execute: (args: unknown, agent?: { signal?: AbortSignal }) => Promise<unknown> };
export type BrowserModelContext = {
  registerTool: (tool: Tool, options?: { signal: AbortSignal }) => void | Promise<void>;
  unregisterTool?: (name: string) => void;
};

export function publicToolPage(path: string) {
  return markdownPath(path) || path === "/search";
}

/** Optional browser capability: no polyfill, permissions, cookies or UI changes. */
export function registerPublicBrowserTools(context: BrowserModelContext, fetcher: typeof fetch = fetch) {
  const lifetime = new AbortController();
  const names: string[] = [];
  for (const name of Object.keys(PUBLIC_TOOLS) as PublicToolName[]) {
    try {
      const registration = context.registerTool({ name, ...PUBLIC_TOOLS[name],
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (args, agent) => {
          const path = toolRequest(name, args);
          if (lifetime.signal.aborted) throw new Error("Tool is no longer available on this page");
          const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(15_000), ...(agent?.signal ? [agent.signal] : [])]);
          const response = await fetcher(path, { method: "GET", credentials: "omit", redirect: "error", signal,
            headers: { Accept: "application/json" } });
          if (!response.ok) throw new Error(`Public content request failed (${response.status})`);
          return response.json();
        },
      }, { signal: lifetime.signal });
      names.push(name);
      // Older implementations return void; rejected registrations must not break the page.
      void Promise.resolve(registration).catch(() => {});
    } catch { /* Unsupported experimental implementation: ordinary browsing continues. */ }
  }
  return () => {
    lifetime.abort();
    for (const name of names) { try { context.unregisterTool?.(name); } catch { /* Already removed by AbortSignal. */ } }
  };
}
