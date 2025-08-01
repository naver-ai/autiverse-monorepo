import { useMemo, useState } from "react"
import { LayoutChangeEvent, View } from "react-native"
import { getTileColor } from "../utils"
import { ComicGridItem } from "@autiverse-monorepo/ts-core"
import Color from "color"

export const SceneObject = ({children, item, gridSize, tolerableLeft=0, tolerableRight=0, pivotPosition}: {children?: React.ReactNode, item: ComicGridItem, gridSize: number, tolerableLeft?: number, tolerableRight?: number, pivotPosition?: {x: number, y: number}}) => {
    
    

    // Calculate adjusted position based on tolerable values
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
            {children}
        </View>
    )
}