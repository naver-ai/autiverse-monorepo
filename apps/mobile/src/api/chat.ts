import { NetworkHelper } from "@autiverse-monorepo/ts-core";
import { useAuthStore } from "../features/auth/store";
import { useQuery } from "@tanstack/react-query";

export const getChatSessionAPI = async (journalEntryId: string, jwt: string) => {
    const response = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.APP.CHATBOT.getSessionEndpoint(journalEntryId),
        {
            headers: await NetworkHelper.getHeaders(jwt)
        }
    )
    return response.data;
}

export const useChatSession = (journalEntryId: string) => {
    const { jwt } = useAuthStore();
    const { data, isLoading, error } = useQuery({
        queryKey: ['session', journalEntryId],
        queryFn: () => getChatSessionAPI(journalEntryId, jwt!!),
    });

    return {
        chatSession: data,
        isLoading: isLoading,
        error: error
    }
}