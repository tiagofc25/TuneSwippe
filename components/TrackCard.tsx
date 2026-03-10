import React from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { MusicTrack } from '../services/musicTypes';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface TrackCardProps {
    track: MusicTrack;
}

export function TrackCard({ track }: TrackCardProps) {
    const imageUrl = track.album?.images?.[0]?.url || track.images?.[0]?.url;

    return (
        <View style={styles.card}>
            {/* Background Cover Blurred (optionnel, pour le look premium) */}
            <Image
                source={{ uri: imageUrl }}
                style={StyleSheet.absoluteFillObject}
                blurRadius={50}
            />

            {/* Dark Overlay */}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />

            {/* Main Cover */}
            <View style={styles.imageContainer}>
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.cover} resizeMode="cover" />
                ) : (
                    <View style={[styles.cover, styles.placeholder]}>
                        <Text style={styles.placeholderEmoji}>🎸</Text>
                    </View>
                )}
            </View>

            {/* Info Overlay */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
                style={styles.gradient}
            >
                <Text style={styles.title} numberOfLines={2}>
                    {track.name}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                    {track.artists.map(a => a.name).join(', ')}
                </Text>

                {/* Animated Badge Example (Playing) */}
                <View style={styles.playingBadge}>
                    <View style={styles.playingDot} />
                    <Text style={styles.playingText}>LECTURE EN COURS</Text>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        width: width * 0.9,
        height: height * 0.65,
        borderRadius: 24,
        backgroundColor: Colors.surface,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    imageContainer: {
        flex: 1,
        padding: 20,
        paddingBottom: 120, // laisse la place au gradient
        alignItems: 'center',
        justifyContent: 'center',
    },
    cover: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    placeholder: {
        backgroundColor: Colors.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderEmoji: { fontSize: 60 },
    gradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingTop: 60,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    artist: {
        fontSize: 18,
        fontWeight: '500',
        color: Colors.spotifyGreen,
        marginBottom: 16,
    },
    playingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(29, 185, 84, 0.2)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(29, 185, 84, 0.3)',
    },
    playingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.spotifyGreen,
    },
    playingText: {
        color: Colors.spotifyGreen,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
});
