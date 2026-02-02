import {
	canInvite,
	ORGANIZATION_ROLES,
	type OrganizationRole,
} from "shared/auth";
import { Button } from "ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "ui/components/ui/dialog";
import { Input } from "ui/components/ui/input";
import { Label } from "ui/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "ui/components/ui/select";
import { toast } from "ui/components/ui/sonner";
import { useState } from "react";
import { authClient } from "renderer/lib/auth-client";

interface InviteMemberDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	organizationId: string;
	organizationName: string;
	invitableRoles: OrganizationRole[];
	currentUserRole: OrganizationRole;
}

export function InviteMemberDialog({
	open,
	onOpenChange,
	organizationId,
	organizationName,
	invitableRoles,
	currentUserRole,
}: InviteMemberDialogProps) {
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<OrganizationRole>("member");
	const [isInviting, setIsInviting] = useState(false);

	const handleInvite = async () => {
		if (!canInvite(currentUserRole, role)) {
			toast.error(`Cannot invite users as ${ORGANIZATION_ROLES[role].name}`);
			return;
		}

		setIsInviting(true);
		try {
			await authClient.organization.inviteMember({
				organizationId,
				email,
				role,
			});

			toast.success(`Invitation sent to ${email}`);
			setEmail("");
			setRole("member");
			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to send invitation",
			);
		} finally {
			setIsInviting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Invite Member</DialogTitle>
					<DialogDescription>
						Send an invitation to join {organizationName}. Expires in 48 hours.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							placeholder="user@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && email && !isInviting) {
									handleInvite();
								}
							}}
							disabled={isInviting}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="role">Role</Label>
						<Select
							value={role}
							onValueChange={(val) => setRole(val as OrganizationRole)}
						>
							<SelectTrigger id="role" disabled={isInviting}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{invitableRoles.map((r) => (
									<SelectItem key={r} value={r}>
										{ORGANIZATION_ROLES[r].name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isInviting}
					>
						Cancel
					</Button>
					<Button onClick={handleInvite} disabled={isInviting || !email}>
						{isInviting ? "Sending..." : "Send Invitation"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
