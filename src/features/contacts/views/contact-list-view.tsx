import { Download, History, UploadCloud, UserPlus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "#/components/shared/page-header";
import { Button } from "#/components/ui/button";
import { AddContactDialog } from "../components/add-contact-dialog";
import { ContactsTable } from "../components/contact-table";
import { CsvImportDialog } from "../components/csv-import-dialog";
import { ExportContactsDialog } from "../components/export-dialog";
import { ImportHistoryDialog } from "../components/import-history-dialog";

const ContactsListView = () => {
	const [addOpen, setAddOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<PageHeader
					description="View and manage your contacts, tags, and audience rosters"
					title="Contacts"
				/>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						className="gap-1.5 rounded-xl text-xs"
						onClick={() => setHistoryOpen(true)}
						size="sm"
						variant="ghost"
					>
						<History className="h-4 w-4" />
						Import History
					</Button>
					<ExportContactsDialog
						trigger={
							<Button
								className="gap-1.5 rounded-xl text-xs"
								size="sm"
								variant="outline"
							>
								<Download className="h-4 w-4" />
								Export
							</Button>
						}
					/>
					<Button
						className="gap-1.5 rounded-xl text-xs"
						onClick={() => setImportOpen(true)}
						size="sm"
						variant="outline"
					>
						<UploadCloud className="h-4 w-4" />
						Import CSV
					</Button>
					<Button
						className="gap-1.5 rounded-xl text-xs"
						onClick={() => setAddOpen(true)}
						size="sm"
					>
						<UserPlus className="h-4 w-4" />
						Add Contact
					</Button>
				</div>
			</div>

			<ContactsTable selectable={true} />

			<AddContactDialog onOpenChange={setAddOpen} open={addOpen} />
			<CsvImportDialog onOpenChange={setImportOpen} open={importOpen} />
			<ImportHistoryDialog onOpenChange={setHistoryOpen} open={historyOpen} />
		</div>
	);
};

export default ContactsListView;
