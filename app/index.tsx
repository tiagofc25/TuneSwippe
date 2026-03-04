import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    ActivityIndicator,
    Pressable,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { SpotifyButton } from '../components/SpotifyButton';
import { getUserProfile, SpotifyUser } from '../services/spotify';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
    const router = useRouter();
    const { setAuth } = useAuth();
    const { accessToken, isLoading, error, login, logout, redirectUri, isReady } =
        useSpotifyAuth();
    const [user, setUser] = useState<SpotifyUser | null>(null);
    const [fetchingProfile, setFetchingProfile] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    // Mock login pour debug (uniquement en dev)
    const mockLogin = () => {
        const mockUser: SpotifyUser = {
            id: 'mock-user-id',
            display_name: 'Test Debug',
            email: 'debug@example.com',
            images: [],
            country: 'FR'
        };
        setAuth('mock-token', mockUser);
        router.replace('/session-management');
    };

    // ─── Récupère le profil dès qu'on a un token ─────────────────────────────

    useEffect(() => {
        if (!accessToken) return;
        (async () => {
            setFetchingProfile(true);
            try {
                setProfileError(null);
                const profile = await getUserProfile(accessToken);
                setUser(profile);
                setAuth(accessToken, profile);

                // Navigation automatique
                router.replace('/session-management');
            } catch (e) {
                console.error('[PROFILE] Erreur:', e);
                setProfileError(e instanceof Error ? e.message : 'Impossible de charger le profil');
                logout(); // On déconnecte si le profil échoue (403 probable)
            } finally {
                setFetchingProfile(false);
            }
        })();
    }, [accessToken, setAuth, router, logout]);

    // ─── Render principal ───────────────────────────────────────────────────

    return (
        <View style={styles.container}>
            {/* Cercles décoratifs */}
            <View style={styles.circle1} />
            <View style={styles.circle2} />

            <View style={styles.content}>
                {/* Logo / Titre */}
                <View style={styles.logoArea}>
                    <Text style={styles.logo}>🎵</Text>
                    <Text style={styles.appName}>TuneSwippe</Text>
                    <Text style={styles.tagline}>
                        Trouvez vos coups de cœur musicaux communs
                    </Text>
                </View>

                {fetchingProfile ? (
                    <ActivityIndicator color={Colors.spotifyGreen} size="large" />
                ) : accessToken && user ? (
                    <View style={styles.profileContainer}>
                        <View style={styles.successBadge}>
                            <Text style={styles.successEmoji}>✅</Text>
                            <Text style={styles.successText}>Connecté : {user.display_name}</Text>
                        </View>
                        <ActivityIndicator color={Colors.spotifyGreen} size="small" style={{ marginTop: 10 }} />
                        <Text style={styles.tagline}>Redirection en cours...</Text>
                    </View>
                ) : (
                    <>
                        {/* Description */}
                        <View style={styles.features}>
                            {[
                                { emoji: '🎧', text: 'Swipez les playlists de vos amis' },
                                { emoji: '❤️', text: 'Matchez sur les morceaux communs' },
                                { emoji: '🎶', text: 'Créez une playlist partagée Spotify' },
                            ].map((f) => (
                                <View key={f.text} style={styles.featureRow}>
                                    <Text style={styles.featureEmoji}>{f.emoji}</Text>
                                    <Text style={styles.featureText}>{f.text}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Bouton connexion */}
                        <SpotifyButton
                            onPress={login}
                            isLoading={isLoading || !isReady}
                            disabled={!isReady}
                        />

                        {/* Debug Mock Login */}
                        {__DEV__ && (
                            <TouchableOpacity onPress={mockLogin} style={styles.debugBtn}>
                                <Text style={styles.debugBtnText}>🔧 Debug: Utiliser un profil de test</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                {/* Erreurs */}
                {(error || profileError) ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>⚠️ Erreur : {error || profileError}</Text>
                        {profileError?.includes('403') && (
                            <Text style={styles.errorHint}>
                                Assurez-vous d'avoir ajouté votre compte dans le Spotify Developer Dashboard.
                            </Text>
                        )}
                    </View>
                ) : null}
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

    // ── Déco ──────────────────────────────────────────────────────────────────
    circle1: {
        position: 'absolute',
        width: 350,
        height: 350,
        borderRadius: 175,
        backgroundColor: Colors.spotifyGreen,
        opacity: 0.05,
        top: -80,
        right: -80,
    },
    circle2: {
        position: 'absolute',
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: Colors.accentPink,
        opacity: 0.05,
        bottom: -40,
        left: -60,
    },

    // ── Contenu ───────────────────────────────────────────────────────────────
    content: {
        alignItems: 'center',
        paddingHorizontal: 32,
        gap: 32,
        width: '100%',
    },

    // ── Logo ──────────────────────────────────────────────────────────────────
    logoArea: { alignItems: 'center', gap: 8 },
    logo: { fontSize: 64 },
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
    featureEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
    featureText: { color: Colors.textSecondary, fontSize: 15 },

    // ── Profil connecté ───────────────────────────────────────────────────────
    profileContainer: { alignItems: 'center', gap: 12, width: '100%' },
    successBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.card,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    successEmoji: { fontSize: 14 },
    successText: { color: Colors.spotifyGreen, fontSize: 14, fontWeight: '600' },

    // ── Erreurs ─────────────────────────────────────────────────────────────
    errorBox: {
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        padding: 16,
        borderRadius: 12,
        width: '100%',
        gap: 8,
        marginTop: 10,
    },
    errorText: {
        color: Colors.swipeLeft,
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '600',
    },
    errorHint: {
        color: Colors.textSecondary,
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },

    // ── Debug ───────────────────────────────────────────────────────────────
    debugBtn: {
        marginTop: 8,
        padding: 12,
    },
    debugBtnText: {
        color: Colors.textMuted,
        fontSize: 12,
        textDecorationLine: 'underline',
    },
});
