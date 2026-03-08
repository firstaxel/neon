import { UserPlus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "#/components/shared/page-header";
import { Button } from "#/components/ui/button";
import { AddContactDialog } from "../components/add-contact-dialog";
import { ContactsTable } from "../components/contact-table";

const ContactsListView = () => {
	const [addOpen, setAddOpen] = useState(false);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8">
			<div className="flex items-start justify-between">
				<PageHeader
					description="View and manage your contacts"
					title="Contacts"
				/>
				<Button
					className="gap-2 rounded-xl"
					onClick={() => setAddOpen(true)}
				>
					<UserPlus className="h-4 w-4" />
					Add Contact
				</Button>
			</div>

			<ContactsTable />

			<AddContactDialog onOpenChange={setAddOpen} open={addOpen} />
		</div>
	);
};

export default ContactsListView;
