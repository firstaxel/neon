import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { BillingVerifyView } from "#/features/billing/views/billing-verify";

const searchSchema = z.object({
	reference: z.string().optional(),
	trxref: z.string().optional(),
	type: z.string().optional().default("deposit"),
});

export const Route = createFileRoute("/(dashboard)/billing/verify/")({
	component: RouteComponent,
	validateSearch: searchSchema,
});

function RouteComponent() {
	const { reference, trxref } = Route.useSearch();
	const paymentRef = reference || trxref || "";

	return <BillingVerifyView reference={paymentRef} />;
}
