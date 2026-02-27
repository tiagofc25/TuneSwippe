import React from 'react';
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    View,
} from 'react-native';
import { Colors } from '../constants/Colors';

interface SpotifyButtonProps {
    onPress: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    label?: string;
    style?: any;
}

export function SpotifyButton({
    onPress,
    isLoading = false,
    disabled = false,
    label = 'Se connecter avec Spotify',
    style,
}: SpotifyButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || isLoading}
            activeOpacity={0.8}
            style={[styles.button, (disabled || isLoading) && styles.buttonDisabled, style]}
        >
            {isLoading ? (
                <ActivityIndicator color="#000" size="small" />
            ) : (
                <View style={styles.inner}>
                    {/* Logo Spotify simplifié avec cercles */}
                    <View style={styles.spotifyIcon}>
                        <View style={[styles.bar, styles.bar1]} />
                        <View style={[styles.bar, styles.bar2]} />
                        <View style={[styles.bar, styles.bar3]} />
                    </View>
                    <Text style={styles.label}>{label}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: Colors.spotifyGreen,
        borderRadius: 50,
        paddingVertical: 16,
        paddingHorizontal: 32,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 260,
        shadowColor: Colors.spotifyGreen,
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
    spotifyIcon: {
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
        color: '#000',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
