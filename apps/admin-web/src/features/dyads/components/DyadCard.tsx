import { Dyad } from "@autiverse-monorepo/ts-core"
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button, Card, Collapse, Descriptions } from "antd"
import { deleteAgentApi } from "../api"
import { useAgentModalStore, usePersonModalStore, usePlaceModalStore } from "../store"
import { PersonView } from "./PersonView"
import { PlaceView } from "./PlaceView"

export const DyadCard = (props: {
    dyad: Dyad
}) => {
    const { openAgentModal } = useAgentModalStore();
    const { openPersonModal } = usePersonModalStore();
    const { openPlaceModal } = usePlaceModalStore();
    const queryClient = useQueryClient();

    const deleteAgentMutation = useMutation({
        mutationFn: deleteAgentApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dyads'] });
        }
    });

    const items = [
        {
            key: 'id',
            label: 'ID',
            children: props.dyad.id
        },
        {
            key: 'locale',
            label: 'Locale',
            children: props.dyad.locale
        },
        {
            key: 'caregiver_type',
            label: 'Caregiver Type',
            children: props.dyad.caregiver_type
        },
        {
            key: 'child_gender',
            label: 'Child Gender',
            children: props.dyad.child_gender
        },
        {
            key: 'child_age',
            label: 'Child Age',
            children: props.dyad.child_age
        },
        {
            key: 'passcode',
            label: 'Passcode',
            children: props.dyad.passcode
        },
        {
            key: 'agents',
            label: 'Agents',
            children: <div className="flex gap-2 flex-wrap">
            {
                props.dyad.agents?.map(agent => <Button className="group" key={agent.id} type="text" size="small" onClick={() => {
                    if(window.confirm('Are you sure you want to delete this agent?')) {
                    deleteAgentMutation.mutate({
                            dyadId: props.dyad.id,
                            agentId: agent.id
                        })
                    }
                }} loading={deleteAgentMutation.isPending}><span className="text-sm">
                    {`${agent.interest} (${agent.agent_name})`}</span>
                    <XMarkIcon className="w-4 h-4 group-hover:opacity-100 opacity-0 transition-opacity" />
                    </Button>) || 'No agents'
            }
            <Button type="link" size="small" onClick={() => openAgentModal(props.dyad.id)}>
                Add Agent
            </Button>
        </div> 
        }
    ]

    return (
        <Card size="small">
            <Descriptions title={`${props.dyad.alias} (${props.dyad.child_name})`}
                items={items}
            />
            <Collapse className="mt-4" items={[
                {
                    key: 'people',
                    label: <div className="">
                        <span className="font-semibold">People: </span> {
                            props.dyad.people?.map(person => person.name)?.join(", ") || 'No people'
                        }
                    </div>,
                    children:  <div className="flex gap-2 flex-wrap">
                    {
                        props.dyad.people?.map(person => <PersonView person={person} dyadId={props.dyad.id}/>) || 'No people'
                    }
                    <Button type="link" size="small" onClick={() => openPersonModal(props.dyad.id)}>
                        Add Person
                    </Button>
                </div>
                }
            ]}/>

            <Collapse className="mt-4" items={[
                {
                    key: 'place',
                    label: <div className="">
                        <span className="font-semibold">Places: </span> {
                            props.dyad.places?.map(place => place.name)?.join(", ") || 'No places'
                        }
                    </div>,
                    children: <div className="flex gap-2 flex-wrap">
                    {
                        props.dyad.places?.map(place => <PlaceView key={place.id} place={place} dyadId={props.dyad.id}/>) || 'No places'
                    }
                    <Button type="link" 
                    onClick={() => openPlaceModal(props.dyad.id)}>
                        Add Place
                    </Button>
                </div>
                }
            ]}/>
        </Card>
    )
}


/*

(interests: Interest[], record: Dyad) => {
                return 
            }
*/