import { useState, useCallback } from 'react';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';
import { useAuthStore } from '../../auth/store';
import { useMutation, useQueryClient } from '@tanstack/react-query'

const createNewSessionAPI = async (jwt: string, location?: string, people?: Array<string>) => {

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

const createNewSessionWithSuggestionsAPI = async (jwt: string) => {

  const response = await NetworkHelper.axiosClient.post(
    NetworkHelper.ENDPOINTS.APP.CHATBOT.START_WITH_SUGGESTION,
    null,
    { headers: await NetworkHelper.getHeaders(jwt) }
  )

  return response.data;
}



export const useChatbot = () => {
  
  const queryClient = useQueryClient();

  const { jwt } = useAuthStore();

  const loadSessionInfo = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      console.log('No sessionId available for loadSessionInfo');
      return null;
    }
    
    try {
      console.log('Loading session info for sessionId:', sessionId);
      const response = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.APP.CHATBOT.getSessionEndpoint(sessionId)
      );
      if (response.status === 200) {
        const data = response.data;
        console.log('Session info received:', data);
        return data;
      } else {
        console.error('Failed to load session info, status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error loading session info:', error);
      return null;
    }
  }, []);

  const startChatbotMutation = useMutation({
    mutationFn: (args: {location?: string, people?: Array<string>}) => createNewSessionAPI(jwt!!, args.location, args.people),
    onSuccess: (data) => {
      console.log('Successfully created new session:', data);
      queryClient.setQueryData(['chatSession'], () => {
        return data;
      });
    },
    onError: (error) => {
      console.error('Failed to create new session:', error);
    }
  })

  const startChatbotWithSuggestionMutation = useMutation({
    mutationFn: () => createNewSessionWithSuggestionsAPI(jwt!!),
    onSuccess: (data) => {
      console.log('Successfully created new session with suggestion:', data);
      queryClient.setQueryData(['chatSession'], () => {
        return data;
      });
    },
  })

  const sendMessage = useCallback(async (sessionId: string, messageText: string, audioFilename?: string) => {
    if (!sessionId || !messageText.trim()) return null;

    try {
      const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.APP.CHATBOT.SEND,
        {
          journal_entry_id: sessionId,
          message: messageText,
          audio_filename: audioFilename,
        }
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
  }, []);

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
    loadSessionInfo,
    startChatbot: startChatbotMutation.mutateAsync,
    startChatbotWithSuggestion: startChatbotWithSuggestionMutation.mutateAsync,
    sendMessage,
    startAutoComicGeneration,
  };
}; 