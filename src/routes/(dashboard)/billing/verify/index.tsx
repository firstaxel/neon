import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import BillingVerifyPage from "#/features/billing/views/billing-verify";

const searchSchema = z.object({
	reference: z.string(),
	trxref: z.string(),
	type: z.enum(["subscription", "deposit"]).default("deposit"),
});

export const Route = createFileRoute("/(dashboard)/billing/verify/")({
	component: RouteComponent,
	validateSearch: searchSchema,
});

function RouteComponent() {
	const { reference, type } = Route.useSearch(); // Fully typed access

	return <BillingVerifyPage params={{ payType: type, reference }} />;
}
