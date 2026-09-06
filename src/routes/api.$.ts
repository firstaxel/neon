import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { createFileRoute } from "@tanstack/react-router";
import { createContext } from "#/orpc/context";
import { appRouter } from "#/orpc/router";

const generator = new OpenAPIGenerator({
	converters: [new ZodToJsonSchemaConverter()],
});

const handler = new OpenAPIHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
	plugins: [
		new SmartCoercionHandlerPlugin({
			converters: [new ZodToJsonSchemaConverter()],
		}),
		new OpenAPIReferenceHandlerPlugin({
			spec: () =>
				generator.generate(appRouter, {
					base: {
						components: {
							securitySchemes: {
								bearerAuth: {
									scheme: "bearer",
									type: "http",
								},
							},
						},
						info: {
							title: "Velocast API",
							version: "1.0.0",
						},
						security: [{ bearerAuth: [] }],
					},
				}),
		}),
	],
});

async function handle({ request }: { request: Request }) {
	const context = await createContext();

	const { response } = await handler.handle(request, {
		context,
		prefix: "/api",
	});

	return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/$")({
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
