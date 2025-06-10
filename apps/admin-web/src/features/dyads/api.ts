import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NetworkHelper, Dyad, DyadInfo, Place } from '@autiverse-monorepo/ts-core';

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

export const createPersonApi = async (args: {dyadId: string, data: { name: string }}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getAddPersonEndpoint(args.dyadId),
        args.data,
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    return response.data;
};

export const deletePersonApi = async (args: {dyadId: string, personId: string}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.delete(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getDeletePersonEndpoint(args.dyadId, args.personId),
        { headers: NetworkHelper.getHeaders(token) }
    );
    return response.data;
};

export const createPlaceApi = async (args: {dyadId: string, data: { name: string }}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getAddPlaceEndpoint(args.dyadId),
        args.data,
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    return response.data;
};

export const deletePlaceApi = async (args: {dyadId: string, placeId: string}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.delete(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getDeletePlaceEndpoint(args.dyadId, args.placeId),
        { headers: NetworkHelper.getHeaders(token) }
    );
    return response.data;
};

export const useCreatePersonMutation = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: createPersonApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, people: [...dyad.people, data] }
                    }
                    return dyad
                })
            })
        }
    })

    return mutation
}

export const useDeletePersonMutation = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: deletePersonApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, people: dyad.people.filter(person => person.id !== args.personId) }
                    }
                    return dyad
                })
            })
        }
    })

    return mutation
}

export const useCreatePlaceMutation = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: createPlaceApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, places: [...dyad.places, data] }
                    }
                    return dyad
                })
            })
        }
    })

    return mutation
}

export const useDeletePlaceMutation = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: deletePlaceApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, places: dyad.places.filter(place => place.id !== args.placeId) }
                    }
                    return dyad
                })
            })
        }
    })

    return mutation
}

export const setPlaceScheduleApi = async (args: {
    dyadId: string,
    placeId: string,
    data: {day_of_week: number, has_schedule: boolean}
}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.patch(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getSetPlaceScheduleEndpoint(args.dyadId, args.placeId),
        args.data,
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    return response.data;
};

export const useSetPlaceScheduleMutation = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: setPlaceScheduleApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return {
                            ...dyad,
                            places: dyad.places.map(place => {
                                if (place.id === args.placeId) {
                                    return { ...place, ...data };
                                }
                                return place;
                            })
                        };
                    }
                    return dyad;
                });
            });
        }
    });

    return mutation;
};

export const addPersonToPlaceApi = async (args: {dyadId: string, placeId: string, personIds: string[]}): Promise<Place> => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getAddPersonToPlaceEndpoint(args.dyadId, args.placeId),
        { person_ids: args.personIds },
        { headers: NetworkHelper.getHeaders(token) }
    );
    return response.data;
};

export const useAddPersonToPlaceMutation = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: addPersonToPlaceApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, places: dyad.places.map(place => {
                            if (place.id === args.placeId) {
                                return data
                            }
                            return place;
                        }) };
                    }
                    return dyad;
                });
            });
        }
    });

    return mutation;
};

export const deletePersonFromPlaceApi = async (args: {dyadId: string, placeId: string, personId: string}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.delete(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getDeletePersonFromPlaceEndpoint(args.dyadId, args.placeId, args.personId),
        { headers: NetworkHelper.getHeaders(token) }
    );
    return response.data;
};

export const useDeletePersonFromPlaceMutation = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: deletePersonFromPlaceApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, places: dyad.places.map(place => {
                            if (place.id === args.placeId) {
                                return data
                            }
                            return place;
                        }) };
                    }
                    return dyad;
                });
            });
        }
    });

    return mutation;
};