import React from 'react';
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    View,
} from 'react-native';
import { Colors } from '../constants/Colors';

interface MusicButtonProps {
    onPress: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    label?: string;
    style?: any;
    variant?: 'spotify' | 'default';
}

/**
 * Un bouton optimisé pour Spotify
 */
export function MusicButton({
    onPress,
    isLoading = false,
    disabled = false,
    label = 'Continuer',
    style,
    variant = 'spotify',
}: MusicButtonProps) {
    const isSpotify = variant === 'spotify';

    const backgroundColor = isSpotify
        ? Colors.spotifyGreen
        : Colors.surface;

    const textColor = isSpotify ? '#000' : '#FFF';
    const shadowColor = backgroundColor;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || isLoading}
            activeOpacity={0.8}
            style={[
                styles.button,
                { backgroundColor, shadowColor },
                (disabled || isLoading) && styles.buttonDisabled,
                style
            ]}
        >
            {isLoading ? (
                <ActivityIndicator color={textColor} size="small" />
            ) : (
                <View style={styles.inner}>
                    {isSpotify && (
                        <View style={styles.icon}>
                            <View style={[styles.bar, styles.bar1]} />
                            <View style={[styles.bar, styles.bar2]} />
                            <View style={[styles.bar, styles.bar3]} />
                        </View>
                    )}
                    <Text style={[styles.label, { color: textColor }]}>{label}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        borderRadius: 50,
        paddingVertical: 16,
        paddingHorizontal: 32,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 260,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
        elevation: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
        shadowOpacity: 0.1,
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    icon: {
        width: 20,
        height: 20,
        justifyContent: 'center',
        gap: 3,
    },
    bar: {
        backgroundColor: '#000',
        borderRadius: 2,
        height: 2.5,
    },
    bar1: { width: 20 },
    bar2: { width: 15, alignSelf: 'flex-start' },
    bar3: { width: 12, alignSelf: 'flex-start' },
    label: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
