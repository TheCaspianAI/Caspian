import type {
	SelectInvitation,
	SelectMember,
	SelectUser,
} from "lib/db/schema/auth";
import type { OrganizationRole } from "shared/auth";

export type TeamMember = SelectUser &
	SelectMember & {
		memberId: string;
		role: OrganizationRole;
	};

export type InvitationRow = SelectInvitation & {
	inviterName: string;
};
