"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";

export function useProfile() {
	return useQuery(
		orpc.profile.get.queryOptions({
			queryKey: ["profile"],
			staleTime: 60_000,
		})
	);
}

export function useUpdateProfile() {
	const qc = useQueryClient();
	return useMutation(
		orpc.profile.update.mutationOptions({
			onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
		})
	);
}

export function useCompleteOnboarding() {
	const qc = useQueryClient();
	return useMutation(
		orpc.profile.completeOnboarding.mutationOptions({
			onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
		})
	);
}

export function useUpdatePassword() {
	return useMutation(orpc.profile.updatePassword.mutationOptions());
}
