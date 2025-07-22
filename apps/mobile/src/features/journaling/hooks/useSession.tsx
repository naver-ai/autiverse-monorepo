import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSessionInfoAPI } from "../api";
import { useAuth } from "../../auth/hooks";
import { useCallback } from "react";

export function useSession({sessionId}: {sessionId?: string | null}) {
    const {jwt} = useAuth()
    const {data, isLoading, error, refetch} = useQuery({
        queryKey: ['session', sessionId],
        queryFn: () => getSessionInfoAPI({token: jwt!, sessionId: sessionId!}),
        enabled: !!sessionId && !!jwt
    })

    const queryClient = useQueryClient()

    return {
        sessionInfo: data,
        isSessionInfoLoading: isLoading,
        sessionInfoLoadError: error,
        refetchSessionInfo: refetch,
        invalidateSessionInfo: useCallback(() => queryClient.invalidateQueries({queryKey: ['session', sessionId]}), [sessionId])
    }
}