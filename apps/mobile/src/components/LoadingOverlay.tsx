import { View, Text, Platform } from "react-native"
import { RewardStarImage } from "./svg-images"
import { styleTemplates } from "../styles"
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing } from "react-native-reanimated"
import { useEffect } from "react"

export const LoadingOverlay = ({message, isLoading}: {message?: string, isLoading: boolean}) => {
    const progress = useSharedValue(0)
    const rotation = useSharedValue(0)

    useEffect(() => {
        if (isLoading) {
            progress.value = withTiming(1, { duration: 300 })
            rotation.value = withRepeat(
                withSequence(
                    withTiming(360, { duration: 1000 }),
                    withTiming(0, { duration: 0 })
                ),
                -1,
                false
            )
        } else {
            progress.value = withTiming(0, { duration: 300 })
            rotation.value = withTiming(0, { duration: 300 })
        }
    }, [isLoading])

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: progress.value,
        }
    })

    const starAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation.value}deg` }]
        }
    })

    return (
        <Animated.View 
            style={animatedStyle} 
            className="absolute inset-0 top-0 left-0 right-0 bottom-0 bg-white/50 flex items-center justify-center z-10"
            pointerEvents={isLoading ? "auto" : "none"}
        >
            <View className="flex flex-row items-center gap-2 bg-white px-5 py-3 rounded-xl border-2 border-slate-300">
                <Animated.View style={starAnimatedStyle}>
                    <RewardStarImage width={24} height={24} fill="#757575"/>
                </Animated.View>
                {
                    message ? (
                        <Text className="text-2xl" style={styleTemplates.withSemiboldFont}>{message}</Text>
                    ) : null
                }
            </View>
        </Animated.View>
    )
}