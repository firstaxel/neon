import { PageHeader } from "#/components/shared/page-header";
import { ContactsTable } from "../components/contact-table";

const ContactsListView = () => {
	return (
		<div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8">
			<PageHeader
				description="View and manage your contacts"
				title="Contacts"
			/>

			<ContactsTable />
		</div>
	);
};

export default ContactsListView;
