import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "#/components/shared/page-header";
import { ParseJobCard } from "#/features/parsing/components/parsed-card";
import {
	useGetParsing,
	useInvalidateParsing,
} from "#/features/parsing/hooks/useParsing";
import { Uploader } from "#/features/upload/components";
import { pageHeadMeta } from "#/lib/metadata";

export const Route = createFileRoute("/(dashboard)/dashboard/")({
	component: RouteComponent,
	head: () => ({
		meta: [pageHeadMeta.dashboard],
	}),
});

function RouteComponent() {
	const { data: parsing } = useGetParsing();
	const invalidateParsing = useInvalidateParsing();
	return (
		<div className="mx-auto h-full w-full max-w-7xl space-y-4 py-10">
			<PageHeader
				description="Upload your contacts and parse them"
				title="Dashboard"
			/>
			<div className="flex flex-col items-center justify-center">
				<Uploader
					onUploadComplete={() => {
						invalidateParsing();
					}}
				/>
			</div>

			<div className="space-y-4 px-4 py-8">
				<div className="flex flex-col gap-1">
					<h1 className="text-balance font-semibold text-2xl text-foreground">
						Parsing Contacts
					</h1>
					<p className="text-muted-foreground text-sm">
						We are current parsing the contacts from the uploaded files.
					</p>
				</div>

				{parsing?.data.map((parse) => (
					<ParseJobCard {...parse} key={parse.jobId} />
				))}
			</div>
		</div>
	);
}
