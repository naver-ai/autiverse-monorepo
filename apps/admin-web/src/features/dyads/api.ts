import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NetworkHelper, Dyad, DyadInfo, Place, Agent, AvatarConfig } from '@autiverse-monorepo/ts-core';

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

export const createAgentApi = async (args: {dyadId: string, data: { interest: string, agent_name: string, agent_config?: Record<string, any> }}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    
    const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getAddAgentEndpoint(args.dyadId),
        args.data,
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    return response.data;
};

export const deleteAgentApi = async (args: {dyadId: string, agentId: string}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.delete(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getDeleteAgentEndpoint(args.dyadId, args.agentId),
        { headers: NetworkHelper.getHeaders(token) }
    );
    return response.data;
}

export const useCreateAgentMutation = () => {

    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: createAgentApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, agents: [...dyad.agents, data] }
                    }
                    return dyad
                })
            })
        }
    })

    return mutation
}

export const useDeleteAgentMutation = () => {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: deleteAgentApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, agents: dyad.agents.filter(agent => agent.id !== args.agentId) }
                    }
                    return dyad
                })
            })
        }
    })

    return mutation
}

export const createPersonApi = async (args: {dyadId: string, data: { name: string, avatar_config?: AvatarConfig }}) => {
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
            queryClient.invalidateQueries({ queryKey: ['dyads'] });
            queryClient.invalidateQueries({ queryKey: ['dyad', args.dyadId] });
        }
    })

    return mutation
}

export const updatePersonColorApi = async (args: {dyadId: string, personId: string, color: string}) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.put(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getUpdatePersonColorEndpoint(args.dyadId, args.personId),
        { color: args.color },
        { headers: NetworkHelper.getHeaders(token) }
    );
    return response.data;
};

export const useUpdatePersonColorMutation = () => {     
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: updatePersonColorApi,
        onSuccess: (data, args) => {
            queryClient.setQueryData(['dyads'], (old: Dyad[]) => {
                return old.map(dyad => {
                    if (dyad.id === args.dyadId) {
                        return { ...dyad, people: dyad.people.map(person => {
                            if (person.id === args.personId) {
                                return data
                            }
                            return person;
                        }) };
                    }
                    return dyad;
                });
            });
        }
    });
    return mutation;
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

export const getDyadJournalEntriesApi = async (dyadId: string) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getJournalEntriesEndpoint(dyadId),
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    
    return response.data;
};

export const getJournalEntryDetailApi = async (dyadId: string, journalEntryId: string) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const response = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.getJournalEntryDetailEndpoint(dyadId, journalEntryId),
        {
            headers: NetworkHelper.getHeaders(token)
        }
    );
    
    return response.data;
};

export const uploadAgentImageApi = async (file: File) => {
    const token = localStorage.getItem('auth_token') || undefined;
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.ADMIN.DYADS.UPLOAD_AGENT_IMAGE,
        formData,
        {
            headers: {
                ...NetworkHelper.getHeaders(token),
                'Content-Type': 'multipart/form-data',
            }
        }
    );
    return response.data;
};

export const useUploadAgentImageMutation = () => {
    const mutation = useMutation({
        mutationFn: uploadAgentImageApi,
    });
    return mutation;
};