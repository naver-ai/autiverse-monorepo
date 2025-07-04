import { Dyad, NetworkHelper } from "@autiverse-monorepo/ts-core";
import { useAuthStore } from "../features/auth/store";
import { useQuery } from "@tanstack/react-query";

    
export async function getDyadAPI(jwt: string): Promise<Dyad> {
    const response = await NetworkHelper.axiosClient.get(
      NetworkHelper.ENDPOINTS.APP.PROFILE.INFO,
      {
        headers: await NetworkHelper.getHeaders(jwt),
      }
    );
    return response.data;
  }

export function useDyad() {

    const { jwt } = useAuthStore();

    const {data: dyad, isLoading: isDyadLoading, error: dyadError} = useQuery({
        queryKey: ['dyad'],
        queryFn: () => getDyadAPI(jwt!!),
        enabled: !!jwt
      });

    return {
        dyad,
        isDyadLoading,
        dyadError
    }
}