import React from 'react';
import {
    TouchableOpacity,
    View,
    Text,
    Image,
    StyleSheet,
} from 'react-native';
import { SpotifyPlaylist } from '../services/spotify';
import { Colors } from '../constants/Colors';

interface PlaylistCardProps {
    playlist: SpotifyPlaylist;
    onSelect: (playlist: SpotifyPlaylist) => void;
    isSelected?: boolean;
}

export function PlaylistCard({
    playlist,
    onSelect,
    isSelected = false,
}: PlaylistCardProps) {
    const coverUrl = playlist.images?.[0]?.url;
    const trackCount = playlist.tracks?.total ?? 0;

    return (
        <TouchableOpacity
            onPress={() => onSelect(playlist)}
            activeOpacity={0.75}
            style={[styles.card, isSelected && styles.cardSelected]}
        >
            {/* Pochette */}
            {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.cover} />
            ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                    <Text style={styles.coverEmoji}>🎵</Text>
                </View>
            )}

            {/* Infos */}
            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                    {playlist.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                    {playlist.owner?.display_name
                        ? `par ${playlist.owner.display_name}  ·  `
                        : ''}
                    {trackCount} morceaux
                </Text>
                {playlist.description ? (
                    <Text style={styles.description} numberOfLines={1}>
                        {playlist.description.replace(/<[^>]*>/g, '')}
                    </Text>
                ) : null}
            </View>

            {/* Indicateur sélection */}
            {isSelected && (
                <View style={styles.checkBadge}>
                    <Text style={styles.checkIcon}>✓</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 12,
        gap: 14,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    cardSelected: {
        borderColor: Colors.spotifyGreen,
        backgroundColor: Colors.card,
    },
    cover: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    coverPlaceholder: {
        backgroundColor: Colors.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    coverEmoji: { fontSize: 26 },
    info: {
        flex: 1,
        gap: 3,
    },
    name: {
        color: Colors.textPrimary,
        fontSize: 15,
        fontWeight: '700',
    },
    meta: {
        color: Colors.textSecondary,
        fontSize: 12,
    },
    description: {
        color: Colors.textMuted,
        fontSize: 11,
    },
    checkBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.spotifyGreen,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    checkIcon: {
        color: '#000',
        fontWeight: '800',
        fontSize: 14,
    },
});
