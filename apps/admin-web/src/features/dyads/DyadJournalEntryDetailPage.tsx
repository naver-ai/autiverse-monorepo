import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, Descriptions, Collapse, Tag, Space, Typography, Button } from 'antd'
import { getJournalEntryDetailApi } from './api'
import { format } from 'date-fns'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'
import { Comic } from '@autiverse-monorepo/ts-core'

const { Text, Title } = Typography

export const DyadJournalEntryDetailPage = () => {
    const { dyadId, journalEntryId } = useParams({ 
        strict: false
    })
    const navigate = useNavigate()

    const { data: entry, isLoading, error } = useQuery({
        queryKey: ['journal-entry-detail', dyadId, journalEntryId],
        queryFn: () => getJournalEntryDetailApi(dyadId, journalEntryId),
        enabled: !!dyadId && !!journalEntryId
    })

    if (isLoading) {
        return <div className="container mx-auto p-4">Loading...</div>
    }

    if (error) {
        return <div className="container mx-auto p-4">Error loading journal entry</div>
    }

    if (!entry) {
        return <div className="container mx-auto p-4">Journal entry not found</div>
    }

    const handleBack = () => {
        navigate({ 
            to: '/dyads/$dyadId/journal-entries', 
            params: { dyadId } 
        })
    }

    return (
        <div className="container mx-auto p-4">
            <div className="mb-4">
                <Button 
                    icon={<ArrowLeftIcon className="w-4 h-4" />}
                    onClick={handleBack}
                    className="mb-4"
                >
                    Back to List
                </Button>
            </div>

            <Title level={2}>Journal Entry Detail</Title>
            
            <Card className="mb-6">
                <Descriptions 
                    title={
                        <Space>
                            <Text strong>{entry.title || 'Untitled'}</Text>
                            <Tag color={getStageColor(entry.stage)}>{entry.stage}</Tag>
                        </Space>
                    }
                    items={[
                        {
                            key: 'created_at',
                            label: 'Created At',
                            children: format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss')
                        },
                        {
                            key: 'updated_at',
                            label: 'Updated At',
                            children: entry.updated_at ? format(new Date(entry.updated_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A'
                        },
                        {
                            key: 'duration',
                            label: 'Duration',
                            children: `${formatTime(getTotalWholeDuration(entry.messages))} (${formatTime(getTotalActualDuration(entry.messages))})`
                        },
                        {
                            key: 'people',
                            label: 'People',
                            children: entry.journal?.people ? JSON.stringify(entry.journal.people, null, 2) : 'N/A'
                        },
                        {
                            key: 'location',
                            label: 'Location',
                            children: entry.journal?.location || 'N/A'
                        }
                    ]}
                />
            </Card>
            
            {entry.messages && entry.messages.length > 0 && (
                <div className="space-y-6">
                    {getStageCards(entry.messages, entry.journal, entry.created_at)}
                </div>
            )}
            

            
            {entry.comic && (
                <Card title="Comic Data" className="mb-8 mt-8">
                    <div className="grid grid-cols-2 gap-6">
                        {renderComicGrid(entry.comic, 'first')}
                        {renderComicGrid(entry.comic, 'second')}
                        {(!entry.comic.first_panel1 && !entry.comic.second_panel1) && (
                            <div className="col-span-2 text-gray-500 text-center py-8">
                                <div>No comic panels found</div>
                                <div className="text-sm mt-2">Available comic data:</div>
                                <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-x-auto">
                                    {JSON.stringify(entry.comic, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    )
}

const getDuration = (createdAt: string, updatedAt?: string) => {
    if (!updatedAt) {
        return 'In progress'
    }
    
    const start = new Date(createdAt)
    const end = new Date(updatedAt)
    const diffMs = end.getTime() - start.getTime()
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) {
        return `${diffDays}d ${diffHours % 24}h ${diffMinutes % 60}m`
    } else if (diffHours > 0) {
        return `${diffHours}h ${diffMinutes % 60}m`
    } else {
        return `${diffMinutes}m`
    }
}

const getTotalActualDuration = (messages: any[]) => {
    if (!messages || messages.length === 0) return 0
    
    const stages = ['intro', 'revision_1', 'comic_context', 'revision_2', 'title']
    let totalActualDuration = 0
    
    stages.forEach(stage => {
        const stageMessages = messages.filter(msg => msg.stage === stage)
        if (stageMessages.length > 0) {
            const stageInfo = calculateStageInfo(stageMessages, '')
            totalActualDuration += stageInfo.actualDuration
        }
    })
    
    return totalActualDuration
}

const getTotalWholeDuration = (messages: any[]) => {
    if (!messages || messages.length === 0) return 0
    
    const stages = ['intro', 'revision_1', 'comic_context', 'revision_2', 'title']
    let totalWholeDuration = 0
    
    stages.forEach(stage => {
        const stageMessages = messages.filter(msg => msg.stage === stage)
        if (stageMessages.length > 0) {
            const stageInfo = calculateStageInfo(stageMessages, '')
            totalWholeDuration += stageInfo.wholeDuration
        }
    })
    
    return totalWholeDuration
}

const renderComicGrid = (comicData: Comic, type: 'first' | 'second') => {
    console.log(`Rendering ${type} comic grid:`, comicData)
    
    // panel 데이터 수집
    const panels = []
    for (let i = 1; i <= 4; i++) {
        const panelKey = `${type}_panel${i}` as keyof Comic
        const panelData: any = comicData?.[panelKey]
        console.log(comicData)
        console.log(`Panel ${panelKey}:`, panelData)
        if (panelData) {
            console.log(`Panel ${panelKey} grid:`, panelData.grid)
            panels.push({
                index: i,
                content: panelData.content,
                grid: panelData.grid // 각 패널의 5x5 grid 정보
            })
        }
    }
    
    console.log(`Found ${panels.length} panels for ${type}`)
    if (panels.length === 0) return null
    
    // 각 패널의 5x5 matrix 생성 함수
    const createPanelMatrix = (grid: any[]) => {
        const matrix = Array(5).fill(null).map(() => Array(5).fill(null))
        
        if (grid && Array.isArray(grid)) {
            grid.forEach((item: any) => {
                if (item && item.position && item.content) {
                    const [col, row] = item.position // column, row 순서로 변경
                    if (row >= 0 && row < 5 && col >= 0 && col < 5) {
                        matrix[row][col] = item.content
                    }
                }
            })
        }
        
        return matrix
    }
    
    return (
        <div className="space-y-4">
            <div className="text-lg font-semibold text-gray-800 capitalize">{type} Result</div>
            
            {/* 2x2 4컷만화 - 각 패널 안에 5x5 matrix 표시 */}
            <div className="mb-4">
                <div className="grid grid-cols-2 gap-4">
                    {panels.map(panel => (
                        <div key={panel.index} className="space-y-2">
                            <div className="text-sm font-medium text-gray-600">
                                Panel {panel.index}: {panel.content || 'No content'}
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                {/* 각 패널의 5x5 grid - position 정보를 사용해서 배치 */}
                                <div className="grid grid-cols-5 gap-1">
                                    {(() => {
                                        const matrix = createPanelMatrix(panel.grid)
                                        return matrix.map((row, rowIndex) => 
                                            row.map((cell, colIndex) => (
                                                <div key={`${rowIndex}-${colIndex}`} className="aspect-square bg-white border border-gray-200 rounded flex items-center justify-center p-1">
                                                    <Text className="text-xs text-center leading-tight">
                                                        {cell || ''}
                                                    </Text>
                                                </div>
                                            ))
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const getStageCards = (messages: any[], journal: any, createdAt: string) => {
    const stages = ['intro', 'revision_1', 'comic_context', 'revision_2', 'title']
    
    return stages.map(stage => {
        const stageMessages = messages.filter(msg => msg.stage === stage)
        
        if (stageMessages.length === 0) {
            return null
        }
        
        // Stage 정보 계산
        const stageInfo = calculateStageInfo(stageMessages, createdAt)
        
        // Journal 정보 가져오기
        const journalInfo = getJournalInfoForStage(journal, stage)
        
        return (
            <Card className="mb-4">
                <Collapse 
                    defaultActiveKey={['stage']} 
                    items={[{
                        key: 'stage',
                        label: stage.toUpperCase(),
                        children: (
                            <div className="space-y-4">
                                {/* Summary */}
                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-gray-700">Summary</div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Text className="text-sm text-gray-600">Whole Duration:</Text>
                                            <Text className="text-sm">{formatTime(stageInfo.wholeDuration)}</Text>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Text className="text-sm text-gray-600">Actual Duration:</Text>
                                            <Text className="text-sm">{formatTime(stageInfo.actualDuration)}</Text>
                                        </div>
                                    </div>
                                    {stageInfo.metadataCount > 0 && (
                                        <div className="space-y-1">
                                            <Text className="text-sm text-gray-600">
                                                📊 {stageInfo.metadataCount} with metadata • Total Processing: {formatTime(stageInfo.metadataProcessingTime)}
                                            </Text>
                                            {stageInfo.metadataDetails.map((detail, idx) => (
                                                <div key={idx} className="ml-4">
                                                    <Text className="text-xs text-gray-500">
                                                        Message {detail.messageIndex + 1}: {formatTime(detail.processingTime)}
                                                    </Text>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Messages */}
                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-gray-700">Messages ({stageInfo.count})</div>
                                    <div className="space-y-2">
                                        {stageMessages.map((message: any, index: number) => {
                                            const hasMetadata = message.metadata_json && message.metadata_json.timestamp
                                            
                                            return (
                                                <div key={index} className={`p-3 rounded ${message.role === 'user' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                                    <div className="flex items-start gap-2">
                                                        <Tag color={message.role === 'user' ? 'blue' : 'green'} className="mt-1">
                                                            {message.role === 'user' ? 'User' : 'Assistant'}
                                                        </Tag>
                                                        <div className="flex-1">
                                                            <Text>{message.content}</Text>
                                                            {message.audio_filename && (
                                                                <div className="mt-1">
                                                                    <Text className="text-gray-500 text-sm">
                                                                        Audio: {message.audio_filename}
                                                                    </Text>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {hasMetadata && (
                                                            <div className="flex items-center justify-center w-6 h-6 bg-orange-100 text-orange-600 rounded-full text-xs font-medium">
                                                                M
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Journal */}
                                {journalInfo && (
                                    <div className="space-y-2">
                                        <div className="text-sm font-medium text-gray-700">Journal</div>
                                        {journalInfo}
                                    </div>
                                )}
                            </div>
                        )
                    }]} 
                />
            </Card>
        )
    }).filter(Boolean)
}

const calculateStageInfo = (messages: any[], createdAt: string) => {
    if (messages.length === 0) {
        return { count: 0, wholeDuration: 0, actualDuration: 0, metadataCount: 0, metadataProcessingTime: 0, metadataDetails: [] }
    }
    
    let firstMessage = new Date(messages[0].created_at)
    let lastMessageTime = new Date(messages[0].created_at)
    let totalProcessingTime = 0
    let metadataCount = 0
    let metadataProcessingTime = 0
    let metadataDetails: any[] = []
    let lastMetadataTimestamp = 0
    let lastMessageHasMetadata = false
    
    messages.forEach((message, index) => {
        const messageTime = new Date(message.created_at)
        
        if (messageTime < firstMessage) firstMessage = messageTime
        if (messageTime > lastMessageTime) lastMessageTime = messageTime
        
        if (message.metadata_json && message.metadata_json.timestamp) {
            const metadataTimestamp = new Date(message.metadata_json.timestamp)
            const processingTime = metadataTimestamp.getTime() - messageTime.getTime()
            totalProcessingTime += processingTime
            metadataCount += 1
            metadataProcessingTime += processingTime
            
            // 마지막 metadata timestamp 추적
            if (metadataTimestamp.getTime() > lastMetadataTimestamp) {
                lastMetadataTimestamp = metadataTimestamp.getTime()
            }
            
            metadataDetails.push({
                messageIndex: index,
                messageId: message.id,
                processingTime: processingTime,
                timestamp: message.metadata_json.timestamp
            })
        }
    })
    
    // 마지막 메시지가 metadata를 가지고 있는지 확인
    const lastMessageObj = messages[messages.length - 1]
    if (lastMessageObj && lastMessageObj.metadata_json && lastMessageObj.metadata_json.timestamp) {
        lastMessageHasMetadata = true
    }
    
    // Whole duration 계산: 마지막 메시지에 metadata가 있으면 그것을 기준으로, 없으면 마지막 메시지 시간 기준
    let wholeDuration: number
    if (lastMessageHasMetadata) {
        wholeDuration = lastMetadataTimestamp - firstMessage.getTime()
    } else {
        wholeDuration = lastMessageTime.getTime() - firstMessage.getTime()
    }
    
    const actualDuration = wholeDuration - totalProcessingTime
    
    return { count: messages.length, wholeDuration, actualDuration, metadataCount, metadataProcessingTime, metadataDetails }
}

const getJournalInfoForStage = (journal: any, stage: string) => {
    if (!journal) return null
    
    switch (stage) {
        case 'revision_1':
            return journal.revision_1 ? (
                <div className="space-y-2">
                    <div>
                        <Text strong>Revision Count: {journal.revision_1_count || 0}</Text>
                    </div>
                    <pre className="bg-gray-50 p-2 rounded text-sm overflow-x-auto">
                        {JSON.stringify(journal.revision_1, null, 2)}
                    </pre>
                </div>
            ) : null
        case 'revision_2':
            return journal.revision_2 ? (
                <div className="space-y-2">
                    <div>
                        <Text strong>Revision Count: {journal.revision_2_count || 0}</Text>
                    </div>
                    <pre className="bg-gray-50 p-2 rounded text-sm overflow-x-auto">
                        {JSON.stringify(journal.revision_2, null, 2)}
                    </pre>
                </div>
            ) : null
        case 'comic_context':
            return journal.comic_context ? (
                <pre className="bg-gray-50 p-2 rounded text-sm overflow-x-auto">
                    {JSON.stringify(journal.comic_context, null, 2)}
                </pre>
            ) : null
        case 'intro':
            return journal.comic_intro ? (
                <pre className="bg-gray-50 p-2 rounded text-sm overflow-x-auto">
                    {JSON.stringify(journal.comic_intro, null, 2)}
                </pre>
            ) : null
        default:
            return null
    }
}

const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`
    } else {
        return `${seconds}s`
    }
}

const getStageInfo = (messages: any[], createdAt: string) => {
    if (!messages || messages.length === 0) {
        return 'No messages'
    }
    
    const stageInfo: { [key: string]: { count: number, firstMessage: Date, lastMessage: Date, totalProcessingTime: number } } = {}
    
    messages.forEach(message => {
        const stage = message.stage || 'unknown'
        
        if (!stageInfo[stage]) {
            stageInfo[stage] = { 
                count: 0, 
                firstMessage: new Date(message.created_at),
                lastMessage: new Date(message.created_at),
                totalProcessingTime: 0
            }
        }
        
        stageInfo[stage].count += 1
        
        const messageTime = new Date(message.created_at)
        
        // 첫 번째 메시지 시간 업데이트
        if (messageTime < stageInfo[stage].firstMessage) {
            stageInfo[stage].firstMessage = messageTime
        }
        
        // 마지막 메시지 시간 업데이트
        if (messageTime > stageInfo[stage].lastMessage) {
            stageInfo[stage].lastMessage = messageTime
        }
        
        // metadata의 timestamp가 있으면 실제 처리 시간 계산
        if (message.metadata_json && message.metadata_json.timestamp) {
            const metadataTimestamp = new Date(message.metadata_json.timestamp)
            const processingTime = metadataTimestamp.getTime() - messageTime.getTime()
            stageInfo[stage].totalProcessingTime += processingTime
        }
    })
    
    const stageTexts = Object.entries(stageInfo).map(([stage, info]) => {
        // 전체 stage 시간 - 실제 처리 시간
        const totalStageTime = info.lastMessage.getTime() - info.firstMessage.getTime()
        const netStageTime = totalStageTime - info.totalProcessingTime
        
        const durationSeconds = Math.floor(netStageTime / 1000)
        const durationMinutes = Math.floor(durationSeconds / 60)
        const durationHours = Math.floor(durationMinutes / 60)
        
        let durationText = ''
        if (durationHours > 0) {
            durationText = `${durationHours}h ${durationMinutes % 60}m ${durationSeconds % 60}s`
        } else if (durationMinutes > 0) {
            durationText = `${durationMinutes}m ${durationSeconds % 60}s`
        } else {
            durationText = `${durationSeconds}s`
        }
        
        return `${stage}: ${info.count}msgs (${durationText})`
    })
    
    return stageTexts.join(', ')
}

const getStageColor = (stage: string) => {
    switch (stage) {
        case 'complete': return 'blue'
        default: return 'green'
    }
} 