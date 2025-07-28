import { LinearGradient } from "expo-linear-gradient"
import { StyleProp, ViewStyle } from "react-native"

const BackgroundPropBase = {
    start: {x: 0, y: 0},
    end: {x: 1, y: 0},
    style: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        top: 0
    } as StyleProp<ViewStyle>
}

const SignInBackgroundProps = {
    ...BackgroundPropBase,
    colors: ['#F4F7F7', '#E6E1D8'] as const,
}

const HomeScreenBackgroundProps = {
    ...BackgroundPropBase,
    colors: ['#F4F7F7', '#E6E1D8'] as const,
}

export const SignInBackground = () => {
    return <LinearGradient
    {...SignInBackgroundProps}
/>
}

export const HomeScreenBackground = () => {
    return <LinearGradient pointerEvents="none"
    {...HomeScreenBackgroundProps}
/>
}

