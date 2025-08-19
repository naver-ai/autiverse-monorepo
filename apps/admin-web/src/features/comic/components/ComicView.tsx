import { Comic, ComicPanelInfo } from "@autiverse-monorepo/ts-core"

export const ComicView = ({comicData, type}: {comicData: Comic, type: 'first' | 'second'}) => {
    
    // panel 데이터 수집
    const panels: ComicPanelInfo[] = []
    for (let i = 1; i <= 4; i++) {
        const panelKey = `${type}_panel${i}` as keyof Comic
        const panelData: ComicPanelInfo = comicData?.[panelKey] as any
        if (panelData) {
            panels.push(panelData)
        }
    }
    
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
                    {panels.map((panel, panelIndex) => (
                        <div key={panelIndex} className="space-y-2">
                            <div className="text-sm font-medium text-gray-600">
                                Panel {panelIndex + 1}: {panel.content || 'No content'}
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                {/* 각 패널의 5x5 grid - position 정보를 사용해서 배치 */}
                                <div className="grid grid-cols-5 gap-1">
                                    {(() => {
                                        const matrix = createPanelMatrix(panel.grid)
                                        return matrix.map((row, rowIndex) => 
                                            row.map((cell, colIndex) => (
                                                <div key={`${rowIndex}-${colIndex}`} className="aspect-square bg-white border border-gray-200 rounded flex items-center justify-center p-1">
                                                    <span className="text-xs text-center leading-tight">
                                                        {cell || ''}
                                                    </span>
                                                </div>
                                            ))
                                        )
                                    })()}
                                </div>
                            {
                                panel.place && <div className='font-bold mt-3'>📍 {panel.place}</div>
                            }
                            {
                                panel.grid?.map((item, index) => {
                                    if(item.action && item.action.length > 0) {
                                        return (
                                            <div key={index} className="text-sm p-2 bg-zinc-400/30 shadow-md rounded-lg mt-2">
                                                <div className='font-bold border-b border-black/20 pb-1 mb-1'>'{item.content}'</div>
                                                {item.action.map((action, index) => (
                                                    <div key={index}>
                                                        ({action.type}) {action.content}
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    }
                                })
                            }
                            </div>
                            
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}