import { ButtonProps, Pressable, View, Text, PressableProps, GestureResponderEvent, Platform } from "react-native";
import { styleTemplates } from "../styles";
import { useMemo, useCallback, useRef } from "react";
import { twMerge } from 'tailwind-merge'
import Animated, { useSharedValue, withTiming, withSpring, useAnimatedStyle, interpolate, Easing } from "react-native-reanimated";
import * as Haptics from 'expo-haptics';

export const TailwindButton = (props: {
    containerClassName?: string
    roundedClassName?: string
    buttonStyleClassName?: string
    disabledButtonStyleClassName?: string
    disabledTitleClassName?: string
    titleClassName?: string,
    rippleColor?: string,
    shadowClassName?: string,
    title?: string,
    children?: any,
    delayPress?: number
} & Omit<ButtonProps, "title"> & PressableProps) => {

    const pressAnimProgress = useSharedValue(0)

    const containerAnimStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {scale: interpolate(pressAnimProgress.value, [0, 1], [1, 0.95])},
                {translateY: interpolate(pressAnimProgress.value, [0, 1], [0, 2])}
            ] as any,
        }
    }, [])

    const handlePressIn = useCallback(() => {
        pressAnimProgress.value = withTiming(1, {duration: 100, easing: Easing.out(Easing.cubic)})
    }, [pressAnimProgress])

    const handlePressOut = useCallback(() => {
        pressAnimProgress.value = withSpring(0, {duration: 500})
    }, [pressAnimProgress])

    const rippleConfig = useMemo(()=>{
        return {color: props.rippleColor || "##f9aa3330"}
    }, [props.rippleColor])

    const containerClassName = useMemo(()=>{
        return twMerge('overflow-hidden', props.shadowClassName || "shadow-lg shadow-slate-500/50", props.roundedClassName, props.containerClassName)
    }, [props.shadowClassName, props.roundedClassName, props.containerClassName])

    const buttonClassName = useMemo(()=>{
        return twMerge('items-center flex-row justify-center px-8 py-3 bg-white', props.buttonStyleClassName, props.roundedClassName, props.disabled === true ? (props.disabledButtonStyleClassName || "") : "")
    }, [props.buttonStyleClassName, props.roundedClassName, props.disabled, props.disabledButtonStyleClassName])

    const titleClassName = useMemo(()=>{
        return twMerge('text-lg text-center text-slate-600', props.titleClassName, props.disabled === true ? (props.disabledTitleClassName || "") : "")
    }, [props.titleClassName, props.disabled, props.disabledTitleClassName])


    const pressTimeout = useRef<NodeJS.Timeout | null>(null)

    const handlePress = useCallback((e: GestureResponderEvent)=>{
        if(props.disabled){
            return
        }

        if(props.delayPress == null){
            props.onPress?.(e)
        }else{
            if(pressTimeout.current != null){
                clearTimeout(pressTimeout.current)
            }

            e.persist()
            pressTimeout.current = setTimeout(()=>{
                props.onPress?.(e)
            }, props.delayPress)
        }
    }, [props.disabled, props.onPress, props.delayPress])


    const handleLongPress = useCallback((e: GestureResponderEvent)=>{
        if(props.disabled){
            return
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        
        props.onLongPress?.(e)
    }, [props.disabled, props.onLongPress])

    return <Animated.View accessible={false} className={containerClassName} removeClippedSubviews={true} style={containerAnimStyle}>
        <Pressable 
            accessible={false} 
            aria-selected={false} 
            disabled={props.disabled} 
            android_ripple={rippleConfig} 
            onPress={handlePress} 
            onLongPress={handleLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            className={buttonClassName}
        >
            {
                props.children || <Text className={titleClassName} style={styleTemplates.withBoldFont}>{props.title}</Text>
            }
        </Pressable>
    </Animated.View>
}