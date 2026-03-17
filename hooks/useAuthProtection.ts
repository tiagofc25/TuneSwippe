import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useSpotifyAuth } from './useSpotifyAuth';

/**
 * Hook pour protéger une route et rediriger vers le login si non authentifié.
 * Utilise la nouvelle architecture de useSpotifyAuth avec persistance et refresh automatique.
 */
export function useAuthProtection() {
    const router = useRouter();
    const { accessToken } = useAuth();
    const { isLoading, isAuthenticated } = useSpotifyAuth();

    useEffect(() => {
        // Si on a déjà un token dans le contexte global, on considère l'utilisateur authentifié.
        // Sinon, on se base sur l'état Spotify (chargé depuis AsyncStorage).
        if (accessToken) return;

        // Attendre le chargement initial depuis AsyncStorage
        if (isLoading) return;

        // Si pas authentifié et chargement terminé, rediriger vers le login
        if (!isAuthenticated && !isLoading) {
            console.log('[AUTH_PROTECTION] Not authenticated, redirecting to login');
            router.replace('/');
        }
    }, [accessToken, isLoading, isAuthenticated, router]);
}
