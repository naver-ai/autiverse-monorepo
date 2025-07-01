import { Person } from "@autiverse-monorepo/ts-core"
import { XMarkIcon } from "@heroicons/react/20/solid"
import { Button, Tooltip } from "antd"
import { useDeletePersonMutation } from "../api"

export const PersonView = ({ person, dyadId }: {
    person: Person,
    dyadId: string
}) => {
    const deletePersonMutation = useDeletePersonMutation()

    const displayName = person.avatar_config 
        ? `${person.name} (${JSON.stringify(person.avatar_config).substring(0, 20)}...)`
        : person.name;

    return <Tooltip 
        title={person.avatar_config ? `Avatar Config: ${JSON.stringify(person.avatar_config)}` : undefined}
        placement="top"
    >
        <Button className="group" key={person.id} type="text" size="small" onClick={() => {
            if(window.confirm('Are you sure you want to delete this person?')) {
            deletePersonMutation.mutate({
                    dyadId: dyadId,
                    personId: person.id
                })
            }
        }} loading={deletePersonMutation.isPending}><span className="text-sm">
            {displayName}</span>
            <XMarkIcon className="w-4 h-4 group-hover:opacity-100 opacity-0 transition-opacity" />
            </Button>
    </Tooltip>
}