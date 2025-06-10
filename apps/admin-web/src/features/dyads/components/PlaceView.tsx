import { Place } from "@autiverse-monorepo/ts-core"
import { XMarkIcon } from "@heroicons/react/20/solid"
import { Button, Card, Space, Typography } from "antd"
import { useDeletePlaceMutation, useSetPlaceScheduleMutation } from "../api"

const DAYS_OF_WEEK = [
    { label: 'Sun', value: 0, key: 'sunday' },  // Sunday
    { label: 'Mon', value: 1, key: 'monday' },  // Monday
    { label: 'Tue', value: 2, key: 'tuesday' },  // Tuesday
    { label: 'Wed', value: 3, key: 'wednesday' },  // Wednesday
    { label: 'Thu', value: 4, key: 'thursday' },  // Thursday
    { label: 'Fri', value: 5, key: 'friday' },  // Friday
    { label: 'Sat', value: 6, key: 'saturday' },  // Saturday
] as const;

export const PlaceView = ({place, dyadId}: {place: Place, dyadId: string}) => {
    const deletePlaceMutation = useDeletePlaceMutation();
    const setPlaceScheduleMutation = useSetPlaceScheduleMutation();

    const handleDayToggle = (dayIndex: number) => {
        setPlaceScheduleMutation.mutate({
            dyadId,
            placeId: place.id,
            data: {
                day_of_week: dayIndex,
                has_schedule: !place[DAYS_OF_WEEK[dayIndex].key]
            }
        });
    };

    return <Card size="small" className="min-w-[250px]" title={place.name} extra={<Button type="text" 
        onClick={() => {
        if(window.confirm('Are you sure you want to delete this person?')) {
            deletePlaceMutation.mutate({
                dyadId: dyadId,
                placeId: place.id
            })
        }
    }} loading={deletePlaceMutation.isPending}>
        <XMarkIcon className="w-4 h-4" />
        </Button>} styles={{header: {paddingRight: 0}}}>

        <div>
            <Space direction="horizontal" size="small">
                {DAYS_OF_WEEK.map(day => (
                    <Button
                        key={day.value}
                        type={place[day.key] ? "primary" : "text"}
                        size="small"
                        className="w-8 h-8 p-0 flex items-center justify-center text-[0.7rem]"
                        onClick={() => handleDayToggle(day.value)}
                        loading={setPlaceScheduleMutation.isPending}
                    >
                        {day.label}
                    </Button>
                ))}
            </Space>
        </div>
        {
            !place.monday && !place.tuesday && !place.wednesday && !place.thursday && !place.friday && !place.saturday && !place.sunday && (<Typography.Text type="danger" className="text-xs">No days are scheduled.</Typography.Text>)
        }
        
    </Card>
}