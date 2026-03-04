import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    Dimensions,
    TouchableOpacity,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import Swiper from 'react-native-deck-swiper';
import { useAudioPlayer, AudioSource } from 'expo-audio';
import { useAuth } from '../context/AuthContext';
import { getPlaylistTracks, SpotifyTrack } from '../services/spotify';
import { TrackCard } from '../components/TrackCard';
import { Colors } from '../constants/Colors';
import { SpotifyButton } from '../components/SpotifyButton';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function SwipeScreen() {
    const player = useAudioPlayer('');
    const router = useRouter();
    const {
        accessToken,
        user,
        sessionId,
        setPartnerPlaylistId,
        partnerPlaylistId
    } = useAuth();

    const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [waitingForPartner, setWaitingForPartner] = useState(false);
    const [index, setIndex] = useState(0);

    // Audio logic is now handled by player

    // ─── Phase 1: Identify Partner Playlist ───────────────────────────────────

    useEffect(() => {
        if (!accessToken || !sessionId || !user) {
            router.replace('/session-management');
            return;
        }

        const fetchSession = async () => {
            const { data: session, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (error || !session) return;

            const isHost = session.user1_id === user.id;
            const pId = isHost ? session.user2_playlist_id : session.user1_playlist_id;

            if (pId) {
                setPartnerPlaylistId(pId);
            } else {
                setWaitingForPartner(true);
            }
        };

        fetchSession();

        // Écouter les changements en temps réel
        const channel = supabase
            .channel(`session-${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
                (payload: any) => {
                    const session = payload.new;
                    const isHost = session.user1_id === user.id;
                    const pId = isHost ? session.user2_playlist_id : session.user1_playlist_id;
                    if (pId) {
                        setPartnerPlaylistId(pId);
                        setWaitingForPartner(false);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [accessToken, sessionId]);

    // ─── Phase 2: Fetch Partner Tracks ────────────────────────────────────────

    useEffect(() => {
        if (!partnerPlaylistId || !accessToken) return;

        (async () => {
            setLoading(true);
            try {
                const data = await getPlaylistTracks(accessToken, partnerPlaylistId, 50);
                setTracks(data);
            } catch (err) {
                console.error('[FETCH_PARTNER_TRACKS]', err);
            } finally {
                setLoading(false);
            }
        })();

        return () => {
            stopAudio();
        };
    }, [partnerPlaylistId, accessToken]);

    // ─── Audio Logic ──────────────────────────────────────────────────────────

    const stopAudio = async () => {
        player.pause();
    };

    const playAudio = async (trackIndex: number) => {
        const track = tracks[trackIndex];
        if (!track?.preview_url) return;

        try {
            player.replace({ uri: track.preview_url });
            player.play();
            player.loop = true;
        } catch (e) {
            console.log('[AUDIO_PLAY_ERR]', e);
        }
    };

    useEffect(() => {
        if (tracks.length > 0 && !loading) {
            playAudio(index);
        }
    }, [index, tracks, loading]);

    // ─── Swiper Handlers ───────────────────────────────────────────────────────

    const onSwiped = () => {
        setIndex(prev => prev + 1);
    };

    const saveSwipe = async (track: SpotifyTrack, direction: 'left' | 'right') => {
        if (!sessionId || !user) return;

        try {
            const { error } = await supabase.from('swipes').insert([
                {
                    session_id: sessionId,
                    user_id: user.id,
                    track_id: track.id,
                    direction
                }
            ]);
            if (error) throw error;
        } catch (err) {
            console.error('[SAVE_SWIPE]', err);
        }
    };

    const onSwipedLeft = (cardIndex: number) => {
        const track = tracks[cardIndex];
        if (track) saveSwipe(track, 'left');
    };

    const onSwipedRight = (cardIndex: number) => {
        const track = tracks[cardIndex];
        if (track) saveSwipe(track, 'right');
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    if (waitingForPartner) {
        return (
            <View style={styles.centered}>
                <Text style={styles.emoji}>⌛</Text>
                <Text style={styles.title}>En attente du partenaire...</Text>
                <Text style={styles.subtitle}>
                    Ton partenaire n'a pas encore choisi sa playlist.
                    Dès qu'il l'aura fait, tu pourras swiper !
                </Text>
                <ActivityIndicator color={Colors.spotifyGreen} style={{ marginTop: 24 }} />
            </View>
        );
    }

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={Colors.spotifyGreen} size="large" />
                <Text style={styles.loadingText}>Récupération de sa playlist...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <Text style={styles.playlistName}>Playlist du partenaire</Text>
                <Text style={styles.countText}>{index + 1} / {tracks.length}</Text>
            </View>

            <View style={styles.swiperContainer}>
                {tracks.length > 0 && index < tracks.length ? (
                    <Swiper
                        cards={tracks}
                        renderCard={(track) => <TrackCard track={track} />}
                        onSwiped={onSwiped}
                        onSwipedLeft={onSwipedLeft}
                        onSwipedRight={onSwipedRight}
                        cardIndex={index}
                        backgroundColor={'transparent'}
                        stackSize={3}
                        stackSeparation={15}
                        animateCardOpacity
                        overlayLabels={{
                            left: {
                                title: 'PAS FAN',
                                style: {
                                    label: {
                                        backgroundColor: Colors.swipeLeft,
                                        borderColor: Colors.swipeLeft,
                                        color: 'white',
                                        borderWidth: 1
                                    },
                                    wrapper: {
                                        flexDirection: 'column',
                                        alignItems: 'flex-end',
                                        justifyContent: 'flex-start',
                                        marginTop: 30,
                                        marginLeft: -30
                                    }
                                }
                            },
                            right: {
                                title: 'COUP DE COEUR',
                                style: {
                                    label: {
                                        backgroundColor: Colors.swipeRight,
                                        borderColor: Colors.swipeRight,
                                        color: 'white',
                                        borderWidth: 1
                                    },
                                    wrapper: {
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        justifyContent: 'flex-start',
                                        marginTop: 30,
                                        marginLeft: 30
                                    }
                                }
                            }
                        }}
                    />
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>🎉</Text>
                        <Text style={styles.emptyTitle}>C'est fini !</Text>
                        <Text style={styles.emptyText}>
                            Tu as parcouru toute la playlist du partenaire.
                            Découvre maintenant vos coups de cœur communs !
                        </Text>
                        <SpotifyButton
                            onPress={() => router.push('/matches')}
                            label="Voir les Matchs ❤️"
                            style={{ marginTop: 24, width: '100%' }}
                        />
                        <TouchableOpacity
                            onPress={() => router.replace('/playlist-select')}
                            style={{ marginTop: 16 }}
                        >
                            <Text style={{ color: Colors.textMuted }}>Choisir une autre playlist</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.matchFloatingBtn}
                    onPress={() => router.push('/matches')}
                >
                    <Text style={{ fontSize: 20 }}>🔥</Text>
                </TouchableOpacity>

                <View style={styles.hintContainer}>
                    <View style={styles.hintBox}>
                        <Text style={styles.hintEmoji}>👈</Text>
                        <Text style={styles.hintText}>Rejeter</Text>
                    </View>
                    <View style={styles.hintBox}>
                        <Text style={styles.hintEmoji}>👉</Text>
                        <Text style={styles.hintText}>Garder</Text>
                    </View>
                </View>
            </View>
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
        padding: 40,
        gap: 16,
    },
    emoji: { fontSize: 64, marginBottom: 8 },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    loadingText: {
        color: Colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    playlistName: {
        color: Colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    countText: {
        color: Colors.textMuted,
        fontSize: 12,
        fontWeight: '600',
    },
    swiperContainer: {
        flex: 1,
        marginTop: -20,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    matchFloatingBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    hintContainer: {
        flexDirection: 'row',
        gap: 40,
    },
    hintBox: {
        alignItems: 'center',
        gap: 4,
    },
    hintEmoji: { fontSize: 24, opacity: 0.8 },
    hintText: {
        color: Colors.textMuted,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyEmoji: { fontSize: 64, marginBottom: 16 },
    emptyTitle: {
        color: Colors.textPrimary,
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 8,
    },
    emptyText: {
        color: Colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
});
