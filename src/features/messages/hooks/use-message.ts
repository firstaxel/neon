import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "#/orpc/client";

export const useMessageConversations = ({
	filter,
	channelFilter,
}: {
	filter: "all" | "unread" | "keyword";
	channelFilter: "whatsapp" | "sms" | undefined;
}) => {
	return useQuery(
		orpc.inbox.list.queryOptions({
			queryKey: ["inbox.list", filter, channelFilter],
			input: { filter, channel: channelFilter },
			refetchInterval: 30_000,
		})
	);
};

export const useGetInboxThread = ({
	phone,
	channel,
}: {
	phone: string;
	channel: "whatsapp" | "sms";
}) => {
	return useQuery(
		orpc.inbox.get.queryOptions({
			queryKey: ["inbox.thread", phone, channel],
			input: { phone, channel },
			refetchInterval: 15_000,
		})
	);
};

export const useMessageThread = ({
	phone,
	channel,
}: {
	phone: string;
	channel: "whatsapp" | "sms";
}) => {
	const qc = useQueryClient();
	return useMutation(
		orpc.inbox.markThread.mutationOptions({
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: ["inbox.list"] });
				qc.invalidateQueries({
					queryKey: ["inbox.thread", phone, channel],
				});
			},
			onError: (e) => {
				toast.error("Reply failed", {
					description: e instanceof Error ? e.message : "Something went wrong",
				});
			},
		})
	);
};
