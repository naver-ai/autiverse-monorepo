import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSessionInfoAPI } from "../api";
import { useAuth } from "../../auth/hooks";
import { useCallback } from "react";

export function useSession({sessionId}: {sessionId: string}) {
    const {jwt} = useAuth()

    const {data, isLoading, error, refetch} = useQuery({
        queryKey: ['session', sessionId],
        queryFn: () => getSessionInfoAPI({token: jwt!, sessionId: sessionId}),
        enabled: !!jwt,
        staleTime: 0, // 항상 최신 데이터를 가져오도록 설정
        refetchOnMount: true,
        refetchOnWindowFocus: true
    })

    const queryClient = useQueryClient()

    return {
        sessionInfo: data,
        isSessionInfoLoading: isLoading,
        sessionInfoLoadError: error,
        invalidateSessionInfo: useCallback(() => queryClient.invalidateQueries({queryKey: ['session', sessionId]}), [sessionId])
    }
}