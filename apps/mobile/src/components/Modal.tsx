import { Pressable, StyleSheet } from "react-native";
import Reanimated, { Easing, Extrapolation, interpolate, interpolateColor, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { twMerge } from "tailwind-merge";
import { useEffect } from "react";
import { usePrevious } from "@uidotdev/usehooks";
import { Portal } from "react-native-paper";

export const Modal = (props: {
    onPop?: ()=>void,
    panelClassName?: string
    backgroundClassName?: string,
    dismissOnPressOutside?: boolean,
    children?: any,
    visible?: boolean
}) => {

    const appearAnimProgress = useSharedValue(0);

    useEffect(() => {
        if(props.visible){
                appearAnimProgress.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
            }else{
                appearAnimProgress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
            }
    }, [props.visible]);

    const backgroundStyle = useAnimatedStyle(() => {
        return {
            opacity: appearAnimProgress.value
        }
    })

    const panelStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: interpolate(appearAnimProgress.value, [0, 1], [80, 0], Extrapolation.CLAMP) }]
        }
    })

    return <Portal><Reanimated.View 
                pointerEvents={props.visible ? "auto" : "none"}
                className={twMerge("z-50 absolute inset-0 items-center justify-center bg-slate-800/30", props.backgroundClassName)}
                style={backgroundStyle}
                >
        {
            props.dismissOnPressOutside !== false ? <Pressable accessible={false} style={StyleSheet.absoluteFillObject} onPress={props.onPop}/> : null
        }
            <Reanimated.View style={panelStyle}
                id={"frame"} className={twMerge("bg-white max-w-[50vw] min-w-[30vw] px-1 pt-1 rounded-t-2xl", props.panelClassName)}>
                {
                    props.children
                }
            </Reanimated.View>
        </Reanimated.View>
    </Portal>
}