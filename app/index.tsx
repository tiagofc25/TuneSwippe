import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { MusicButton } from '../components/MusicButton';
import { getUserProfile } from '../services/spotifyService';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginScreen() {
    const router = useRouter();

    // Auth global
    const { accessToken, user: authUser, setAuth, clearAuth } = useAuth();

    // Hooks spécifiques
    const {
        isLoading: isSpotifyLoading,
        error: spotifyError,
        login: loginSpotify,
        isReady: isSpotifyReady,
        isAuthenticated,
        getValidToken,
    } = useSpotifyAuth();

    const [fetchingProfile, setFetchingProfile] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    // Effet pour synchroniser le token Spotify avec l'AuthContext global
    useEffect(() => {
        const syncAuth = async () => {
            if (isAuthenticated && !accessToken && !fetchingProfile) {
                console.log('[LOGIN] Spotify authenticated, fetching profile...');
                setFetchingProfile(true);
                setProfileError(null);
                try {
                    const profile = await getUserProfile(getValidToken);
                    console.log('[LOGIN] Profile fetched:', profile.display_name);
                    const token = await getValidToken();
                    if (token) {
                        setAuth(token, profile);
                    }
                } catch (err) {
                    console.error('[LOGIN] Profile fetch failed:', err);
                    setProfileError('Impossible de récupérer votre profil Spotify.');
                } finally {
                    setFetchingProfile(false);
                }
            }
        };

        syncAuth();
    }, [isAuthenticated, accessToken, setAuth, fetchingProfile, getValidToken]);

    // Mock login pour debug (uniquement en dev)
    const mockLogin = () => {
        setAuth('mock-token', {
            id: 'mock-user-id',
            display_name: 'Test Debug',
            email: 'debug@example.com',
            images: [],
            country: 'FR',
        });
        router.replace('/session-management');
    };

    // Navigation automatique
    useEffect(() => {
        // On navigue uniquement si le token global est présent ET que Spotify confirme l'auth.
        // Sinon, on risque d'utiliser un ancien token (désynchronisé) et de boucler/faire des 403.
        if (accessToken && isAuthenticated) {
            console.log('[LOGIN] Global accessToken detected, navigating...');
            router.replace('/session-management');
        }
    }, [accessToken, isAuthenticated, router]);

    // Si Spotify n'est plus authentifié (token purgé, scopes modifiés, logout),
    // on purge aussi le contexte global pour éviter une désynchronisation.
    useEffect(() => {
        if (!isSpotifyLoading && !isAuthenticated && accessToken) {
            console.log('[LOGIN] Spotify not authenticated anymore, clearing global auth');
            clearAuth();
        }
    }, [isSpotifyLoading, isAuthenticated, accessToken, clearAuth]);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0D0D0D', '#0B1210', '#0D0D0D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
                colors={['rgba(29,185,84,0.18)', 'rgba(29,185,84,0)', 'rgba(255,107,138,0.10)']}
                start={{ x: 0.15, y: 0.05 }}
                end={{ x: 0.95, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.content}>
                {/* Logo / Titre */}
                <View style={styles.logoArea}>
                    <View style={styles.logoMark}>
                        <Ionicons name="musical-notes" size={22} color="#0D0D0D" />
                    </View>
                    <Text style={styles.appName}>TuneSwippe</Text>
                    <Text style={styles.tagline}>
                        Trouvez vos coups de cœur musicaux communs
                    </Text>
                </View>

                {fetchingProfile || isSpotifyLoading ? (
                    <ActivityIndicator color={Colors.spotifyGreen} size="large" />
                ) : accessToken && authUser ? (
                    <View style={styles.profileContainer}>
                        <View style={styles.successBadge}>
                            <Ionicons name="checkmark-circle" size={16} color={Colors.spotifyGreen} />
                            <Text style={styles.successText}>Connecté : {authUser.display_name}</Text>
                        </View>
                        <ActivityIndicator color={Colors.spotifyGreen} size="small" style={{ marginTop: 10 }} />
                        <Text style={styles.tagline}>Redirection en cours...</Text>
                    </View>
                ) : (
                    <>
                        {/* Description */}
                        <View style={styles.features}>
                            {[
                                { icon: <Feather name="layers" size={18} color={Colors.textPrimary} />, text: 'Swipez les playlists de vos amis' },
                                { icon: <Ionicons name="heart" size={18} color={Colors.accentPink} />, text: 'Matchez sur les morceaux communs' },
                                { icon: <MaterialCommunityIcons name="spotify" size={18} color={Colors.spotifyGreen} />, text: 'Propulsé par Spotify' },
                            ].map((f) => (
                                <View key={f.text} style={styles.featureRow}>
                                    <View style={styles.featureIcon}>{f.icon}</View>
                                    <Text style={styles.featureText}>{f.text}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Boutons d'action */}
                        <View style={styles.actions}>
                            <MusicButton
                                onPress={loginSpotify}
                                isLoading={isSpotifyLoading}
                                disabled={!isSpotifyReady}
                                label="Connecter Spotify"
                                variant="spotify"
                            />

                            <Pressable onPress={mockLogin} style={styles.mockBtn}>
                                <View style={styles.mockRow}>
                                    <Feather name="tool" size={14} color={Colors.textMuted} />
                                    <Text style={styles.mockBtnText}>Debug : Utiliser un profil de test</Text>
                                </View>
                            </Pressable>
                        </View>
                    </>
                )}

                {/* Erreurs */}
                {(spotifyError || profileError) && (
                    <View style={styles.errorBox}>
                        <View style={styles.errorRow}>
                            <Feather name="alert-triangle" size={16} color={Colors.swipeLeft} />
                            <Text style={styles.errorText}>Erreur : {spotifyError || profileError}</Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Contenu ───────────────────────────────────────────────────────────────
    content: {
        alignItems: 'center',
        paddingHorizontal: 32,
        gap: 24,
        width: '100%',
    },

    // ── Logo ──────────────────────────────────────────────────────────────────
    logoArea: { alignItems: 'center', gap: 8 },
    logoMark: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: Colors.spotifyGreen,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 12,
    },
    appName: {
        fontSize: 36,
        fontWeight: '800',
        color: Colors.textPrimary,
        letterSpacing: -1,
    },
    tagline: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },

    // ── Features ──────────────────────────────────────────────────────────────
    features: { gap: 14, alignSelf: 'stretch' },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    featureIcon: {
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    featureText: { color: Colors.textSecondary, fontSize: 15 },

    // ── Profil connecté ───────────────────────────────────────────────────────
    profileContainer: { alignItems: 'center', gap: 12, width: '100%' },
    successBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.06)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    successText: { color: Colors.spotifyGreen, fontSize: 14, fontWeight: '600' },

    // ── Erreurs ─────────────────────────────────────────────────────────────
    errorBox: {
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        padding: 16,
        borderRadius: 12,
        width: '100%',
        gap: 8,
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,71,87,0.25)',
    },
    errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    errorText: {
        color: Colors.swipeLeft,
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '600',
    },

    actions: {
        width: '100%',
        gap: 12,
        alignItems: 'center',
    },
    // ── Actions ─────────────────────────────────────────────────────────────
    mockBtn: {
        marginTop: 10,
        padding: 8,
    },
    mockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mockBtnText: {
        color: Colors.textMuted,
        fontSize: 12,
        textDecorationLine: 'underline',
    },
});
