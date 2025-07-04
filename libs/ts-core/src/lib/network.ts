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
        getAddAgentEndpoint: (dyadId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/agents/add`,
        getDeleteAgentEndpoint: (dyadId: string, agentId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/agents/${agentId}`,
        getSetScheduleEndpoint: (dyadId: string, placeId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/schedule`,
        getAddPersonEndpoint: (dyadId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/people/add`,
        getDeletePersonEndpoint: (dyadId: string, personId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/people/${personId}`,
        getAddPlaceEndpoint: (dyadId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/add`,
        getDeletePlaceEndpoint: (dyadId: string, placeId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}`,
        getSetPlaceScheduleEndpoint: (dyadId: string, placeId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/schedule`,
        getAddPersonToPlaceEndpoint: (dyadId: string, placeId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/people/add`,
        getDeletePersonFromPlaceEndpoint: (dyadId: string, placeId: string, personId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/people/${personId}`,
      },
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
        getAutoComicGenerationEndpoint: (sessionId: string) => `/api/v1/app/chatbot/auto-comic-generation/${sessionId}`,
      },
      COMIC_GENERATION: {
        START: '/api/v1/app/comic-generation/start',
        getStatusEndpoint: (journalEntryId: string) => `/api/v1/app/comic-generation/status/${journalEntryId}`,
        getCancelEndpoint: (journalEntryId: string) => `/api/v1/app/comic-generation/cancel/${journalEntryId}`,
      }
    },

    // Backend internal communication endpoints
    INTERNAL: {
      COMIC_GENERATION: {
        START: '/api/v1/app/comic-generation/start',
        getStatusEndpoint: (journalEntryId: string) => `/api/v1/app/comic-generation/status/${journalEntryId}`,
        getCancelEndpoint: (journalEntryId: string) => `/api/v1/app/comic-generation/cancel/${journalEntryId}`,
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

  /**
   * Get internal axios client for backend-to-backend communication
   * @param baseUrl - The base URL for internal communication
   * @returns AxiosInstance
   */
  public static getInternalClient(baseUrl: string): AxiosInstance {
    return axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
