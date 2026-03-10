import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    ActivityIndicator,
    SafeAreaView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
    createSharedPlaylist as createSpotifyPlaylist,
    addTracksToPlaylist as addSpotifyTracks,
    getPlaylistTracks as getSpotifyTracks
} from '../services/spotify';
import { MusicTrack } from '../services/musicTypes';
import { Colors } from '../constants/Colors';
import { MusicButton } from '../components/MusicButton';

export default function MatchesScreen() {
    const router = useRouter();
    const { accessToken, user, sessionId, mySelectedPlaylist, partnerPlaylistId } = useAuth();

    const [matches, setMatches] = useState<MusicTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportedId, setExportedId] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId || !accessToken || !user) {
            router.replace('/session-management');
            return;
        }

        fetchMatches();
    }, [sessionId]);

    const fetchMatches = async () => {
        setLoading(true);
        try {
            // 1. Récupérer tous les swipes de la session
            const { data: swipes, error } = await supabase
                .from('swipes')
                .select('*')
                .eq('session_id', sessionId)
                .eq('direction', 'right');

            if (error) throw error;

            // 2. Trouver les track_ids communs
            // Group swipes by track_id
            const trackGroups: { [key: string]: string[] } = {};
            swipes?.forEach(s => {
                if (!trackGroups[s.track_id]) trackGroups[s.track_id] = [];
                trackGroups[s.track_id].push(s.user_id);
            });

            // Une track est un match si elle a été swipée par au moins 2 users différents
            // (Dans notre cas d'usage, il n'y a que 2 users dans la room)
            const matchedIds = Object.keys(trackGroups).filter(tid => {
                const users = new Set(trackGroups[tid]);
                return users.size >= 2;
            });

            if (matchedIds.length === 0) {
                setMatches([]);
                setLoading(false);
                return;
            }

            // 3. Récupérer les détails des tracks depuis Spotify
            // Comme on a déjà les tracks dans nos playlists, on pourrait les stocker ou les refetch
            // Pour faire simple et propre, on va refetch les tracks des deux playlists concernées
            // et filtrer celles qui sont dans matchedIds.

            const [myTracks, partnerTracks] = await Promise.all([
                (mySelectedPlaylist && accessToken)
                    ? getSpotifyTracks(accessToken, mySelectedPlaylist.id)
                    : Promise.resolve([]),
                (partnerPlaylistId && accessToken)
                    ? getSpotifyTracks(accessToken, partnerPlaylistId)
                    : Promise.resolve([])
            ]);

            const allPossibleTracks = [...myTracks, ...partnerTracks];
            const uniqueMatchedTracks = matchedIds.map(id =>
                allPossibleTracks.find(t => t.id === id)
            ).filter(Boolean) as MusicTrack[];

            setMatches(uniqueMatchedTracks);
        } catch (err) {
            console.error('[FETCH_MATCHES_ERR]', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        if (!accessToken || !user || matches.length === 0) return;

        setExporting(true);
        try {
            const playlistName = `TuneSwippe Match ❤️`;

            const newPlaylist = await createSpotifyPlaylist(accessToken, user.id, playlistName);
            const trackUris = matches.map(t => (t as any).uri || '');
            await addSpotifyTracks(accessToken, newPlaylist.id, trackUris);
            setExportedId(newPlaylist.id);
            Alert.alert("Succès !", "Ta playlist de matchs a été créée sur Spotify.");
        } catch (err) {
            console.error('[EXPORT_ERR]', err);
            Alert.alert("Erreur", "Impossible de créer la playlist Spotify.");
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={Colors.spotifyGreen} size="large" />
                <Text style={styles.loadingText}>Calcul des coups de cœur communs...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{
                headerShown: true,
                headerTitle: 'Vos Matchs',
                headerStyle: { backgroundColor: Colors.background },
                headerTintColor: '#FFF',
                headerShadowVisible: false
            }} />

            <View style={styles.header}>
                <Text style={styles.matchCount}>
                    {matches.length} morceau{matches.length > 1 ? 'x' : ''} matché{matches.length > 1 ? 's' : ''} !
                </Text>
            </View>

            <FlatList
                data={matches}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <View style={styles.trackItem}>
                        <Image
                            source={{ uri: item.album?.images?.[0]?.url || (item as any).images?.[0]?.url }}
                            style={styles.albumArt}
                        />
                        <View style={styles.trackInfo}>
                            <Text style={styles.trackName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.artistName} numberOfLines={1}>
                                {item.artists.map(a => a.name).join(', ')}
                            </Text>
                        </View>
                        <Text style={styles.matchBadge}>🔥</Text>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>💔</Text>
                        <Text style={styles.emptyTitle}>Pas encore de match</Text>
                        <Text style={styles.emptyText}>
                            Swippez tous les deux à droite sur les mêmes morceaux pour les voir ici !
                        </Text>
                        <MusicButton
                            onPress={() => router.back()}
                            label="Continuer à swiper"
                            style={{ marginTop: 20 }}
                            variant={'spotify'}
                        />
                    </View>
                }
            />

            {matches.length > 0 && (
                <View style={styles.footer}>
                    <MusicButton
                        onPress={handleExport}
                        label={exportedId ? "Matchs exportés !" : "Exporter vers Spotify"}
                        isLoading={exporting}
                        disabled={!!exportedId}
                        variant={'spotify'}
                    />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centered: {
        flex: 1,
        backgroundColor: Colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    header: {
        padding: 24,
        paddingTop: 0,
    },
    matchCount: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.spotifyGreen,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 100,
    },
    trackItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    albumArt: {
        width: 50,
        height: 50,
        borderRadius: 4,
    },
    trackInfo: {
        marginLeft: 16,
        flex: 1,
    },
    trackName: {
        color: Colors.textPrimary,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    artistName: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    matchBadge: {
        fontSize: 20,
        marginLeft: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyEmoji: { fontSize: 64, marginBottom: 16 },
    emptyTitle: {
        color: Colors.textPrimary,
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 8,
    },
    emptyText: {
        color: Colors.textSecondary,
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 20,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingBottom: 34,
        backgroundColor: Colors.background,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    }
});
