import { useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback } from "react";
import type { OrgType } from "#/features/miscellaneous/org";
import { OnboardingWizard } from "../components/onboarding-wizard";
import { useProfile } from "../hooks/use-profile";

const OnboardingView = () => {
	const router = useRouter();
	const { data: profile, isLoading } = useProfile();

	const handleComplete = useCallback(() => {
		router.navigate({
			to: "/dashboard",
		});
	}, [router]);

	if (isLoading) {
		return (
			<div className="flex min-h-[400px] w-full items-center justify-center">
				<Loader2 className="size-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-6xl space-y-3 py-4">
			<OnboardingWizard
				initialName={profile?.name ?? ""}
				initialStep={profile?.onboardingStep ?? 0}
				initialValues={{
					orgName: profile?.orgName ?? "",
					orgSize:
						(profile?.orgSize as
							| "1-50"
							| "51-200"
							| "201-500"
							| "500+"
							| null
							| undefined) ?? "1-50",
					orgType: (profile?.orgType as OrgType | null | undefined) ?? "church",
					phone: profile?.phone ?? "",
					role: profile?.role ?? "admin",
				}}
				onComplete={handleComplete}
			/>
		</div>
	);
};

export default OnboardingView;
