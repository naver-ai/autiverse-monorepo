import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, Descriptions, Collapse, Tag, Space, Typography } from 'antd'
import { getDyadJournalEntriesApi } from './api'
import { format } from 'date-fns'

const { Text, Title } = Typography

export const DyadJournalEntriesPage = () => {
    const { dyadId } = useParams({ from: '/_protected/_layout/dyads/$dyadId/journal-entries' })

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

    return (
        <div className="container mx-auto p-4">
            <Title level={2}>Journal Entries</Title>
            
            {journalEntries?.length === 0 ? (
                <Card>
                    <Text>No journal entries found for this dyad.</Text>
                </Card>
            ) : (
                <div className="flex flex-col gap-4">
                    {journalEntries?.map((entry: any) => (
                        <Card key={entry.id} size="small">
                            <Descriptions 
                                title={
                                    <Space>
                                        <Text strong>{entry.title || 'Untitled'}</Text>
                                        <Tag color={getStageColor(entry.stage)}>{entry.stage}</Tag>
                                        <Tag color={getStatusColor(entry.status)}>{entry.status}</Tag>
                                    </Space>
                                }
                                items={[
                                    {
                                        key: 'id',
                                        label: 'ID',
                                        children: entry.id
                                    },
                                    {
                                        key: 'created_at',
                                        label: 'Created At',
                                        children: format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss')
                                    },
                                    {
                                        key: 'messages',
                                        label: 'Messages',
                                        children: `${entry.messages?.length || 0} messages`
                                    }
                                ]}
                            />
                            
                            {entry.messages && entry.messages.length > 0 && (
                                <Collapse className="mt-4" items={[
                                    {
                                        key: 'messages',
                                        label: 'Messages',
                                        children: (
                                            <div className="space-y-2">
                                                {entry.messages.map((message: any, index: number) => (
                                                    <div key={index} className={`p-2 rounded ${message.role === 'user' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                                        <Text strong>{message.role === 'user' ? 'User' : 'Assistant'}:</Text>
                                                        <Text className="ml-2">{message.content}</Text>
                                                        {message.audio_filename && (
                                                            <Text className="ml-2 text-gray-500">(Audio: {message.audio_filename})</Text>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    }
                                ]} />
                            )}
                            
                            {entry.journal && (
                                <Collapse className="mt-4" items={[
                                    {
                                        key: 'journal',
                                        label: 'Journal Data',
                                        children: (
                                            <div className="space-y-2">
                                                {Object.entries(entry.journal).map(([key, value]) => (
                                                    <div key={key}>
                                                        <Text strong>{key}:</Text>
                                                        <Text className="ml-2">{JSON.stringify(value)}</Text>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    }
                                ]} />
                            )}
                            
                            {entry.comic && (
                                <Collapse className="mt-4" items={[
                                    {
                                        key: 'comic',
                                        label: 'Comic Data',
                                        children: (
                                            <div className="space-y-2">
                                                {Object.entries(entry.comic).map(([key, value]) => (
                                                    <div key={key}>
                                                        <Text strong>{key}:</Text>
                                                        <Text className="ml-2">{JSON.stringify(value)}</Text>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    }
                                ]} />
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}

const getStageColor = (stage: string) => {
    switch (stage) {
        case 'intro': return 'blue'
        case 'comic_context': return 'green'
        case 'revision_1': return 'orange'
        case 'revision_2': return 'purple'
        case 'title': return 'cyan'
        case 'complete': return 'success'
        default: return 'default'
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