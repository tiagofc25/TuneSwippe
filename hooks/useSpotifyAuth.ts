import { useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Nécessaire pour que le navigateur se ferme correctement sur Android
WebBrowser.maybeCompleteAuthSession();

// ─── Configuration Spotify ──────────────────────────────────────────────────

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!;
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'streaming',
].join(' ');

const discovery = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    expiresIn: number | null;
    isLoading: boolean;
    error: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSpotifyAuth() {
    const [authState, setAuthState] = useState<AuthState>({
        accessToken: null,
        refreshToken: null,
        expiresIn: null,
        isLoading: false,
        error: null,
    });

    // Génère automatiquement le redirect URI adapté à l'environnement
    // Sur simulateur/appareil: tuneswippe://callback
    // Sur Expo Go: exp://...
    const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'tuneswippe',
        path: 'callback',
    });

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId: CLIENT_ID,
            scopes: SCOPES.split(' '),
            redirectUri,
            responseType: AuthSession.ResponseType.Code,
            usePKCE: true,
            extraParams: {
                show_dialog: 'false',
            },
        },
        discovery
    );

    // ─── Échange du code contre un token ──────────────────────────────────────

    const exchangeCodeForToken = useCallback(
        async (code: string, codeVerifier: string) => {
            setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

            try {
                const tokenResponse = await fetch(discovery.tokenEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: redirectUri,
                        client_id: CLIENT_ID,
                        code_verifier: codeVerifier,
                    }).toString(),
                });

                if (!tokenResponse.ok) {
                    const errorData = await tokenResponse.json();
                    throw new Error(errorData.error_description || 'Token exchange failed');
                }

                const tokenData = await tokenResponse.json();

                console.log('[AUTH] ✅ Token obtenu avec succès !');
                console.log('[AUTH] Token:', tokenData.access_token?.slice(0, 20) + '...');

                setAuthState({
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                    expiresIn: tokenData.expires_in,
                    isLoading: false,
                    error: null,
                });

                return tokenData.access_token as string;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Erreur inconnue';
                console.error('[AUTH] ❌ Erreur:', message);
                setAuthState((prev) => ({
                    ...prev,
                    isLoading: false,
                    error: message,
                }));
                return null;
            }
        },
        [redirectUri]
    );

    // ─── Lance le flux OAuth ───────────────────────────────────────────────────

    const login = useCallback(async () => {
        if (!request) return;
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
        const result = await promptAsync();

        if (result.type === 'success' && request.codeVerifier) {
            await exchangeCodeForToken(result.params.code, request.codeVerifier);
        } else if (result.type === 'error') {
            setAuthState((prev) => ({
                ...prev,
                isLoading: false,
                error: result.error?.message || 'Connexion annulée',
            }));
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
            setAuthState((prev) => ({ ...prev, isLoading: false }));
        }
    }, [request, promptAsync, exchangeCodeForToken]);

    // ─── Déconnexion ──────────────────────────────────────────────────────────

    const logout = useCallback(() => {
        setAuthState({
            accessToken: null,
            refreshToken: null,
            expiresIn: null,
            isLoading: false,
            error: null,
        });
    }, []);

    return {
        ...authState,
        login,
        logout,
        redirectUri, // Utile pour debug
        isReady: !!request,
    };
}
