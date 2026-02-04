import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TextStyle, ViewStyle } from 'react-native';
import Animated, { 
    Easing,
    FadeIn,
    withDelay,
    withTiming
} from 'react-native-reanimated';
import { UserLocale } from '@autiverse-monorepo/ts-core';
import { useDyad } from '../api/dyad';


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
    const { locale } = useDyad();
    const effectiveCharInterval = locale === UserLocale.English ? Math.min(60, charInterval) : charInterval;
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
                }, index * effectiveCharInterval);
                
                timeoutRefs.current.push(timeout);
            });
        }, initialDelay);

        timeoutRefs.current.push(startTimeout);

        // Cleanup function
        return () => {
            timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
        };
    }, [text, initialDelay, effectiveCharInterval]);

    // 단어(공백 단위)로 묶어서 줄바꿈은 단어 경계에서만, 글자별 entering 애니메이션은 유지
    const segments = useMemo(() => text.split(/(\s+)/), [text]);
    const segmentRanges = useMemo(() => {
        let start = 0;
        return segments.map(seg => {
            const len = Array.from(seg).length;
            const range = [start, start + len] as const;
            start += len;
            return range;
        });
    }, [segments]);

    return (
        visibleChars > 0 && <Animated.View
            style={[{ flexDirection: 'row', flexWrap: 'wrap' }, style]}
            className={className}
        >
            {segments.map((segment, segIndex) => {
                const [segStart, segEnd] = segmentRanges[segIndex];
                const visibleInSegment = Math.max(0, Math.min(visibleChars - segStart, segEnd - segStart));
                if (visibleInSegment <= 0) return null;
                const chars = Array.from(segment);
                return (
                    <Animated.View key={segIndex} style={{ flexDirection: 'row' }}>
                        {chars.slice(0, visibleInSegment).map((char, charIndex) => (
                            <Animated.Text
                                key={`${segIndex}-${charIndex}`}
                                className={textClassName}
                                style={textStyle}
                                entering={customEntering}
                            >
                                {char}
                            </Animated.Text>
                        ))}
                    </Animated.View>
                );
            })}
        </Animated.View>
    );
};