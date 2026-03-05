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
 *   labels.first_timer  // → "New Beneficiary"
 */

export type OrgType =
	| "church"
	| "ngo"
	| "school"
	| "business"
	| "community"
	| "other";

// ─── Contact type labels ───────────────────────────────────────────────────────
//
// The underlying ContactType values ("first_timer", "member", etc.) never
// change — they're stored in the DB. Only the display labels flex.

export interface ContactTypeLabels {
	first_timer: string;
	member: string;
	returning: string;
	visitor: string;
}

const CONTACT_TYPE_LABELS: Record<OrgType, ContactTypeLabels> = {
	church: {
		first_timer: "First Timer",
		returning: "Returning",
		member: "Member",
		visitor: "Visitor",
	},
	ngo: {
		first_timer: "New Beneficiary",
		returning: "Returning",
		member: "Partner",
		visitor: "Guest",
	},
	school: {
		first_timer: "New Student",
		returning: "Returning",
		member: "Student",
		visitor: "Visitor",
	},
	business: {
		first_timer: "New Customer",
		returning: "Returning",
		member: "Client",
		visitor: "Lead",
	},
	community: {
		first_timer: "New Member",
		returning: "Returning",
		member: "Member",
		visitor: "Guest",
	},
	other: {
		first_timer: "First Time",
		returning: "Returning",
		member: "Member",
		visitor: "Guest",
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
	church: {
		first_timer: {
			label: "First Timer Welcome",
			description: "Warm welcome for first-time visitors",
			icon: "✨",
		},
		follow_up: {
			label: "Follow-Up",
			description: "Check in with existing members",
			icon: "🔄",
		},
		event_invite: {
			label: "Event Invitation",
			description: "Invite people to an upcoming service or event",
			icon: "🎉",
		},
		request: {
			label: "Prayer & Support",
			description: "Offer prayer and spiritual support",
			icon: "🙏",
		},
		general: {
			label: "General Announcement",
			description: "Broadcast a message to your congregation",
			icon: "📢",
		},
	},
	ngo: {
		first_timer: {
			label: "New Beneficiary",
			description: "Welcome new beneficiaries or volunteers",
			icon: "✨",
		},
		follow_up: {
			label: "Follow-Up",
			description: "Check in with existing contacts",
			icon: "🔄",
		},
		event_invite: {
			label: "Event / Workshop",
			description: "Invite contacts to a programme or workshop",
			icon: "🎉",
		},
		request: {
			label: "Welfare Check",
			description: "Reach out to offer care or support",
			icon: "🤝",
		},
		general: {
			label: "General Announcement",
			description: "Broadcast an update to your network",
			icon: "📢",
		},
	},
	school: {
		first_timer: {
			label: "New Student Welcome",
			description: "Welcome new students or parents",
			icon: "✨",
		},
		follow_up: {
			label: "Follow-Up",
			description: "Check in with students or parents",
			icon: "🔄",
		},
		event_invite: {
			label: "Event Invitation",
			description: "Invite to a school event or open day",
			icon: "🎉",
		},
		request: {
			label: "Pastoral Check-In",
			description: "Reach out to support a student or family",
			icon: "🙏",
		},
		general: {
			label: "School Announcement",
			description: "Send an announcement to students and parents",
			icon: "📢",
		},
	},
	business: {
		first_timer: {
			label: "New Customer Welcome",
			description: "Welcome a new customer or client",
			icon: "✨",
		},
		follow_up: {
			label: "Follow-Up",
			description: "Check in with existing customers",
			icon: "🔄",
		},
		event_invite: {
			label: "Event / Promotion",
			description: "Invite customers to an event or promotion",
			icon: "🎉",
		},
		request: {
			label: "Customer Care",
			description: "Reach out to check on satisfaction or offer help",
			icon: "💬",
		},
		general: {
			label: "General Update",
			description: "Send a broadcast to your customer base",
			icon: "📢",
		},
	},
	community: {
		first_timer: {
			label: "New Member Welcome",
			description: "Welcome someone joining for the first time",
			icon: "✨",
		},
		follow_up: {
			label: "Follow-Up",
			description: "Check in with community members",
			icon: "🔄",
		},
		event_invite: {
			label: "Event Invitation",
			description: "Invite members to a community event",
			icon: "🎉",
		},
		request: {
			label: "Member Support",
			description: "Reach out to offer support to a member",
			icon: "🤝",
		},
		general: {
			label: "Community Update",
			description: "Send a broadcast to your community",
			icon: "📢",
		},
	},
	other: {
		first_timer: {
			label: "First-Time Welcome",
			description: "Welcome someone for the first time",
			icon: "✨",
		},
		follow_up: {
			label: "Follow-Up",
			description: "Check in with existing contacts",
			icon: "🔄",
		},
		event_invite: {
			label: "Event Invitation",
			description: "Invite contacts to an upcoming event",
			icon: "🎉",
		},
		request: {
			label: "Care & Support",
			description: "Reach out to offer support",
			icon: "🙏",
		},
		general: {
			label: "General Announcement",
			description: "Send a broadcast to your contacts",
			icon: "📢",
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
	church: {
		label: "Church / Ministry",
		icon: "⛪",
		sub: "Congregation, parish, chapel",
	},
	ngo: {
		label: "NGO / Charity",
		icon: "🤝",
		sub: "Non-profit, foundation, aid org",
	},
	school: {
		label: "School / Academy",
		icon: "🎓",
		sub: "Primary, secondary, tertiary",
	},
	business: { label: "Business", icon: "🏢", sub: "Company, SME, enterprise" },
	community: {
		label: "Community Group",
		icon: "🌍",
		sub: "Association, club, network",
	},
	other: { label: "Other", icon: "✦", sub: "Something else" },
};

// ─── Role labels by org ────────────────────────────────────────────────────────

export type UserRole =
	| "admin"
	| "pastor"
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
		admin: { label: "Administrator", icon: "🗂️" },
		pastor: { label: "Pastor / Lead", icon: "✝️" },
		manager: { label: "Manager", icon: "📋" },
		coordinator: { label: "Coordinator", icon: "🔗" },
		staff: { label: "Staff", icon: "💼" },
		volunteer: { label: "Volunteer", icon: "🙌" },
	},
	church: {
		pastor: { label: "Pastor / Leader", icon: "✝️" },
		admin: { label: "Administrator", icon: "🗂️" },
		coordinator: { label: "Ministry Lead", icon: "🔗" },
		staff: { label: "Staff", icon: "💼" },
		volunteer: { label: "Volunteer", icon: "🙌" },
		manager: { label: "Department Head", icon: "📋" },
	},
	ngo: {
		admin: { label: "Administrator", icon: "🗂️" },
		manager: { label: "Programme Manager", icon: "📋" },
		coordinator: { label: "Field Coordinator", icon: "🔗" },
		staff: { label: "Staff", icon: "💼" },
		volunteer: { label: "Volunteer", icon: "🙌" },
		pastor: { label: "Director", icon: "✦" },
	},
	school: {
		pastor: { label: "Principal", icon: "🏫" },
		admin: { label: "Administrator", icon: "🗂️" },
		manager: { label: "Head of Dept", icon: "📋" },
		coordinator: { label: "Class Teacher", icon: "🔗" },
		staff: { label: "Staff", icon: "💼" },
		volunteer: { label: "Helper", icon: "🙌" },
	},
	business: {
		pastor: { label: "CEO / Founder", icon: "🏆" },
		admin: { label: "Admin", icon: "🗂️" },
		manager: { label: "Manager", icon: "📋" },
		coordinator: { label: "Team Lead", icon: "🔗" },
		staff: { label: "Staff", icon: "💼" },
		volunteer: { label: "Intern", icon: "🙌" },
	},
	community: {},
	other: {},
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
		{ value: "1-50", label: `1–50 ${memberWord}`, icon: "🏠" },
		{ value: "51-200", label: `51–200 ${memberWord}`, icon: "🏛️" },
		{ value: "201-500", label: `201–500 ${memberWord}`, icon: "🏟️" },
		{ value: "500+", label: `500+ ${memberWord}`, icon: "🌍" },
	];
}
