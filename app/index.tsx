import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    ActivityIndicator,
    Pressable,
    ScrollView,
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

    // ─── Récupère le profil dès qu'on a un token ─────────────────────────────

    useEffect(() => {
        if (!accessToken) return;
        (async () => {
            setFetchingProfile(true);
            try {
                const profile = await getUserProfile(accessToken);
                setUser(profile);
                setAuth(accessToken, profile);
            } catch (e) {
                console.error('[PROFILE] Erreur:', e);
            } finally {
                setFetchingProfile(false);
            }
        })();
    }, [accessToken, setAuth]);

    // ─── Render : profil connecté ─────────────────────────────────────────────

    if (accessToken && (fetchingProfile || user)) {
        return (
            <View style={styles.container}>
                {fetchingProfile ? (
                    <ActivityIndicator color={Colors.spotifyGreen} size="large" />
                ) : user ? (
                    <View style={styles.profileContainer}>
                        {/* Avatar */}
                        {user.images?.[0]?.url ? (
                            <Image source={{ uri: user.images[0].url }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarInitial}>
                                    {user.display_name?.[0]?.toUpperCase() ?? '?'}
                                </Text>
                            </View>
                        )}

                        {/* Infos */}
                        <View style={styles.successBadge}>
                            <Text style={styles.successEmoji}>✅</Text>
                            <Text style={styles.successText}>Connecté à Spotify</Text>
                        </View>

                        <Text style={styles.userName}>{user.display_name}</Text>
                        <Text style={styles.userEmail}>{user.email}</Text>

                        {/* Token debug (visible en dev) */}
                        <View style={styles.tokenBox}>
                            <Text style={styles.tokenLabel}>Access Token (debug)</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <Text style={styles.tokenText} numberOfLines={1}>
                                    {accessToken.slice(0, 40)}…
                                </Text>
                            </ScrollView>
                        </View>

                        {/* Bouton continuer (Étape 4) */}
                        <Pressable
                            style={styles.continueButton}
                            onPress={() => {
                                router.push('/session-management');
                            }}
                        >
                            <Text style={styles.continueLabel}>Continuer →</Text>
                        </Pressable>

                        {/* Déconnexion */}
                        <Pressable onPress={() => { logout(); setUser(null); }} style={styles.logoutBtn}>
                            <Text style={styles.logoutText}>Se déconnecter</Text>
                        </Pressable>
                    </View>
                ) : null}
            </View>
        );
    }

    // ─── Render : écran de login ──────────────────────────────────────────────

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

                {/* Erreur */}
                {error ? (
                    <Text style={styles.errorText}>⚠️ {error}</Text>
                ) : null}

                {/* Debug redirect URI */}
                {__DEV__ && (
                    <Text style={styles.debugText}>
                        Redirect: {redirectUri}
                    </Text>
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

    // ── Erreur / debug ────────────────────────────────────────────────────────
    errorText: {
        color: Colors.swipeLeft,
        fontSize: 13,
        textAlign: 'center',
        paddingHorizontal: 16,
    },
    debugText: {
        color: Colors.textMuted,
        fontSize: 10,
        textAlign: 'center',
    },

    // ── Profil connecté ───────────────────────────────────────────────────────
    profileContainer: { alignItems: 'center', gap: 16, paddingHorizontal: 32 },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: Colors.spotifyGreen,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: Colors.spotifyGreen,
    },
    avatarInitial: {
        fontSize: 36,
        fontWeight: '800',
        color: Colors.textPrimary,
    },
    successBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.card,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
    },
    successEmoji: { fontSize: 14 },
    successText: { color: Colors.spotifyGreen, fontSize: 13, fontWeight: '600' },
    userName: {
        fontSize: 24,
        fontWeight: '800',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    userEmail: { fontSize: 14, color: Colors.textSecondary },
    tokenBox: {
        backgroundColor: Colors.surface,
        borderRadius: 8,
        padding: 12,
        alignSelf: 'stretch',
        gap: 4,
    },
    tokenLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
    tokenText: {
        color: Colors.spotifyGreen,
        fontSize: 12,
        fontFamily: 'monospace',
    },
    continueButton: {
        backgroundColor: Colors.spotifyGreen,
        borderRadius: 50,
        paddingVertical: 14,
        paddingHorizontal: 40,
        alignSelf: 'stretch',
        alignItems: 'center',
    },
    continueLabel: { color: '#000', fontSize: 16, fontWeight: '700' },
    logoutBtn: { marginTop: 4 },
    logoutText: { color: Colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
