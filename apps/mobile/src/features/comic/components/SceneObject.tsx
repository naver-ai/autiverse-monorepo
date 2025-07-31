import { useMemo, useState } from "react"
import { LayoutChangeEvent, View } from "react-native"
import { getTileColor } from "../utils"
import { ComicGridItem } from "@autiverse-monorepo/ts-core"
import Color from "color"

export const SceneObject = ({children, item, gridSize, tolerableLeft=0, tolerableRight=0, pivotPosition}: {children?: React.ReactNode, item: ComicGridItem, gridSize: number, tolerableLeft?: number, tolerableRight?: number, pivotPosition?: {x: number, y: number}}) => {
    
    

    // Calculate adjusted position based on tolerable values
    const calculateAdjustedPosition = () => {
        const baseLeft = (pivotPosition?.x || 0) - gridSize / 2
        
        // Calculate how much the object can extend beyond the grid boundaries
        const maxLeftExtension = tolerableLeft * gridSize
        const maxRightExtension = tolerableRight * gridSize
        
        // Adjust left position to respect tolerable boundaries
        let adjustedLeft = baseLeft
        
        // If object extends too far to the left, adjust it
        if (baseLeft < -maxLeftExtension) {
            adjustedLeft = -maxLeftExtension
        }
        
        // If object extends too far to the right, adjust it
        const rightBoundary = gridSize - maxRightExtension
        if (baseLeft + gridSize > rightBoundary) {
            adjustedLeft = rightBoundary - gridSize
        }
        
        // Calculate right position based on tolerableRight
        const baseRight = gridSize - (pivotPosition?.x || 0) - gridSize / 2
        let adjustedRight = baseRight
        
        // If object extends too far to the right, adjust it
        if (baseRight < -maxRightExtension) {
            adjustedRight = -maxRightExtension
        }
        
        // If object extends too far to the left, adjust it
        const leftBoundary = gridSize - maxLeftExtension
        if (baseRight + gridSize > leftBoundary) {
            adjustedRight = leftBoundary - gridSize
        }
        
        return { left: adjustedLeft, right: adjustedRight }
    }

    const position = calculateAdjustedPosition()

    const backgroundColor = useMemo(() => {
        return Color(getTileColor(item)).alpha(0.8).rgb().string()
    }, [item])

    return (
        <View style={{
            position: 'absolute',
            left: position.left,
            right: position.right,
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
            {children}
        </View>
    )
}