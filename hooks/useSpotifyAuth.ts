import { useState, useCallback, useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// ─── Storage Keys ────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
    ACCESS_TOKEN: 'spotify_access_token',
    REFRESH_TOKEN: 'spotify_refresh_token',
    TOKEN_EXPIRY: 'spotify_token_expiry', // timestamp absolu en ms
    SCOPES: 'spotify_token_scopes', // scopes accordés (string, séparé par espaces)
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: number | null; // timestamp absolu
    isLoading: boolean;
    error: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSpotifyAuth() {
    const [authState, setAuthState] = useState<AuthState>({
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        isLoading: true, // true au démarrage pour charger depuis AsyncStorage
        error: null,
    });

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
            // Important: si l'utilisateur avait déjà autorisé l'app avec moins de scopes,
            // Spotify ne rajoute pas de scopes via refresh. On force l'écran pour ré-accorder.
            extraParams: { show_dialog: 'true' },
        },
        discovery
    );

    // ─── Chargement du token depuis AsyncStorage au démarrage ────────────────

    useEffect(() => {
        const loadStoredToken = async () => {
            try {
                const [accessToken, refreshToken, tokenExpiry, storedScopes] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
                    AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
                    AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY),
                    AsyncStorage.getItem(STORAGE_KEYS.SCOPES),
                ]);

                if (accessToken && refreshToken && tokenExpiry) {
                    // Si les scopes demandés ont changé depuis le dernier login,
                    // on purge et on force un nouveau consentement.
                    if (storedScopes && storedScopes !== SCOPES) {
                        console.log(
                            '[AUTH] Scopes modifiés depuis le dernier login → purge du token'
                        );
                        await logout();
                        return;
                    }

                    const expiry = Number(tokenExpiry);

                    // Token encore valide
                    if (Date.now() < expiry) {
                        console.log('[AUTH] Token chargé depuis le storage, encore valide');
                        setAuthState({
                            accessToken,
                            refreshToken,
                            tokenExpiry: expiry,
                            isLoading: false,
                            error: null,
                        });
                    } else {
                        // Token expiré → on refresh directement
                        console.log('[AUTH] Token expiré, refresh en cours...');
                        await refreshAccessToken(refreshToken);
                    }
                } else {
                    setAuthState((prev) => ({ ...prev, isLoading: false }));
                }
            } catch (err) {
                console.error('[AUTH] Erreur chargement storage:', err);
                setAuthState((prev) => ({ ...prev, isLoading: false }));
            }
        };

        loadStoredToken();
    }, []);

    // ─── Sauvegarde du token dans AsyncStorage ────────────────────────────────

    const saveTokenToStorage = async (
        accessToken: string,
        refreshToken: string,
        expiresIn: number,
        grantedScopes?: string
    ) => {
        const tokenExpiry = Date.now() + expiresIn * 1000;
        await Promise.all([
            AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
            AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
            AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(tokenExpiry)),
            AsyncStorage.setItem(STORAGE_KEYS.SCOPES, grantedScopes ?? SCOPES),
        ]);
        return tokenExpiry;
    };

    // ─── Refresh du token ─────────────────────────────────────────────────────

    const refreshAccessToken = useCallback(async (storedRefreshToken?: string) => {
        const refreshToken = storedRefreshToken || authState.refreshToken;
        if (!refreshToken) {
            console.warn('[AUTH] Pas de refresh token disponible');
            return null;
        }

        try {
            const response = await fetch(discovery.tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: CLIENT_ID,
                }).toString(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error_description || 'Refresh failed');
            }

            const tokenData = await response.json();
            const newRefreshToken = tokenData.refresh_token || refreshToken;
            const tokenExpiry = await saveTokenToStorage(
                tokenData.access_token,
                newRefreshToken,
                tokenData.expires_in,
                // Spotify ne renvoie pas toujours "scope" sur refresh; on garde le scope attendu.
                tokenData.scope || SCOPES
            );

            console.log('[AUTH] Token refreshé avec succès');
            setAuthState({
                accessToken: tokenData.access_token,
                refreshToken: newRefreshToken,
                tokenExpiry,
                isLoading: false,
                error: null,
            });

            return tokenData.access_token as string;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erreur refresh token';
            console.error('[AUTH] Erreur refresh:', message);
            // Refresh échoué → on déconnecte l'utilisateur
            await logout();
            return null;
        }
    }, [authState.refreshToken]);

    // ─── Getter du token valide (à utiliser dans tes services) ───────────────

    const getValidToken = useCallback(async (): Promise<string | null> => {
        // Cas fréquent: une autre instance du hook est montée sur un autre écran.
        // On tente de recharger depuis AsyncStorage avant de conclure à "pas de token".
        if (!authState.accessToken || !authState.tokenExpiry) {
            try {
                const [accessToken, refreshToken, tokenExpiry, storedScopes] =
                    await Promise.all([
                        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
                        AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
                        AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY),
                        AsyncStorage.getItem(STORAGE_KEYS.SCOPES),
                    ]);

                // Dans useSpotifyAuth.ts, remplace la comparaison de scopes partout par :
const normalizeScopes = (s: string) => s.split(' ').sort().join(' ');

if (storedScopes && normalizeScopes(storedScopes) !== normalizeScopes(SCOPES)) {
  console.log('[AUTH] Scopes modifiés → purge du token');
  await logout();
  return null;
}

                if (accessToken && tokenExpiry) {
                    const expiry = Number(tokenExpiry);

                    if (Date.now() < expiry) {
                        setAuthState({
                            accessToken,
                            refreshToken,
                            tokenExpiry: expiry,
                            isLoading: false,
                            error: null,
                        });
                        return accessToken;
                    }

                    // Expiré: tenter un refresh si possible
                    if (refreshToken) {
                        return await refreshAccessToken(refreshToken);
                    }
                }
            } catch (err) {
                console.error('[AUTH] getValidToken storage reload error:', err);
            }
            return null;
        }

        // Refresh si le token expire dans moins de 5 minutes
        if (Date.now() > authState.tokenExpiry - 5 * 60 * 1000) {
            return await refreshAccessToken();
        }

        return authState.accessToken;
    }, [authState.accessToken, authState.tokenExpiry, refreshAccessToken]);

    // ─── Échange du code contre un token ─────────────────────────────────────

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
                const tokenExpiry = await saveTokenToStorage(
                    tokenData.access_token,
                    tokenData.refresh_token,
                    tokenData.expires_in,
                    tokenData.scope || SCOPES
                );

                console.log(
                    '[AUTH] Token obtenu et sauvegardé avec succès',
                    '| scopes:',
                    tokenData.scope || '(none)'
                );
                setAuthState({
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                    tokenExpiry,
                    isLoading: false,
                    error: null,
                });

                return tokenData.access_token as string;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Erreur inconnue';
                console.error('[AUTH] Erreur échange token:', message);
                setAuthState((prev) => ({ ...prev, isLoading: false, error: message }));
                return null;
            }
        },
        [redirectUri]
    );

    // ─── Gestion de la réponse OAuth ──────────────────────────────────────────

    useEffect(() => {
        if (response?.type === 'success' && request?.codeVerifier) {
            exchangeCodeForToken(response.params.code, request.codeVerifier);
        } else if (response?.type === 'error') {
            setAuthState((prev) => ({
                ...prev,
                isLoading: false,
                error: response.error?.message || "Erreur d'authentification",
            }));
        } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
            setAuthState((prev) => ({ ...prev, isLoading: false }));
        }
    }, [response, request, exchangeCodeForToken]);

    // ─── Login ────────────────────────────────────────────────────────────────

    const login = useCallback(async () => {
        if (!request) {
            console.warn('[AUTH] Request not ready');
            return;
        }
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
        try {
            await promptAsync();
        } catch (err) {
            console.error('[AUTH] Prompt async error:', err);
            setAuthState((prev) => ({ ...prev, isLoading: false, error: 'Internal Error' }));
        }
    }, [request, promptAsync]);

    // ─── Logout ───────────────────────────────────────────────────────────────

    const logout = useCallback(async () => {
        await Promise.all([
            AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
            AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
            AsyncStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY),
            AsyncStorage.removeItem(STORAGE_KEYS.SCOPES),
        ]);
        setAuthState({
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            isLoading: false,
            error: null,
        });
    }, []);

    return {
        ...authState,
        isAuthenticated: !!authState.accessToken,
        login,
        logout,
        getValidToken, // ← utilise ça dans tes services Spotify
        redirectUri,
        isReady: !!request,
    };
}