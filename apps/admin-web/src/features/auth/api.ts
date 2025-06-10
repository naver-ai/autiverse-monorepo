import { NetworkHelper } from "@autiverse-monorepo/ts-core";


/**
 * Login API call
 * @param password - Admin password
 * @returns JWT token
 */
export const loginApi = async (password: string) => {
    const response = await NetworkHelper.axiosClient.post(NetworkHelper.ENDPOINTS.ADMIN.AUTH.LOGIN, {
        password
    });
    
    if (response.status !== 200) {
        throw new Error('Login failed');
    }
    
    return response.data.jwt;
};

/**
 * Verify stored JWT token
 * @returns boolean indicating if token is valid
 */
export const verifyTokenApi = async () => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
        return false;
    }

    try {
        const response = await NetworkHelper.axiosClient.get(
            NetworkHelper.ENDPOINTS.ADMIN.AUTH.VERIFY,
            {
                headers: NetworkHelper.getHeaders(token)
            }
        );
        
        return response.status === 200;
    } catch (error) {
        // If verification fails, remove invalid token
        localStorage.removeItem('auth_token');
        return false;
    }
}; 