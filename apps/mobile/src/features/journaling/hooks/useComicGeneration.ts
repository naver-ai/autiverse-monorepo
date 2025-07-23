import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  startComicGenerationAPI, 
  getComicGenerationStatusAPI, 
  cancelComicGenerationAPI,
  ComicGenerationRequest,
  ComicGenerationStatus 
} from '../api';
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/hooks';
import { usePrevious } from '@uidotdev/usehooks';
import { useSocket } from '../utils/socket';

export const useComicGeneration = (journalEntryId: string | null, onGenerationComplete?: (comicData: any) => void) => {

  const {jwt} = useAuth();

  const queryClient = useQueryClient();

  // 만화 생성 시작 mutation
  const startGenerationMutation = useMutation({
    mutationFn: (request: ComicGenerationRequest) => startComicGenerationAPI(jwt!!, request),
    onSuccess: () => {
      console.log('Comic generation started successfully');
      // 상태 쿼리를 무효화하여 즉시 상태를 다시 가져오도록 함
      if (journalEntryId) {
        queryClient.invalidateQueries({ queryKey: ['comicGenerationStatus', journalEntryId] });
      }
    },
    onError: (error) => {
      console.error('Error starting comic generation:', error);
    },
  });

  // 만화 생성 취소 mutation
  const cancelGenerationMutation = useMutation({
    mutationFn: (journalEntryId: string) => cancelComicGenerationAPI(jwt!!, journalEntryId),
    onSuccess: () => {
      console.log('Comic generation cancelled successfully');
      if (journalEntryId) {
        queryClient.invalidateQueries({ queryKey: ['comicGenerationStatus', journalEntryId] });
      }
    },
    onError: (error) => {
      console.error('Error cancelling comic generation:', error);
    },
  });

  // 만화 생성 상태 쿼리
  const statusQuery = useQuery({
    queryKey: ['comicGenerationStatus', journalEntryId],
    queryFn: () => getComicGenerationStatusAPI(jwt!!, journalEntryId!),
    enabled: !!journalEntryId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // 완료되면 폴링 중단
      if (data?.status === 'completed') {
        return false;
      }
      // 에러나면 폴링 중단
      if (query.state.error || data?.status === 'error' || data?.status === 'cancelled') {
        return false;
      }
      // 데이터가 없으면 폴링 중단
      if (!data) {
        return false;
      }
      // 그 외에는 500ms마다 폴링
      return 500;
    },
    refetchIntervalInBackground: false,
    retry: false, // 404 에러 시 재시도하지 않음
  });

  // 만화 생성 시작 함수
  const startGeneration = useCallback((panelContents: Record<string, string>) => {
    if (!journalEntryId) {
      console.error('journalEntryId is required to start comic generation');
      return;
    }

    const request: ComicGenerationRequest = {
      journal_entry_id: journalEntryId,
      panel_contents: panelContents
    };

    startGenerationMutation.mutate(request);
  }, [journalEntryId, startGenerationMutation]);

  // 만화 생성 취소 함수
  const cancelGeneration = useCallback(() => {
    if (!journalEntryId) {
      console.error('journalEntryId is required to cancel comic generation');
      return;
    }

    cancelGenerationMutation.mutate(journalEntryId);
  }, [journalEntryId, cancelGenerationMutation]);


  const {eventSubject$} = useSocket(jwt);
  useEffect(() => {
    const subscription = eventSubject$.subscribe((event) => {
      console.log("Websocket event: ", event);
    });
    return () => subscription.unsubscribe();
  }, [eventSubject$]);

  return {
    // 상태
    status: statusQuery.data || {
      status: 'idle' as const,
      progress: 0,
      message: ''
    },
    
    // 로딩 상태
    isLoading: startGenerationMutation.isPending || cancelGenerationMutation.isPending,
    isStarting: startGenerationMutation.isPending,
    isCancelling: cancelGenerationMutation.isPending,
    isStatusLoading: statusQuery.isLoading,
    
    // 에러 상태
    startError: startGenerationMutation.error,
    cancelError: cancelGenerationMutation.error,
    statusError: statusQuery.error,
    
    // 액션
    startGeneration,
    cancelGeneration,
    
    // 에러 리셋
    resetStartError: startGenerationMutation.reset,
    resetCancelError: cancelGenerationMutation.reset,
  };
}; 