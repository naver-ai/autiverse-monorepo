import { useState, useCallback } from 'react';
import { ChatMessage, NetworkHelper } from '@autiverse-monorepo/ts-core';
import { useAuthStore } from '../../auth/store';
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ChatbotStartResponse } from '@autiverse-monorepo/ts-core';

const createNewSessionAPI = async (jwt: string, location?: string, people?: Array<string>): Promise<ChatbotStartResponse> => {

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

const createNewSessionWithSuggestionsAPI = async (jwt: string): Promise<ChatbotStartResponse> => {

  const response = await NetworkHelper.axiosClient.post(
    NetworkHelper.ENDPOINTS.APP.CHATBOT.START_WITH_SUGGESTION,
    null,
    { headers: await NetworkHelper.getHeaders(jwt) }
  )

  return response.data;
}



export const useChatbot = (afterStart?: (data: ChatbotStartResponse, withSuggestion: boolean) => void) => {
  
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

  const sendMessage = useCallback(async (sessionId: string, messageText: string, audioFilename?: string) => {
    if (!sessionId || !messageText.trim() || !jwt) return null;

    try {
      const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.APP.CHATBOT.SEND,
        {
          journal_entry_id: sessionId,
          message: messageText,
          audio_filename: audioFilename,
        },
        { headers: await NetworkHelper.getHeaders(jwt) }
      );

      if (response.status === 200) {
        const data = response.data;
        return data;
      } else {
        console.error('Failed to send message, status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      return null;
    }
  }, [jwt]);

  const startAutoComicGeneration = useCallback(async (sessionId: string) => {
    try {
      const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.APP.CHATBOT.getAutoComicGenerationEndpoint(sessionId)
      );

      if (response.status === 200) {
        const data = response.data;
        return data;
      } else {
        console.error('Failed to start auto comic generation, status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Failed to start auto comic generation:', error);
      return null;
    }
  }, []);

  return {
    // Actions
    startChatbot: startChatbotMutation.mutateAsync,
    startChatbotWithSuggestion: startChatbotWithSuggestionMutation.mutateAsync,
    isStartingChatbot: startChatbotMutation.isPending || startChatbotWithSuggestionMutation.isPending,
    sendMessage,
    addMockMessages,
    startAutoComicGeneration,
  };
}; 