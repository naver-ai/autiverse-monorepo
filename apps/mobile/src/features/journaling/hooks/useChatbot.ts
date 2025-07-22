import { useState, useCallback } from 'react';
import { ChatbotResponse, ChatMessage, JournalingSessionInfo, NetworkHelper } from '@autiverse-monorepo/ts-core';
import { useAuthStore } from '../../auth/store';
import { useMutation, useQueryClient } from '@tanstack/react-query'

const createNewSessionAPI = async (jwt: string, location?: string, people?: Array<string>): Promise<ChatbotResponse> => {

  const requestBody = {
    location: location,
    people: people
  };
  
  const response = await NetworkHelper.axiosClient.post(
    NetworkHelper.ENDPOINTS.APP.CHATBOT.START,
    requestBody,
    { headers: await NetworkHelper.getHeaders(jwt) }
  )

  return response.data;
}

const createNewSessionWithSuggestionsAPI = async (jwt: string): Promise<ChatbotResponse> => {

  const response = await NetworkHelper.axiosClient.post(
    NetworkHelper.ENDPOINTS.APP.CHATBOT.START_WITH_SUGGESTION,
    null,
    { headers: await NetworkHelper.getHeaders(jwt) }
  )

  return response.data;
}

const sendMessageAPI = async (jwt: string, journalEntryId: string, message: string, audioFilename?: string): Promise<ChatbotResponse> => {
  const response = await NetworkHelper.axiosClient.post(
    NetworkHelper.ENDPOINTS.APP.CHATBOT.SEND,
    { journal_entry_id: journalEntryId, message: message, audio_filename: audioFilename },
    { headers: await NetworkHelper.getHeaders(jwt) }
  )

  return response.data;
}

const startAutoComicGenerationAPI = async (jwt: string, journalEntryId: string): Promise<ChatbotResponse> => {
  const response = await NetworkHelper.axiosClient.post(
    NetworkHelper.ENDPOINTS.APP.CHATBOT.getAutoComicGenerationEndpoint(journalEntryId),
    null,
    { headers: await NetworkHelper.getHeaders(jwt) }
  )
  return response.data;
}

export const useChatbot = (afterStart?: (data: ChatbotResponse, withSuggestion: boolean) => void) => {
  
  const queryClient = useQueryClient();

  const { jwt } = useAuthStore();

  const startChatbotMutation = useMutation({
    mutationFn: (args: {location?: string, people?: Array<string>}) => createNewSessionAPI(jwt!!, args.location, args.people),
    onSuccess: (data) => {
      console.log('Successfully created new session:', data);
      queryClient.setQueryData(['session', data.journal_entry_id], () => {
        return data;
      });

      if (afterStart) {
        afterStart(data, false);
      }
    },
    onError: (error) => {
      console.error('Failed to create new session:', error);
    }
  })

  const startChatbotWithSuggestionMutation = useMutation({
    mutationFn: () => createNewSessionWithSuggestionsAPI(jwt!!),
    onSuccess: (data) => {
      console.log('Successfully created new session with suggestion:', data);
      queryClient.setQueryData(['session', data.journal_entry_id], () => {
        return data;
      });

      if (afterStart) {
        afterStart(data, true);
      }
    },
  })

  const addMockMessages = (journalEntryId: string, messages: ChatMessage[]) => {
    queryClient.setQueryData(['session', journalEntryId], (oldData: any) => {
      if(oldData) {
        return {
          ...oldData,
          messages: [...oldData.messages, ...messages]
        };
      }
    });
  }

  const sendMessageMutation = useMutation({
    mutationFn: (args: {journalEntryId: string, message: string, audioFilename?: string}) => sendMessageAPI(jwt!!, args.journalEntryId, args.message, args.audioFilename),
    onSuccess: (data) => {
      console.log('Successfully sent message:', data);

      queryClient.setQueryData(['session', data.journal_entry_id], (oldData: JournalingSessionInfo) => {
        if(oldData) {
          return {
            ...oldData,
            stage: data.stage,
            focusedPanel: data.focusedPanel || oldData.focusedPanel
          };
        }else return oldData;
      });
    }
  })

  const startAutoComicGenerationMutation = useMutation({
    mutationFn: (journalEntryId: string) => startAutoComicGenerationAPI(jwt!!, journalEntryId),
    onSuccess: (data) => {
      console.log('Successfully started auto comic generation:', data);
    }
  })

  return {
    // Actions
    startChatbot: startChatbotMutation.mutateAsync,
    startChatbotWithSuggestion: startChatbotWithSuggestionMutation.mutateAsync,
    isStartingChatbot: startChatbotMutation.isPending || startChatbotWithSuggestionMutation.isPending,
    sendMessage: sendMessageMutation.mutateAsync,
    isSendingMessage: sendMessageMutation.isPending,
    sendMessageError: sendMessageMutation.error,
    addMockMessages,
    startAutoComicGeneration: startAutoComicGenerationMutation.mutateAsync,
    isStartingAutoComicGeneration: startAutoComicGenerationMutation.isPending,
    startAutoComicGenerationError: startAutoComicGenerationMutation.error,
  };
}; 