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
import { useAuth } from '../context/AuthContext';
import { getPlaylistTracks as getSpotifyTracks } from '../services/spotify';
import { MusicTrack } from '../services/musicTypes';
import { TrackCard } from '../components/TrackCard';
import { Colors } from '../constants/Colors';
import { MusicButton } from '../components/MusicButton';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function SwipeScreen() {
    const router = useRouter();
    const {
        accessToken,
        user,
        sessionId,
        setPartnerPlaylistId,
        partnerPlaylistId,
    } = useAuth();

    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [tracksError, setTracksError] = useState<string | null>(null);
    const [waitingForPartner, setWaitingForPartner] = useState(false);
    const [index, setIndex] = useState(0);

    // Refs pour éviter les problèmes de closure stale dans les callbacks Realtime
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    // ─── Phase 1: Vérifier que le partenaire a aussi choisi sa playlist ───────

    useEffect(() => {
        if (!accessToken || !sessionId || !user) {
            router.replace('/session-management');
            return;
        }

        let pollingInterval: ReturnType<typeof setInterval> | null = null;
        let isMounted = true;

        const checkPartnerReady = async () => {
            if (accessToken === 'mock-token') {
                setPartnerPlaylistId('mock-partner-p2');
                setWaitingForPartner(false);
                return true;
            }

            const { data: session, error } = await supabase
                .from('sessions')
                .select('user1_id, user1_playlist_id, user2_playlist_id')
                .eq('id', sessionId)
                .single();

            if (error || !session) {
                console.error('[SWIPE] Session fetch error:', error);
                return false;
            }

            const currentUser = userRef.current;
            if (!currentUser) return false;

            const isHost = session.user1_id === currentUser.id;
            // On récupère l'ID de la playlist du partenaire uniquement pour savoir s'il est prêt
            const partnerReady = isHost ? !!session.user2_playlist_id : !!session.user1_playlist_id;
            const pId = isHost ? session.user2_playlist_id : session.user1_playlist_id;

            console.log('[SWIPE] Am I host?', isHost, '| Partner ready?', partnerReady);

            if (partnerReady && isMounted) {
                setPartnerPlaylistId(pId);
                setWaitingForPartner(false);
                return true;
            } else if (isMounted) {
                setWaitingForPartner(true);
                return false;
            }
            return false;
        };

        // Première vérification
        checkPartnerReady().then(found => {
            if (!found && isMounted) {
                // Polling de secours toutes les 3 secondes
                pollingInterval = setInterval(async () => {
                    console.log('[SWIPE] Polling for partner...');
                    const ready = await checkPartnerReady();
                    if (ready && pollingInterval) {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                    }
                }, 3000);
            }
        });

        // Écouter les changements en temps réel
        const channel = supabase
            .channel(`session-${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
                (payload: any) => {
                    console.log('[SWIPE] Realtime update received:', payload.new);
                    const session = payload.new;
                    const currentUser = userRef.current;
                    if (!currentUser) return;

                    const isHost = session.user1_id === currentUser.id;
                    const pId = isHost ? session.user2_playlist_id : session.user1_playlist_id;

                    if (pId && isMounted) {
                        setPartnerPlaylistId(pId);
                        setWaitingForPartner(false);
                        if (pollingInterval) {
                            clearInterval(pollingInterval);
                            pollingInterval = null;
                        }
                    }
                }
            )
            .subscribe((status: string) => {
                console.log('[SWIPE] Realtime subscription status:', status);
            });

        return () => {
            isMounted = false;
            if (pollingInterval) clearInterval(pollingInterval);
            supabase.removeChannel(channel);
        };
    }, [accessToken, sessionId]);

    // ─── Phase 2: Fetch les tracks de la playlist du PARTENAIRE ────────────────
    // Les playlists sont publiques (filtrées lors de la sélection), donc accessibles avec n'importe quel token.

    useEffect(() => {
        if (!partnerPlaylistId || !accessToken || waitingForPartner) return;

        (async () => {
            setLoading(true);
            setTracksError(null);
            try {
                console.log('[SWIPE] Fetching PARTNER playlist tracks:', partnerPlaylistId);
                const data = await getSpotifyTracks(accessToken, partnerPlaylistId, 50);
                setTracks(data);
            } catch (err) {
                console.error('[FETCH_PARTNER_TRACKS]', err);
                setTracksError("Impossible de charger la playlist du partenaire. Elle est peut-être privée ou inaccessible.");
            } finally {
                setLoading(false);
            }
        })();
    }, [partnerPlaylistId, accessToken, waitingForPartner]);

    // ─── Swiper Handlers ───────────────────────────────────────────────────────

    const onSwiped = () => {
        setIndex(prev => prev + 1);
    };

    const saveSwipe = async (track: MusicTrack, direction: 'left' | 'right') => {
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
                <Text style={styles.loadingText}>Chargement de ta playlist...</Text>
            </View>
        );
    }

    if (tracksError) {
        return (
            <View style={styles.centered}>
                <Text style={styles.emoji}>😕</Text>
                <Text style={styles.title}>Oups !</Text>
                <Text style={styles.subtitle}>{tracksError}</Text>
                <MusicButton
                    onPress={() => router.replace('/playlist-select')}
                    label="Choisir une autre playlist"
                    style={{ marginTop: 24 }}
                    variant={'spotify'}
                />
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
                        <MusicButton
                            onPress={() => router.push('/matches')}
                            label="Voir les Matchs ❤️"
                            style={{ marginTop: 24, width: '100%' }}
                            variant={'spotify'}
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
