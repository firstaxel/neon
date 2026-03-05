import { useRouter } from "@tanstack/react-router";
import { OnboardingWizard } from "../components/onboarding-wizard";

const OnboardingView = () => {
	const router = useRouter();
	return (
		<div className="mx-auto w-full max-w-6xl space-y-3 py-4">
			<OnboardingWizard
				onComplete={() =>
					router.navigate({
						to: "/dashboard",
					})
				}
			/>
		</div>
	);
};

export default OnboardingView;
