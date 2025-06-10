import { Person } from "@autiverse-monorepo/ts-core"
import { XMarkIcon } from "@heroicons/react/20/solid"
import { Button } from "antd"
import { useDeletePersonMutation } from "../api"

export const PersonView = ({ person, dyadId }: {
    person: Person,
    dyadId: string
}) => {
    const deletePersonMutation = useDeletePersonMutation()

    return <Button className="group" key={person.id} type="text" size="small" onClick={() => {
        if(window.confirm('Are you sure you want to delete this person?')) {
        deletePersonMutation.mutate({
                dyadId: dyadId,
                personId: person.id
            })
        }
    }} loading={deletePersonMutation.isPending}><span className="text-sm">
        {`${person.name}`}</span>
        <XMarkIcon className="w-4 h-4 group-hover:opacity-100 opacity-0 transition-opacity" />
        </Button>
}