import axios, { AxiosInstance } from 'axios';

/**
 * NetworkHelper class provides static methods and constants for network-related operations
 */
export class NetworkHelper {
  private static baseUrl = '';
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
        getGetEndpoint: (dyadId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}`,
        getSetScheduleEndpoint: (dyadId: string, placeId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/schedule`,
        getAddPeopleEndpoint: (dyadId: string, placeId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/people/add`,
        getDeletePeopleEndpoint: (dyadId: string, placeId: string, personId: string) => `${this.ENDPOINT_PREFIX}/dyads/${dyadId}/places/${placeId}/people/${personId}`,
      },
    },

    APP: {
      AUTH: {
        LOGIN: '/api/v1/app/auth/login',
        VERIFY: '/api/v1/app/auth/verify',
      }
    }
  };

  /**
   * Initialize NetworkHelper with base URL
   * @param baseUrl - The base URL for API requests
   */
  public static init(baseUrl: string): void {
    this.baseUrl = baseUrl;
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
