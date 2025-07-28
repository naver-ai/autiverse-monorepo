import React, { useState, useEffect, useRef } from 'react';
import { TextStyle, ViewStyle } from 'react-native';
import Animated, { 
    Easing,
    FadeIn,
    withDelay,
    withTiming
} from 'react-native-reanimated';


const customEntering = () => {
    'worklet';
    const animations = {
      opacity: withTiming(1, { duration: 300 }),
      transform: [
        {
            translateY: withTiming(0, { duration: 300, easing: Easing.elastic(0.2) })
        },
        { scale: withTiming(1, { duration: 400, easing: Easing.elastic(0.2) }) },
      ],
    };
    const initialValues = {
      opacity: 0,
      transform: [{
        translateY: -10
    }, { scale: 1.2 }],
    };

    return {
      initialValues,
      animations,
    };
  };

export const AnimatedText = ({
    text, 
    initialDelay, 
    charInterval,
    className,
    style,
    textClassName,
    textStyle,
}: {
    text: string;
    initialDelay: number;
    charInterval: number;
    className?: string;
    style?: ViewStyle;
    textClassName?: string;
    textStyle?: TextStyle;
}) => {
    const [visibleChars, setVisibleChars] = useState(0);
    const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

    useEffect(() => {
        // Clear existing timeouts
        timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
        timeoutRefs.current = [];
        
        // Reset visible characters
        setVisibleChars(0);

        // Start revealing characters after initial delay
        const startTimeout = setTimeout(() => {
            const characters = Array.from(text);
            
            characters.forEach((_, index) => {
                const timeout = setTimeout(() => {
                    setVisibleChars(prev => prev + 1);
                }, index * charInterval);
                
                timeoutRefs.current.push(timeout);
            });
        }, initialDelay);

        timeoutRefs.current.push(startTimeout);

        // Cleanup function
        return () => {
            timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
        };
    }, [text, initialDelay, charInterval]);

    // Array.from()을 사용하여 이모지와 유니코드 문자를 올바르게 분리
    const characters = Array.from(text);

    return (
        visibleChars > 0 && <Animated.View 
            style={[
                {
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                },
                style
            ]}
            className={className}
        >
            {characters.map((char, index) => {
                if (index < visibleChars) {
                    return (
                        <Animated.Text
                            key={`${text}-${index}`}
                            className={textClassName}
                            style={textStyle}
                            entering={customEntering}
                        >
                            {char}
                        </Animated.Text>
                    );
                }
                return null;
            })}
        </Animated.View>
    );
};