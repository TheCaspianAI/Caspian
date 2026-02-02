import type { AppRouter } from "lib/api-types";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { env } from "renderer/env.renderer";
import superjson from "superjson";

/**
 * HTTP tRPC client for calling the API server.
 * For mutations only - for fetching data we already have electric
 */
export const apiTrpcClient = createTRPCProxyClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${env.NEXT_PUBLIC_API_URL}/api/trpc`,
			transformer: superjson,
		}),
	],
});
