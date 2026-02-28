import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";

const PARSING_QUERY_KEY = ["parsingByUserId"];

export const useGetParsing = () => {
	return useQuery(
		orpc.parse.all.queryOptions({
			queryKey: PARSING_QUERY_KEY,
			refetchInterval: ({ state }) => {
				const jobs = state.data?.data ?? [];
				const hasActiveJob = jobs.some(
					(j) => j.status === "pending" || j.status === "parsing"
				);
				return hasActiveJob ? 2000 : false;
			},
		})
	);
};

export function useInvalidateParsing() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: PARSING_QUERY_KEY });
}
