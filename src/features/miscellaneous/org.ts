/**
 * src/lib/org.ts
 *
 * All org-type-aware display logic lives here.
 * Every label that used to be church-specific ("First Timer", "Member",
 * "Prayer & Support") is now looked up through this module using the
 * user's orgType from their profile.
 *
 * Usage:
 *   import { getContactTypeLabels, getScenarioLabels } from "@/lib/org";
 *   const labels = getContactTypeLabels("ngo");
 *   labels.new_contact  // → "New Beneficiary"
 */

export type OrgType =
	| "business"
	| "school"
	| "community"
	| "church"
	| "ngo"
	| "other";

// ─── Contact type labels ───────────────────────────────────────────────────────
//
// The underlying ContactType values ("new_contact", "contact", etc.) never
// change — they're stored in the DB. Only the display labels flex.

export interface ContactTypeLabels {
	contact: string;
	new_contact: string;
	prospect: string;
	returning: string;
}

const CONTACT_TYPE_LABELS: Record<OrgType, ContactTypeLabels> = {
	business: {
		contact: "Client",
		new_contact: "New Customer",
		prospect: "Lead",
		returning: "Returning",
	},
	church: {
		contact: "Member",
		new_contact: "New Contact",
		prospect: "Visitor",
		returning: "Returning",
	},
	community: {
		contact: "Member",
		new_contact: "New Member",
		prospect: "Guest",
		returning: "Returning",
	},
	ngo: {
		contact: "Partner",
		new_contact: "New Beneficiary",
		prospect: "Guest",
		returning: "Returning",
	},
	other: {
		contact: "Member",
		new_contact: "New Contact",
		prospect: "Guest",
		returning: "Returning",
	},
	school: {
		contact: "Student",
		new_contact: "New Student",
		prospect: "Visitor",
		returning: "Returning",
	},
};

export function getContactTypeLabels(
	orgType?: string | null
): ContactTypeLabels {
	return (
		CONTACT_TYPE_LABELS[(orgType as OrgType) ?? "other"] ??
		CONTACT_TYPE_LABELS.other
	);
}

// ─── Scenario labels ───────────────────────────────────────────────────────────

export interface ScenarioMeta {
	description: string;
	icon: string;
	label: string;
}

type ScenarioId =
	| "first_timer"
	| "follow_up"
	| "event_invite"
	| "request"
	| "general";

const SCENARIO_META: Record<OrgType, Record<ScenarioId, ScenarioMeta>> = {
	business: {
		event_invite: {
			description: "Invite customers to an event or promotion",
			icon: "🎉",
			label: "Event / Promotion",
		},
		first_timer: {
			description: "Welcome a new customer or client",
			icon: "✨",
			label: "New Customer Welcome",
		},
		follow_up: {
			description: "Check in with existing customers",
			icon: "🔄",
			label: "Follow-Up",
		},
		general: {
			description: "Send a broadcast to your customer base",
			icon: "📢",
			label: "General Update",
		},
		request: {
			description: "Reach out to check on satisfaction or offer help",
			icon: "💬",
			label: "Customer Care",
		},
	},
	church: {
		event_invite: {
			description: "Invite people to an upcoming service or event",
			icon: "🎉",
			label: "Event Invitation",
		},
		first_timer: {
			description: "Warm welcome for first-time visitors",
			icon: "✨",
			label: "First Timer Welcome",
		},
		follow_up: {
			description: "Check in with existing members",
			icon: "🔄",
			label: "Follow-Up",
		},
		general: {
			description: "Broadcast a message to your congregation",
			icon: "📢",
			label: "General Announcement",
		},
		request: {
			description: "Offer prayer and spiritual support",
			icon: "🙏",
			label: "Prayer & Support",
		},
	},
	community: {
		event_invite: {
			description: "Invite members to a community event",
			icon: "🎉",
			label: "Event Invitation",
		},
		first_timer: {
			description: "Welcome someone joining for the first time",
			icon: "✨",
			label: "New Member Welcome",
		},
		follow_up: {
			description: "Check in with community members",
			icon: "🔄",
			label: "Follow-Up",
		},
		general: {
			description: "Send a broadcast to your community",
			icon: "📢",
			label: "Community Update",
		},
		request: {
			description: "Reach out to offer support to a member",
			icon: "🤝",
			label: "Member Support",
		},
	},
	ngo: {
		event_invite: {
			description: "Invite contacts to a programme or workshop",
			icon: "🎉",
			label: "Event / Workshop",
		},
		first_timer: {
			description: "Welcome new beneficiaries or volunteers",
			icon: "✨",
			label: "New Beneficiary",
		},
		follow_up: {
			description: "Check in with existing contacts",
			icon: "🔄",
			label: "Follow-Up",
		},
		general: {
			description: "Broadcast an update to your network",
			icon: "📢",
			label: "General Announcement",
		},
		request: {
			description: "Reach out to offer care or support",
			icon: "🤝",
			label: "Welfare Check",
		},
	},
	other: {
		event_invite: {
			description: "Invite contacts to an upcoming event",
			icon: "🎉",
			label: "Event Invitation",
		},
		first_timer: {
			description: "Welcome someone for the first time",
			icon: "✨",
			label: "First-Time Welcome",
		},
		follow_up: {
			description: "Check in with existing contacts",
			icon: "🔄",
			label: "Follow-Up",
		},
		general: {
			description: "Send a broadcast to your contacts",
			icon: "📢",
			label: "General Announcement",
		},
		request: {
			description: "Reach out to offer support",
			icon: "🙏",
			label: "Care & Support",
		},
	},
	school: {
		event_invite: {
			description: "Invite to a school event or open day",
			icon: "🎉",
			label: "Event Invitation",
		},
		first_timer: {
			description: "Welcome new students or parents",
			icon: "✨",
			label: "New Student Welcome",
		},
		follow_up: {
			description: "Check in with students or parents",
			icon: "🔄",
			label: "Follow-Up",
		},
		general: {
			description: "Send an announcement to students and parents",
			icon: "📢",
			label: "School Announcement",
		},
		request: {
			description: "Reach out to support a student or family",
			icon: "🙏",
			label: "Pastoral Check-In",
		},
	},
};

export function getScenarioMeta(
	scenarioId: ScenarioId,
	orgType?: string | null
): ScenarioMeta {
	const org = (orgType as OrgType) ?? "other";
	return (SCENARIO_META[org] ?? SCENARIO_META.other)[scenarioId];
}

export function getAllScenarioMeta(
	orgType?: string | null
): Record<ScenarioId, ScenarioMeta> {
	return SCENARIO_META[(orgType as OrgType) ?? "other"] ?? SCENARIO_META.other;
}

// ─── Org type display ─────────────────────────────────────────────────────────

export const ORG_TYPE_LABELS: Record<
	OrgType,
	{ label: string; icon: string; sub: string }
> = {
	business: { icon: "🏢", label: "Business", sub: "Company, SME, enterprise" },
	church: {
		icon: "⛪",
		label: "Church / Ministry",
		sub: "Congregation, parish, chapel",
	},
	community: {
		icon: "🌍",
		label: "Community Group",
		sub: "Association, club, network",
	},
	ngo: {
		icon: "🤝",
		label: "NGO / Charity",
		sub: "Non-profit, foundation, aid org",
	},
	other: { icon: "✦", label: "Other", sub: "Something else" },
	school: {
		icon: "🎓",
		label: "School / Academy",
		sub: "Primary, secondary, tertiary",
	},
};

// ─── Role labels by org ────────────────────────────────────────────────────────

export type UserRole =
	| "admin"
	| "leader"
	| "manager"
	| "staff"
	| "volunteer"
	| "coordinator";

interface RoleMeta {
	icon: string;
	label: string;
}

const ROLE_META: Record<OrgType, Partial<Record<UserRole, RoleMeta>>> & {
	_default: Record<UserRole, RoleMeta>;
} = {
	_default: {
		admin: { icon: "🗂️", label: "Administrator" },
		coordinator: { icon: "🔗", label: "Coordinator" },
		leader: { icon: "⭐", label: "Leader / Head" },
		manager: { icon: "📋", label: "Manager" },
		staff: { icon: "💼", label: "Staff" },
		volunteer: { icon: "🙌", label: "Volunteer" },
	},
	business: {
		admin: { icon: "🗂️", label: "Admin" },
		coordinator: { icon: "🔗", label: "Team Lead" },
		leader: { icon: "🏆", label: "CEO / Founder" },
		manager: { icon: "📋", label: "Manager" },
		staff: { icon: "💼", label: "Staff" },
		volunteer: { icon: "🙌", label: "Intern" },
	},
	church: {
		admin: { icon: "🗂️", label: "Administrator" },
		coordinator: { icon: "🔗", label: "Ministry Lead" },
		leader: { icon: "✝️", label: "Pastor / Leader" },
		manager: { icon: "📋", label: "Department Head" },
		staff: { icon: "💼", label: "Staff" },
		volunteer: { icon: "🙌", label: "Volunteer" },
	},
	community: {},
	ngo: {
		admin: { icon: "🗂️", label: "Administrator" },
		coordinator: { icon: "🔗", label: "Field Coordinator" },
		leader: { icon: "✦", label: "Director" },
		manager: { icon: "📋", label: "Programme Manager" },
		staff: { icon: "💼", label: "Staff" },
		volunteer: { icon: "🙌", label: "Volunteer" },
	},
	other: {},
	school: {
		admin: { icon: "🗂️", label: "Administrator" },
		coordinator: { icon: "🔗", label: "Class Teacher" },
		leader: { icon: "🏫", label: "Principal" },
		manager: { icon: "📋", label: "Head of Dept" },
		staff: { icon: "💼", label: "Staff" },
		volunteer: { icon: "🙌", label: "Helper" },
	},
};

export function getRoleMeta(
	orgType?: string | null
): Record<UserRole, RoleMeta> {
	const org = (orgType as OrgType) ?? "other";
	const overrides = ROLE_META[org] ?? {};
	return { ...ROLE_META._default, ...overrides } as Record<UserRole, RoleMeta>;
}

// ─── Org size labels ──────────────────────────────────────────────────────────

export function getOrgSizeLabel(orgType?: string | null) {
	const memberWord =
		orgType === "business"
			? "customers"
			: orgType === "school"
				? "students"
				: orgType === "ngo"
					? "contacts"
					: "members";

	return [
		{ icon: "🏠", label: `1–50 ${memberWord}`, value: "1-50" },
		{ icon: "🏛️", label: `51–200 ${memberWord}`, value: "51-200" },
		{ icon: "🏟️", label: `201–500 ${memberWord}`, value: "201-500" },
		{ icon: "🌍", label: `500+ ${memberWord}`, value: "500+" },
	];
}
