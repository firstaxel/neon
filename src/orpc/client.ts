import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { createContext } from "./context";
import { appRouter } from "./router";

const getORPCClient = createIsomorphicFn()
	.server(() =>
		createRouterClient(appRouter, {
			context: () => createContext(),
		})
	)
	.client((): RouterClient<typeof appRouter> => {
		const link = new RPCLink({
			url: `${window.location.origin}/api/rpc`,
		});
		return createORPCClient(link);
	});

export const client: RouterClient<typeof appRouter> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
