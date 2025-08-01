import { useMemo } from "react"
import { View, Text } from "react-native"
import { getTileColor } from "../utils"
import { ComicGridItem } from "@autiverse-monorepo/ts-core"
import Color from "color"
import { useComicStyle } from "../styles"
import { styleTemplates } from "../../../styles"

export const SceneObject = ({children, item, tolerableLeft=0, tolerableRight=0, pivotPosition}: {children?: React.ReactNode, item: ComicGridItem, tolerableLeft?: number, tolerableRight?: number, pivotPosition?: {x: number, y: number}}) => {
    
    const {comicStyle, comicGridSize: gridSize} = useComicStyle();
    
    const {left, right} = useMemo(() => {
        // Calculate how much the object can extend beyond the grid boundaries
        const maxLeftExtension = tolerableLeft * gridSize
        const maxRightExtension = tolerableRight * gridSize
        
        // Adjust left position to respect tolerable boundaries
        
        let adjustedLeft = -maxLeftExtension
        let adjustedRight = -maxRightExtension

        return { left: adjustedLeft, right: adjustedRight }
        }, [tolerableLeft, tolerableRight, gridSize])


    const backgroundColor = useMemo(() => {
        return Color(getTileColor(item)).alpha(0.8).rgb().string()
    }, [item])

    return (
        <View style={{
            position: 'absolute',
            left,
            right,
            top: (pivotPosition?.y || 0) - gridSize / 2,
            minWidth: gridSize,
            height: gridSize,
            backgroundColor,
            borderRadius: 8,
            padding: 2,
            borderWidth: 1,
            borderColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 5,
            shadowColor: 'black',
            shadowOffset: {width: 0, height: 2},
            shadowOpacity: 0.1,
            shadowRadius: 3.84,
        }}>

            <Text className="text-black text-center" style={{
                ...styleTemplates.withSemiboldFont,
                fontSize: comicStyle.objectNameFontSize
            }}>
                {item.content}
            </Text>
        </View>
    )
}