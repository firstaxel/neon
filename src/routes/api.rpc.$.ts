import { RPCHandler } from "@orpc/server/fetch";
import { GetMethodCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import { RPC_DEFAULT_ALLOW_METHODS } from "@orpc/server/standard";
import { createFileRoute } from "@tanstack/react-router";
import { createContext } from "#/orpc/context";
import { appRouter } from "#/orpc/router";

const handler = new RPCHandler(appRouter, {
	allowMethods: ["GET", ...RPC_DEFAULT_ALLOW_METHODS],
	plugins: [new GetMethodCsrfProtectionHandlerPlugin()],
});

async function handle({ request }: { request: Request }) {
	const context = await createContext();

	const { response } = await handler.handle(request, {
		context,
		prefix: "/api/rpc",
	});

	return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			DELETE: handle,
			GET: handle,
			HEAD: handle,
			PATCH: handle,
			POST: handle,
			PUT: handle,
		},
	},
});
