// src/server.ts
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { FastResponse } from "srvx";

globalThis.Response = FastResponse;

export default createServerEntry({
	fetch(request) {
		// You can add custom logic here before or after the default handler
		return handler.fetch(request);
	},
});
