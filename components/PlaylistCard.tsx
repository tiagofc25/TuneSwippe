import React from 'react';
import {
    TouchableOpacity,
    View,
    Text,
    Image,
    StyleSheet,
} from 'react-native';
import { MusicPlaylist } from '../services/musicTypes';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface PlaylistCardProps {
    playlist: MusicPlaylist;
    onSelect: (playlist: MusicPlaylist) => void;
    isSelected?: boolean;
}

export function PlaylistCard({
    playlist,
    onSelect,
    isSelected = false,
}: PlaylistCardProps) {
    const coverUrl = playlist.images?.[0]?.url;
    const trackCount = playlist.trackCount;

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
                <LinearGradient
                    colors={['rgba(29,185,84,0.35)', 'rgba(255,255,255,0.06)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.cover, styles.coverPlaceholder]}
                >
                    <Ionicons name="musical-notes" size={22} color="rgba(255,255,255,0.92)" />
                </LinearGradient>
            )}

            {/* Infos */}
            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                    {playlist.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                    {playlist.ownerName
                        ? `par ${playlist.ownerName}  ·  `
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
                    <Ionicons name="checkmark" size={16} color="#0D0D0D" />
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
        borderRadius: 16,
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
        borderRadius: 14,
    },
    coverPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
    },
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
});
