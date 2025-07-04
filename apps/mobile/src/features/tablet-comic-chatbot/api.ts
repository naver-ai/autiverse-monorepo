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