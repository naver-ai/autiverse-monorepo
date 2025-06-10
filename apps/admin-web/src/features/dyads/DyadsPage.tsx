import { Button, Table } from "antd"
import { ColumnsType } from "antd/es/table";
import { getAllDyadsApi, useDeleteInterestMutation } from "./api";
import { useQuery } from "@tanstack/react-query";
import { Dyad, InterestORM } from "ts-core";
import { NewDyadPanel } from "./components/NewDyadPanel";
import { NewInterestModal } from "./components/NewInterestModal";
import { useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";

export const DyadsPage = () => {
    const [isInterestModalOpen, setIsInterestModalOpen] = useState(false);
    const [selectedDyadId, setSelectedDyadId] = useState<string | null>(null);

    const { data: dyads, isLoading } = useQuery({
        queryKey: ['dyads'],
        queryFn: getAllDyadsApi
    });


    const deleteInterestMutation = useDeleteInterestMutation();

    const columns: ColumnsType<Dyad> = useMemo(() => [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
        },
        {
            title: 'Alias',
            dataIndex: 'alias',
            key: 'alias',
        },
        {
            title: 'Caregiver Type',
            dataIndex: 'caregiver_type',
            key: 'caregiver_type',
        },
        {
            title: 'Child Gender',
            dataIndex: 'child_gender',
            key: 'child_gender',
        },
        {
            title: 'Passcode',
            dataIndex: 'passcode',
            key: 'passcode',
        },
        {
            title: 'Locale',
            dataIndex: 'locale',
            key: 'locale',
        },
        {
            title: 'Interests',
            dataIndex: 'interests',
            key: 'interests',
            render: (interests: InterestORM[], record: Dyad) => {
                return <div className="flex gap-2 flex-wrap">
                    {
                        interests?.map(interest => <Button key={interest.id} type="text" size="small" onClick={() => {
                            if(window.confirm('Are you sure you want to delete this interest?')) {
                            deleteInterestMutation.mutate({
                                    dyadId: record.id,
                                    interestId: interest.id
                                })
                            }
                        }} loading={deleteInterestMutation.isPending}><span className="text-sm">
                            {`${interest.name_localized} (${interest.name_english})`}</span>
                            <XMarkIcon className="w-4 h-4" />
                            </Button>) || 'No interests'
                    }
                    <Button type="link" size="small" onClick={()=> {
                        setSelectedDyadId(record.id);
                        setIsInterestModalOpen(true);
                    }}>
                        Add Interest
                    </Button>
                </div> 
            }
        }
    ], []);

    return <div className="p-4">
        <NewDyadPanel/>
        <Table 
            className="mt-10 border rounded-lg overflow-hidden shadow-md"
            columns={columns} 
            dataSource={dyads} 
            loading={isLoading}
            rowKey="id"
            pagination={false}
        />
        <NewInterestModal
            isOpen={isInterestModalOpen}
            dyadId={selectedDyadId}
            onClose={() => {
                setIsInterestModalOpen(false);
                setSelectedDyadId(null);
            }}
        />
    </div>
}