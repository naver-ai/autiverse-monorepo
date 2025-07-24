import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  startComicGenerationAPI,
  getComicGenerationStatusAPI,
  cancelComicGenerationAPI,
  ComicGenerationRequest,
  ComicGenerationStatus,
} from '../api';
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/hooks';
import { usePrevious } from '@uidotdev/usehooks';
import { useSocket } from '../utils/socket';
import { WebsocketEvent } from '../types';
import { JournalingSessionInfo } from '@autiverse-monorepo/ts-core';

export const useComicGeneration = (
  journalEntryId: string | null,
) => {
  const { jwt } = useAuth();

  const queryClient = useQueryClient();

  // 만화 생성 시작 mutation
  const startGenerationMutation = useMutation({
    mutationFn: (request: ComicGenerationRequest) =>
      startComicGenerationAPI(jwt!!, request),
    onSuccess: () => {
      console.log('Comic generation started successfully');
      // 상태 쿼리를 무효화하여 즉시 상태를 다시 가져오도록 함
      if (journalEntryId) {
        queryClient.invalidateQueries({
          queryKey: ['comicGenerationStatus', journalEntryId],
        });
      }
    },
    onError: (error) => {
      console.error('Error starting comic generation:', error);
    },
  });

  // 만화 생성 취소 mutation
  const cancelGenerationMutation = useMutation({
    mutationFn: (journalEntryId: string) =>
      cancelComicGenerationAPI(jwt!!, journalEntryId),
    onSuccess: () => {
      console.log('Comic generation cancelled successfully');
      if (journalEntryId) {
        queryClient.invalidateQueries({
          queryKey: ['comicGenerationStatus', journalEntryId],
        });
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
  });

  // 만화 생성 시작 함수
  const startGeneration = useCallback(
    (panelContents: Record<string, string>) => {

      console.log("Start comic generation....", panelContents)
      if (!journalEntryId) {
        console.error('journalEntryId is required to start comic generation');
        return;
      }

      const request: ComicGenerationRequest = {
        journal_entry_id: journalEntryId,
        panel_contents: panelContents,
      };

      startGenerationMutation.mutate(request);
    },
    [journalEntryId, startGenerationMutation],
  );

  // 만화 생성 취소 함수
  const cancelGeneration = useCallback(() => {
    if (!journalEntryId) {
      console.error('journalEntryId is required to cancel comic generation');
      return;
    }

    cancelGenerationMutation.mutate(journalEntryId);
  }, [journalEntryId, cancelGenerationMutation]);

  const { eventSubject$ } = useSocket(jwt);
  useEffect(() => {
    const subscription = eventSubject$.subscribe((event) => {
      console.log('Websocket event: ', event);
      switch (event.event) {
        case WebsocketEvent.ComicGenerationProgress:
        case WebsocketEvent.ComicGenerationCompleted:
        case WebsocketEvent.ComicGenerationStarted:
        case WebsocketEvent.ComicGenerationError:
          if (event.data.journal_entry_id == journalEntryId) {
            const status: ComicGenerationStatus = {
              status: event.data.status.startsWith('generating-')
                ? 'generating'
                : event.data.status,
              progress: event.data.status.startsWith('generating-')
                ? parseInt(event.data.status.split('-')[1]) * 20
                : 0,
              message: '',
              comic_data: event.data.comic_data,
            };

            queryClient.setQueryData(
              ['comicGenerationStatus', journalEntryId],
              (old: ComicGenerationStatus | undefined) => {
                return status;
              },
            );
            if (event.event == WebsocketEvent.ComicGenerationCompleted) {
              queryClient.setQueryData(
                ['session', journalEntryId],
                (old: JournalingSessionInfo | undefined) => {
                  if (old != null) {
                    return {
                      ...old,
                      panels: event.data.comic_data,
                    };
                  }
                  return old;
                },
              );
              queryClient.invalidateQueries({
                queryKey: ['session', journalEntryId],
              });
            }
          }
          break;
      }
    });
    return () => subscription.unsubscribe();
  }, [eventSubject$, queryClient, journalEntryId]);

  return {
    // 상태
    status: statusQuery.data || {
      status: 'idle' as const,
      progress: 0,
      message: '',
    },

    // 로딩 상태
    isLoading:
      startGenerationMutation.isPending || cancelGenerationMutation.isPending,
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
