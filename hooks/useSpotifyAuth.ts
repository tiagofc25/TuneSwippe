import { useState, useCallback, useEffect } from 'react';
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
    const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'tuneswippe',
        path: 'callback',
    });

    // Log demandé par l'utilisateur
    console.log("MON URI DE REDIRECTION EST :", redirectUri);

    useEffect(() => {
        console.log('[AUTH] Current Redirect URI:', redirectUri);
    }, [redirectUri]);

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

    useEffect(() => {
        if (request) {
            console.log('[AUTH] Request created with redirectUri:', request.redirectUri);
        }
    }, [request]);

    // ─── Échange du code contre un token ──────────────────────────────────────

    const exchangeCodeForToken = useCallback(
        async (code: string, codeVerifier: string) => {
            console.log('[AUTH] Exchanging code for token...');
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
                    console.error('[AUTH] Token response NOT OK:', errorData);
                    throw new Error(errorData.error_description || 'Token exchange failed');
                }

                const tokenData = await tokenResponse.json();
                console.log('[AUTH] Token obtenu avec succès');

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
                console.error('[AUTH] Erreur échange token:', message);
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

    // ─── Effet pour gérer la réponse (plus fiable que promptAsync seul) ──────
    useEffect(() => {
        if (response) {
            console.log('[AUTH] Response type received:', response.type);

            if (response.type === 'success' && request?.codeVerifier) {
                const { code } = response.params;
                console.log('[AUTH] SUCCESS ! Code received, starting exchange...');
                exchangeCodeForToken(code, request.codeVerifier);
            } else if (response.type === 'error') {
                console.error('[AUTH] Auth error response:', response.error);
                setAuthState((prev) => ({
                    ...prev,
                    isLoading: false,
                    error: response.error?.message || 'Erreur d\'authentification',
                }));
            } else if (response.type === 'cancel' || response.type === 'dismiss') {
                console.log('[AUTH] User cancelled or dismissed the browser');
                setAuthState((prev) => ({ ...prev, isLoading: false }));
            }
        }
    }, [response, request, exchangeCodeForToken]);

    // ─── Lance le flux OAuth ───────────────────────────────────────────────────

    const login = useCallback(async () => {
        if (!request) {
            console.warn('[AUTH] Request not ready');
            return;
        }

        console.log('[AUTH] Launching browser for login...');
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            // On se fie principalement au useEffect sur 'response' pour traiter le résultat
            await promptAsync();
        } catch (err) {
            console.error('[AUTH] Prompt async error:', err);
            setAuthState((prev) => ({ ...prev, isLoading: false, error: 'Internal Error' }));
        }
    }, [request, promptAsync]);

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
        redirectUri,
        isReady: !!request,
    };
}
