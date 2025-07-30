import { View } from "react-native";
import { useCallback, useState } from "react";

export const GridView = ({
    numColumns,
    numRows,
    gapX = 0,
    gapY = 0,
    className,
    style,
    children,
}: {
    numColumns: number;
    numRows: number;
    gapX?: number;
    gapY?: number;
    className?: string;
    style?: any;
    children: React.ReactNode;
}) => {
    const [viewSize, setViewSize] = useState({ width: 0, height: 0 });

    // Calculate cell size based on viewSize and gaps
    const cellWidth = viewSize.width > 0 ? (viewSize.width - (gapX * (numColumns - 1))) / numColumns : 0;
    const cellHeight = viewSize.height > 0 ? (viewSize.height - (gapY * (numRows - 1))) / numRows : 0;

    // Handle layout changes
    const handleLayout = useCallback((event: any) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setViewSize({ width, height });
        }
    }, []);

    // Convert children to array if it's not already
    const childrenArray = Array.isArray(children) ? children : [children];

    // Create rows for flexbox layout
    const renderRows = () => {
        const rows = [];
        
        for (let row = 0; row < numRows; row++) {
            const rowItems = [];
            
            for (let col = 0; col < numColumns; col++) {
                const index = row * numColumns + col;
                const child = childrenArray[index];
                
                if (child) {
                    rowItems.push(
                        <View
                            key={`${row}-${col}`}
                            style={{
                                width: cellWidth,
                                height: cellHeight,
                                marginRight: col < numColumns - 1 ? gapX : 0,
                            }}
                        >
                            {child}
                        </View>
                    );
                } else {
                    // Empty cell to maintain grid structure
                    rowItems.push(
                        <View
                            key={`${row}-${col}-empty`}
                            style={{
                                width: cellWidth,
                                height: cellHeight,
                                marginRight: col < numColumns - 1 ? gapX : 0,
                            }}
                        />
                    );
                }
            }
            
            rows.push(
                <View
                    key={`row-${row}`}
                    style={{
                        flexDirection: 'row',
                        marginBottom: row < numRows - 1 ? gapY : 0,
                    }}
                >
                    {rowItems}
                </View>
            );
        }
        
        return rows;
    };

    return (
        <View
            className={className}
            style={style}
            onLayout={handleLayout}
        >
            {viewSize.width > 0 && viewSize.height > 0 && renderRows()}
        </View>
    );
};