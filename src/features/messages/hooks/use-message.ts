import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "#/orpc/client";

export const useMessageConversations = ({
	filter,
	channelFilter,
}: {
	filter: "all" | "unread" | "keyword";
	channelFilter: "whatsapp" | "sms" | undefined;
}) =>
	useQuery(
		orpc.inbox.list.queryOptions({
			input: { channel: channelFilter, filter },
			queryKey: ["inbox.list", filter, channelFilter],
			refetchInterval: 30_000,
		})
	);

export const useGetInboxThread = ({
	phone,
	channel,
}: {
	phone: string;
	channel: "whatsapp" | "sms";
}) =>
	useQuery(
		orpc.inbox.get.queryOptions({
			input: { channel, phone },
			queryKey: ["inbox.thread", phone, channel],
			refetchInterval: 15_000,
		})
	);

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
			onError: (e) => {
				toast.error("Reply failed", {
					description: e instanceof Error ? e.message : "Something went wrong",
				});
			},
			onSuccess: () => {
				qc.invalidateQueries({ queryKey: ["inbox.list"] });
				qc.invalidateQueries({
					queryKey: ["inbox.thread", phone, channel],
				});
			},
		})
	);
};
