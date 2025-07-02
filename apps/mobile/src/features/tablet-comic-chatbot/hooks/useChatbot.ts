import { useState, useCallback } from 'react';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';

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
  stage: string;
  panels: any;
  focusedPanel?: string;
}

interface Preset {
  location: string;
  people: string[];
  label: string;
  dayInfo?: string[];
}

export const useChatbot = (dyadId: string, passcode: string) => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [agentName, setAgentName] = useState<string>('');
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [childName, setChildName] = useState<string>('');
  const [useApiData, setUseApiData] = useState(true);

  const loadAgentInfo = useCallback(async () => {
    if (!dyadId || !passcode) return;
    
    try {
      // 먼저 dyad 정보를 가져와서 agent_id를 얻습니다
      const dyadResponse = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.APP.DYADS.getDyadEndpoint(dyadId),
        {
          headers: await NetworkHelper.getHeaders(passcode),
        }
      );
      
      if (dyadResponse.status === 200) {
        const dyadData = dyadResponse.data;
        setChildName(dyadData.child_name || '사용자');
        if (dyadData.agent_id) {
          // agent 정보를 가져옵니다
          const agentResponse = await NetworkHelper.axiosClient.get(
            NetworkHelper.ENDPOINTS.APP.AGENTS.getAgentEndpoint(dyadData.agent_id),
            {
              headers: await NetworkHelper.getHeaders(passcode),
            }
          );
          
          if (agentResponse.status === 200) {
            const agentData = agentResponse.data;
            setAgentConfig(agentData.agent_config);
            setAgentName(agentData.name || '도도');
            console.log('Loaded agent config:', agentData.agent_config);
            console.log('Loaded agent name:', agentData.name);
          }
        }
      }
    } catch (error) {
      console.error('Error loading agent info:', error);
    }
  }, [dyadId, passcode]);

  const loadPlaces = useCallback(async () => {
    if (!dyadId) return;
    
    try {
      const response = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.APP.CHATBOT.getDyadPlacesEndpoint(dyadId)
      );
      if (response.status === 200) {
        const data = response.data;
        setPlaces(data.places);
        console.log('Loaded places:', data.places);
      } else {
        console.log('Failed to load places, using preset data');
        setUseApiData(false);
      }
    } catch (error) {
      console.error('Error loading places:', error);
      setUseApiData(false);
    }
  }, [dyadId]);

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

  const startChatbot = useCallback(async (preset?: Preset) => {
    console.log('startChatbot called with preset:', preset);
    console.log('dyadId value:', dyadId);
    
    if (!dyadId || !passcode) {
      console.error('Missing dyadId or passcode');
      return null;
    }

    try {
      console.log('Making API request to start chatbot...');
      const requestBody = {
        dyad_id: dyadId,
        location: preset?.location,
        people: preset?.people
      };
      console.log('Request body:', requestBody);
      
      const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.APP.CHATBOT.START,
        requestBody
      );

      console.log('Response status:', response.status);

      if (response.status === 200) {
        const data = response.data;
        console.log('Response data:', data);
        return data;
      } else {
        console.log('Response not ok, status:', response.status);
        console.log('Error response:', response.data);
        return null;
      }
    } catch (error) {
      console.error('Failed to start chatbot:', error);
      return null;
    }
  }, [dyadId, passcode]);

  const startChatbotWithSuggestion = useCallback(async () => {
    console.log('startChatbotWithSuggestion called');
    console.log('dyadId value:', dyadId);
    
    try {
      console.log('Making API request to start chatbot with suggestion...');
      const requestBody = {
        dyad_id: dyadId
      };
      console.log('Request body:', requestBody);
      
      const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.APP.CHATBOT.START_WITH_SUGGESTION,
        requestBody
      );

      console.log('Response status:', response.status);

      if (response.status === 200) {
        const data = response.data;
        console.log('Response data:', data);
        return data;
      } else {
        console.log('Response not ok, status:', response.status);
        console.log('Error response:', response.data);
        return null;
      }
    } catch (error) {
      console.error('Failed to start chatbot with suggestion:', error);
      return null;
    }
  }, [dyadId]);

  const sendMessage = useCallback(async (sessionId: string, messageText: string) => {
    if (!sessionId || !messageText.trim()) return null;

    try {
      const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.APP.CHATBOT.SEND,
        {
          journal_entry_id: sessionId,
          message: messageText,
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
    places,
    people,
    agentName,
    agentConfig,
    childName,
    useApiData,
    
    // Actions
    loadAgentInfo,
    loadPlaces,
    loadPeople,
    loadSessionInfo,
    startChatbot,
    startChatbotWithSuggestion,
    sendMessage,
    startAutoComicGeneration,
  };
}; 