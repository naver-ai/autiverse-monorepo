import { NetworkHelper } from '@autiverse-monorepo/ts-core';

export interface ComicGenerationRequest {
  journal_entry_id: string;
  panel_contents: Record<string, string>;
  is_first_generation?: boolean;
}

export interface ComicGenerationStatus {
  status: 'idle' | 'generating' | 'completed' | 'error' | 'cancelled';
  progress: number;
  message: string;
  comic_data?: any;
}

export const startComicGenerationAPI = async (request: ComicGenerationRequest): Promise<void> => {
  const response = await NetworkHelper.axiosClient.post(
    NetworkHelper.ENDPOINTS.APP.COMIC_GENERATION.START,
    request,
    {
      headers: await NetworkHelper.getHeaders(),
    }
  );
  return response.data;
};

export const getComicGenerationStatusAPI = async (journalEntryId: string): Promise<ComicGenerationStatus> => {
  const response = await NetworkHelper.axiosClient.get(
    NetworkHelper.ENDPOINTS.APP.COMIC_GENERATION.getStatusEndpoint(journalEntryId),
    {
      headers: await NetworkHelper.getHeaders(),
    }
  );
  return response.data;
};

export const cancelComicGenerationAPI = async (journalEntryId: string): Promise<void> => {
  const response = await NetworkHelper.axiosClient.delete(
    NetworkHelper.ENDPOINTS.APP.COMIC_GENERATION.getCancelEndpoint(journalEntryId),
    {
      headers: await NetworkHelper.getHeaders(),
    }
  );
  return response.data;
};

export const uploadAudioFile = async (audioUri: string, journalEntryId: string, stage?: string, interactionTurnId?: string): Promise<{ filename: string }> => {
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

export const updateComicTitleAPI = async (journalEntryId: string, title: string): Promise<any> => {
  try {
    const response = await NetworkHelper.axiosClient.post(
      NetworkHelper.ENDPOINTS.APP.CHATBOT.UPDATE_TITLE,
      {
        journal_entry_id: journalEntryId,
        title: title
      },
      {
        headers: await NetworkHelper.getHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating comic title:', error);
    throw error;
  }
};

export const continueSessionAPI = async (journalEntryId: string, stage: string): Promise<any> => {
  try {
    const response = await NetworkHelper.axiosClient.post(
      NetworkHelper.ENDPOINTS.APP.CHATBOT.CONTINUE_SESSION,
      {
        journal_entry_id: journalEntryId,
        stage: stage
      },
      {
        headers: await NetworkHelper.getHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error continuing session:', error);
    throw error;
  }
}; 