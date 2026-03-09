/**
 * src/features/dashboard/components/user-menu.tsx
 *
 * Avatar + dropdown in the top-right of the header.
 * Shows: user name/email, Settings link, Sign out.
 */

import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { UserAvatar } from "#/features/auth/components/user-avatar";
import { useProfile } from "#/features/profile/hooks/use-profile";
import { authClient } from "#/lib/auth-client";

export function UserMenu() {
	const { data: profile } = useProfile();
	const navigate = useNavigate();
	const [signingOut, setSigningOut] = useState(false);

	async function handleSignOut() {
		setSigningOut(true);
		try {
			await authClient.signOut();
			navigate({ to: "/login" });
		} catch {
			toast.error("Sign out failed — try again");
			setSigningOut(false);
		}
	}

	const displayName = profile?.name ?? profile?.email ?? "Account";
	const email = profile?.email ?? "";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						aria-label="Open account menu"
						className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
						type="button"
					>
						<UserAvatar image={profile?.image} name={displayName} size={30} />
					</button>
				}
			/>

			<DropdownMenuContent
				align="end"
				className="w-52 rounded-2xl"
				sideOffset={8}
			>
				<DropdownMenuGroup>
					{/* User info */}
					<DropdownMenuLabel className="py-2.5">
						<div className="flex items-center gap-2.5">
							<UserAvatar image={profile?.image} name={displayName} size={32} />
							<div className="min-w-0">
								<p className="truncate font-medium text-sm leading-tight">
									{displayName}
								</p>
								{email && (
									<p className="truncate text-[11px] text-muted-foreground leading-tight">
										{email}
									</p>
								)}
							</div>
						</div>
					</DropdownMenuLabel>

					<DropdownMenuSeparator />

					<DropdownMenuItem
						className="gap-2 rounded-xl text-sm"
						render={
							<Link to="/settings">
								<Settings className="h-4 w-4 text-muted-foreground" />
								Settings
							</Link>
						}
					/>

					<DropdownMenuSeparator />

					<DropdownMenuItem
						className="gap-2 rounded-xl text-destructive text-sm focus:text-destructive"
						disabled={signingOut}
						onClick={handleSignOut}
					>
						<LogOut className="h-4 w-4" />
						{signingOut ? "Signing out…" : "Sign out"}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
