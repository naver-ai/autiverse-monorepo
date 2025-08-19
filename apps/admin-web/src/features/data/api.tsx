import { NetworkHelper } from "@autiverse-monorepo/ts-core";

export async function exportJsonAPI(): Promise<Record<string, any>> {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.ADMIN.DATA.EXPORT_JSON,
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    return response.data;
}

export async function exportDbAPI(): Promise<any> {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.ADMIN.DATA.EXPORT_DB,
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    return response.data;
}