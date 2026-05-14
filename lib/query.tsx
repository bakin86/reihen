"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:          30_000,       // 30s — don't refetch if data is fresh
        gcTime:             15 * 60_000,  // 15min — keep in memory across navigations
        refetchOnWindowFocus: false,      // don't hammer the API on tab switch
        refetchOnReconnect: "always",     // but do refresh on reconnect
        retry:              1,
        // Show stale data instantly while revalidating in background
        placeholderData:    (prev: unknown) => prev,
      },
    },
  });
}

let browserClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Call this to get the singleton client for prefetching */
export function getClient() {
  return getQueryClient();
}
