import { DyadInfo, NetworkHelper } from '@autiverse-monorepo/ts-core'

export type AuthenticationResult = {
    jwt: string
}

export type AuthenticationResultWithDyad = AuthenticationResult & {
    dyad: DyadInfo
}

export const signInAPI = async ({passcode}: {
        passcode: string
    }): Promise<AuthenticationResultWithDyad> => {

    const headers = await NetworkHelper.getHeaders();

    const response = await NetworkHelper.axiosClient.post(NetworkHelper.ENDPOINTS.APP.AUTH.LOGIN, {
        passcode
    }, {
        headers: headers,
    });
    return response.data;
};

export const signOutAPI = async ({token}: {
    token: string
}) => {
    const response = await NetworkHelper.axiosClient.post(NetworkHelper.ENDPOINTS.APP.AUTH.LOGOUT, {
            reason: "user",
        }, {
            headers: await NetworkHelper.getHeaders(token),
        });
    return response.data;
};

export const verifyTokenAPI = async ({token}: {
    token: string
}): Promise<AuthenticationResult> => {
    const response = await NetworkHelper.axiosClient.get(NetworkHelper.ENDPOINTS.APP.AUTH.VERIFY, {
        headers: await NetworkHelper.getHeaders(token),
    });
    return response.data;
};