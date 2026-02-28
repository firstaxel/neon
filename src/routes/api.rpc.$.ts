import { RPCHandler } from "@orpc/server/fetch";
import { createFileRoute } from "@tanstack/react-router";
import { createContext } from "#/orpc/context";
import { appRouter } from "#/orpc/router";

const handler = new RPCHandler(appRouter);

async function handle({ request }: { request: Request }) {
	const context = await createContext();

	const { response } = await handler.handle(request, {
		prefix: "/api/rpc",
		context,
	});

	return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			HEAD: handle,
			GET: handle,
			POST: handle,
			PUT: handle,
			PATCH: handle,
			DELETE: handle,
		},
	},
});
