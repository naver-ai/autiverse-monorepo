import { useState, useCallback } from 'react';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';
import { useDyad } from '../../../api/dyad';
import { useAuthStore } from '../../../features/auth/store';
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface Place {
  id: string;
  name: string;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
}

interface Person {
  id: string;
  name: string;
  avatar_config?: any;
}

interface AgentInfo {
  name: string;
  config: any;
}

interface SessionInfo {
  journal_entry_id: string;
  stage: string;
  status: string;
  location?: string;
  people?: string[];
  events?: string[];
  summary?: string;
  panels: any;
  message_count: number;
}

interface Preset {
  location: string;
  people: string[];
  label: string;
  dayInfo?: string[];
}

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
  const [people, setPeople] = useState<Person[]>([]);
  const [useApiData, setUseApiData] = useState(true);

  const queryClient = useQueryClient();

  const { jwt } = useAuthStore();

  const { dyad } = useDyad();

  const loadPeople = useCallback(async (placeId: string) => {
    try {
      const response = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.APP.CHATBOT.getPlacePeopleEndpoint(placeId)
      );
      if (response.status === 200) {
        const data = response.data;
        setPeople(data.people);
        console.log('Loaded people:', data.people);
      } else {
        console.log('Failed to load people');
      }
    } catch (error) {
      console.error('Error loading people:', error);
    }
  }, []);

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
    // State
    places: dyad?.places,
    people,
    agentName: dyad?.agents[0].agent_name,
    agentConfig: dyad?.agents[0].agent_config,
    childName: dyad?.child_name,
    useApiData,
    
    // Actions
    loadPeople,
    loadSessionInfo,
    startChatbot: startChatbotMutation.mutateAsync,
    startChatbotWithSuggestion: startChatbotWithSuggestionMutation.mutateAsync,
    sendMessage,
    startAutoComicGeneration,
  };
}; 