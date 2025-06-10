import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NetworkHelper, Dyad, DyadInfo } from '@autiverse-monorepo/ts-core';

export const getAllDyadsApi = async (): Promise<Array<Dyad>> => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.LIST,
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    
    return response.data;
};

export const createDyadApi = async (data: DyadInfo) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.CREATE,
        data,
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    
    return response.data;
}; 

export const createInterestApi = async (args: {dyadId: string, data: { name: string }}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    
    console.log(args)
    const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getAddInterestEndpoint(args.dyadId),
        args.data,
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    return response.data;
};

export const deleteInterestApi = async (args: {dyadId: string, interestId: string}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.delete(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getDeleteInterestEndpoint(args.dyadId, args.interestId),
        { headers: NetworkHelper.getHeaders(token) }
    );
    return response.data;
}

export const useCreateInterestMutation = () => {

    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: createInterestApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, interests: [...dyad.interests, data] }
                    }
                    return dyad
                })
            })
        }
    })

    return mutation
}

export const useDeleteInterestMutation = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: deleteInterestApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, interests: dyad.interests.filter(interest => interest.id !== args.interestId) }
                    }
                    return dyad
                })
            })
        }
    })

    return mutation
}