import { JournalingSessionInfo, NetworkHelper } from '@autiverse-monorepo/ts-core';

export interface ComicGenerationStatus {
  status: 'idle' | 'generating' | 'completed' | 'error' | 'cancelled';
  progress: number;
  message: string;
  comic_data?: any;
}

export const getSessionInfoAPI = async ({token, sessionId}: {token: string, sessionId: string}): Promise<JournalingSessionInfo> => {
  const response = await NetworkHelper.axiosClient.get(
    NetworkHelper.ENDPOINTS.APP.CHATBOT.getSessionEndpoint(sessionId),
    {
      headers: await NetworkHelper.getHeaders(token)
    }
  );

  return response.data;
};

export const startComicGenerationAPI = async (token: string, journalEntryId: string): Promise<void> => {
  const response = await NetworkHelper.axiosClient.post(
    NetworkHelper.ENDPOINTS.APP.COMIC_GENERATION.getStartEndpoint(journalEntryId),
    null,
    {
      headers: await NetworkHelper.getHeaders(token),
    }
  );
  return response.data;
};

export const getComicGenerationStatusAPI = async (token: string, journalEntryId: string): Promise<ComicGenerationStatus> => {
  const response = await NetworkHelper.axiosClient.get(
    NetworkHelper.ENDPOINTS.APP.COMIC_GENERATION.getStatusEndpoint(journalEntryId),
    {
      headers: await NetworkHelper.getHeaders(token)
    }
  );
  return response.data;
};

export const cancelComicGenerationAPI = async (token: string, journalEntryId: string): Promise<void> => {
  const response = await NetworkHelper.axiosClient.delete(
    NetworkHelper.ENDPOINTS.APP.COMIC_GENERATION.getCancelEndpoint(journalEntryId),
    {
      headers: await NetworkHelper.getHeaders(token)
    }
  );
  return response.data;
};

export const uploadAudioFile = async (token: string, audioUri: string, journalEntryId: string, stage?: string, interactionTurnId?: string): Promise<{ filename: string }> => {
  try {
    const formData = new FormData();
    
    // 파일 정보 추가
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
    
    // 추가 정보 추가
    formData.append('journal_entry_id', journalEntryId);
    // stage가 undefined이거나 빈 문자열이어도 항상 전송 (백엔드에서 처리)
    formData.append('stage', stage || '');
    if (interactionTurnId) {
      formData.append('interaction_turn_id', interactionTurnId);
    }
    
    const response = await NetworkHelper.axiosClient.post(
      NetworkHelper.ENDPOINTS.APP.CHATBOT.UPLOAD_AUDIO,
      formData,
      {
        headers: {
          ...await NetworkHelper.getHeaders(token),
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Audio upload failed:', error);
    throw error;
  }
}; 

export const updateComicTitleAPI = async (token: string, journalEntryId: string, title: string): Promise<any> => {
  try {
    const response = await NetworkHelper.axiosClient.post(
      NetworkHelper.ENDPOINTS.APP.CHATBOT.UPDATE_TITLE,
      {
        journal_entry_id: journalEntryId,
        title: title
      },
      {
        headers: await NetworkHelper.getHeaders(token),
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating comic title:', error);
    throw error;
  }
};

export const continueSessionAPI = async (token: string, journalEntryId: string, stage: string): Promise<any> => {
  try {
    const response = await NetworkHelper.axiosClient.post(
      NetworkHelper.ENDPOINTS.APP.CHATBOT.CONTINUE_SESSION,
      {
        journal_entry_id: journalEntryId,
        stage: stage
      },
      {
        headers: await NetworkHelper.getHeaders(token),
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error continuing session:', error);
    throw error;
  }
};

export interface PlacePerson {
  id: string;
  name: string;
  avatar_config?: any;
}

export const getPlacePeopleAPI = async ({placeId, token}: {placeId: string, token: string}): Promise<{ place_id: string; people: PlacePerson[] }> => {
  try {
    const response = await NetworkHelper.axiosClient.get(
      NetworkHelper.ENDPOINTS.APP.CHATBOT.getPlacePeopleEndpoint(placeId),
      {
        headers: await NetworkHelper.getHeaders(token),
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching place people:', error);
    throw error;
  }
}; 