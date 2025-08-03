import { Dyad, NetworkHelper, GalleryResponse } from "@autiverse-monorepo/ts-core";
import { useAuthStore } from "../features/auth/store";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

    
export async function getDyadAPI(jwt: string): Promise<Dyad> {
    const response = await NetworkHelper.axiosClient.get(
      NetworkHelper.ENDPOINTS.APP.PROFILE.INFO,
      {
        headers: await NetworkHelper.getHeaders(jwt),
      }
    );
    return response.data;
  }

export async function getGalleryAPI(jwt: string): Promise<GalleryResponse> {
    const response = await NetworkHelper.axiosClient.get(
      NetworkHelper.ENDPOINTS.APP.CHATBOT.GALLERY,
      {
        headers: await NetworkHelper.getHeaders(jwt),
        timeout: 10000, // 10초 타임아웃
      }
    );
    return response.data;
  }

export function useDyad() {

    const { jwt } = useAuthStore();

    const {t} = useTranslation();

    const {data: dyad, isLoading: isDyadLoading, error: dyadError} = useQuery({
        queryKey: ['dyad'],
        queryFn: () => getDyadAPI(jwt!!),
        enabled: !!jwt
      });

    // console.log("Dyad: ", JSON.stringify(dyad, null, 2));

    return {
        dyad,
        locale: dyad?.locale,
        agentName: dyad?.agents?.[0]?.agent_name || t('Journaling.Common.DefaultAgentName'),
        agentConfig: dyad?.agents?.[0]?.agent_config,
        childName: dyad?.child_name,
        isDyadLoading,
        dyadError
    }
}