import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Typography, Space } from 'antd'
import { getDyadJournalEntriesApi } from './api'
import { format } from 'date-fns'

const { Text, Title } = Typography

export const DyadJournalEntriesPage = () => {
    const { dyadId } = useParams({ from: '/_protected/_layout/dyads/$dyadId/journal-entries' })
    const navigate = useNavigate()

    const { data: journalEntries, isLoading, error } = useQuery({
        queryKey: ['dyad-journal-entries', dyadId],
        queryFn: () => getDyadJournalEntriesApi(dyadId),
        enabled: !!dyadId
    })

    if (isLoading) {
        return <div className="container mx-auto p-4">Loading...</div>
    }

    if (error) {
        return <div className="container mx-auto p-4">Error loading journal entries</div>
    }

    const columns = [
        {
            title: 'No.',
            key: 'index',
            width: 80,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Title',
            dataIndex: 'title',
            key: 'title',
            render: (title: string) => title || 'Untitled',
        },
        {
            title: 'Stage',
            dataIndex: 'stage',
            key: 'stage',
            render: (stage: string) => (
                <Tag color={getStageColor(stage)}>{stage}</Tag>
            ),
        },

        {
            title: 'Created At',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 180,
            render: (date: string) => format(new Date(date), 'yyyy-MM-dd HH:mm:ss'),
        },
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 280,
            render: (id: string) => (
                <Text code className="text-xs">{id}</Text>
            ),
        },
    ]

    const handleRowClick = (record: any) => {
        navigate({ 
            to: '/dyads/$dyadId/journal-entries/$journalEntryId', 
            params: { 
                dyadId: dyadId,
                journalEntryId: record.id 
            } 
        })
    }

    return (
        <div className="container mx-auto p-4">
            <Title level={2}>Journal Entries</Title>
            
            {journalEntries?.length === 0 ? (
                <div className="text-center py-8">
                    <Text>No journal entries found for this dyad.</Text>
                </div>
            ) : (
                <Table
                    columns={columns}
                    dataSource={journalEntries}
                    rowKey="id"
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: false,
                        showQuickJumper: false,
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                    }}
                    onRow={(record) => ({
                        onClick: () => handleRowClick(record),
                        style: { cursor: 'pointer' }
                    })}
                    className="cursor-pointer"
                />
            )}
        </div>
    )
}

const getStageColor = (stage: string) => {
    switch (stage) {
        case 'complete': return 'blue'
        default: return 'green'
    }
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'active': return 'processing'
        case 'completed': return 'success'
        case 'failed': return 'error'
        default: return 'default'
    }
} 