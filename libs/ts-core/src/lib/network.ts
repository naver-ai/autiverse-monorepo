import axios, { AxiosInstance } from 'axios';

/**
 * NetworkHelper class provides static methods and constants for network-related operations
 */
export class NetworkHelper {
  private static baseUrl = '';
  private static getTimezone: (() => string | undefined) | null = null;

  private static axiosInstance: AxiosInstance | null = null;

  private static readonly ENDPOINT_PREFIX = '/api/v1/admin';

  // API Endpoints
  public static readonly ENDPOINTS = {
    // Admin API endpoints
    ADMIN: {
      AUTH: {
        LOGIN: `${this.ENDPOINT_PREFIX}/auth/login`,
        VERIFY: `${this.ENDPOINT_PREFIX}/auth/verify`,
      },
      DYADS: {
        LIST: `${this.ENDPOINT_PREFIX}/dyads/all`,
        CREATE: `${this.ENDPOINT_PREFIX}/dyads/new`,
        UPLOAD_AGENT_IMAGE: `${this.ENDPOINT_PREFIX}/dyads/upload-agent-image`,
        getAddAgentEndpoint: (dyadId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/agents/add`,
        getDeleteAgentEndpoint: (dyadId: string, agentId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/agents/${agentId}`,
        getSetScheduleEndpoint: (dyadId: string, placeId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/schedule`,
        getAddPersonEndpoint: (dyadId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/people/add`,
        getDeletePersonEndpoint: (dyadId: string, personId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/people/${personId}`,
        getUpdatePersonColorEndpoint: (dyadId: string, personId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/people/${personId}/color`,
        getUpdateDyadColorEndpoint: (dyadId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/color`,

        getAddPlaceEndpoint: (dyadId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/add`,
        getDeletePlaceEndpoint: (dyadId: string, placeId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}`,
        getSetPlaceScheduleEndpoint: (dyadId: string, placeId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/schedule`,
        getAddPersonToPlaceEndpoint: (dyadId: string, placeId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/people/add`,
        getDeletePersonFromPlaceEndpoint: (dyadId: string, placeId: string, personId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/people/${personId}`,
        getJournalEntriesEndpoint: (dyadId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/journal-entries`,
        getJournalEntryDetailEndpoint: (dyadId: string, journalEntryId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/journal-entries/${journalEntryId}`,
      },

      DATA: {
        EXPORT_DB: `${this.ENDPOINT_PREFIX}/data/export/db`,
        EXPORT_JSON: `${this.ENDPOINT_PREFIX}/data/export/json`
      }
    },

    APP: {
      AUTH: {
        LOGIN: '/api/v1/app/auth/login',
        LOGOUT: '/api/v1/app/auth/logout',
        VERIFY: '/api/v1/app/auth/verify',
      },
      PROFILE: {
        INFO: '/api/v1/app/profile/info',
      },
      AGENTS: {
        getAgentEndpoint: (agentId: string) => `/api/v1/app/agents/${agentId}`,
      },
      CHATBOT: {
        START: '/api/v1/app/chatbot/start',
        START_WITH_SUGGESTION: '/api/v1/app/chatbot/start-with-suggestion',
        SEND: '/api/v1/app/chatbot/send',
        UPLOAD_AUDIO: '/api/v1/app/chatbot/upload-audio',
        UPDATE_TITLE: '/api/v1/app/chatbot/update-title',
        CONTINUE_SESSION: '/api/v1/app/chatbot/continue-session',
        getDyadPlacesEndpoint: (dyadId: string) => {
          const url = `/api/v1/app/chatbot/dyad/${dyadId}/places`;
          console.log('NetworkHelper: getDyadPlacesEndpoint called with dyadId:', dyadId, 'returning URL:', url);
          return url;
        },
        getPlacePeopleEndpoint: (placeId: string) => {
          const url = `/api/v1/app/chatbot/place/${placeId}/people`;
          console.log('NetworkHelper: getPlacePeopleEndpoint called with placeId:', placeId, 'returning URL:', url);
          return url;
        },
        getSessionEndpoint: (sessionId: string) => `/api/v1/app/chatbot/session/${sessionId}`,
        GALLERY: '/api/v1/app/chatbot/gallery',
      },
      COMIC_GENERATION: {
        getStartEndpoint: (journalEntryId: string) => `/api/v1/app/comic-generation/${journalEntryId}/start`,
        getStatusEndpoint: (journalEntryId: string) => `/api/v1/app/comic-generation/${journalEntryId}/status`,
        getCancelEndpoint: (journalEntryId: string) => `/api/v1/app/comic-generation/${journalEntryId}/cancel`,
      },
      SPEECH: { 
        CLOVA: '/api/v1/app/speech/clova',
        RECOGNIZE: '/api/v1/app/speech/recognize',
      }
    }
  };

  /**
   * Initialize NetworkHelper with base URL
   * @param baseUrl - The base URL for API requests
   */
  public static init(baseUrl: string, getTimezone: () => string | undefined): void {
    this.baseUrl = baseUrl;
    this.getTimezone = getTimezone;

    console.log("NetworkHelper initialized with baseUrl:", baseUrl);
  }

  /**
   * Get headers for API requests
   * @param token - Optional authentication token
   * @returns Headers object
   */
  public static getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (this.getTimezone) {
      const timezone = this.getTimezone();
      if (timezone) {
        headers['X-timezone'] = timezone;
      }
    }

    return headers;
  }

  /**
   * Get a memoized axios instance with the configured base URL
   * @returns AxiosInstance
   */
  public static get axiosClient(): AxiosInstance {
    if (!this.baseUrl) {
      throw new Error('NetworkHelper not initialized. Call init() first.');
    }

    if (!this.axiosInstance) {
      this.axiosInstance = axios.create({
        baseURL: this.baseUrl,
        headers: this.getHeaders(),
      });
    }

    return this.axiosInstance;
  }
}
