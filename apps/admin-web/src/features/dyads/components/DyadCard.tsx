import { Dyad } from "@autiverse-monorepo/ts-core"
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button, Card, Descriptions } from "antd"
import { deleteInterestApi } from "../api"
import { useInterestModalStore } from "../store"

export const DyadCard = (props: {
    dyad: Dyad
}) => {
    const { openInterestModal } = useInterestModalStore();
    const queryClient = useQueryClient();

    const deleteInterestMutation = useMutation({
        mutationFn: deleteInterestApi,
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
            key: 'interests',
            label: 'Interests',
            children: <div className="flex gap-2 flex-wrap">
            {
                props.dyad.interests?.map(interest => <Button key={interest.id} type="text" size="small" onClick={() => {
                    if(window.confirm('Are you sure you want to delete this interest?')) {
                    deleteInterestMutation.mutate({
                            dyadId: props.dyad.id,
                            interestId: interest.id
                        })
                    }
                }} loading={deleteInterestMutation.isPending}><span className="text-sm">
                    {`${interest.name}`}</span>
                    <XMarkIcon className="w-4 h-4" />
                    </Button>) || 'No interests'
            }
            <Button type="link" size="small" onClick={() => openInterestModal(props.dyad.id)}>
                Add Interest
            </Button>
        </div> 
        }
    ]

    return (
        <Card size="small">
            <Descriptions title={`${props.dyad.alias} (${props.dyad.child_name})`}
                items={items}
            />
        </Card>
    )
}


/*

(interests: Interest[], record: Dyad) => {
                return 
            }
*/