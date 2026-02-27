import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    ReactNode,
} from 'react';
import { SpotifyUser, SpotifyPlaylist } from '../services/spotify';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
    // Auth
    accessToken: string | null;
    user: SpotifyUser | null;
    setAuth: (token: string, user: SpotifyUser) => void;
    clearAuth: () => void;

    // Playlists
    mySelectedPlaylist: SpotifyPlaylist | null;
    setMySelectedPlaylist: (playlist: SpotifyPlaylist | null) => void;
    partnerPlaylistId: string | null;
    setPartnerPlaylistId: (id: string | null) => void;

    // Session
    sessionId: string | null;
    setSessionId: (id: string | null) => void;
    roomCode: string | null;
    setRoomCode: (code: string | null) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [user, setUser] = useState<SpotifyUser | null>(null);
    const [mySelectedPlaylist, setMySelectedPlaylist] =
        useState<SpotifyPlaylist | null>(null);
    const [partnerPlaylistId, setPartnerPlaylistId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [roomCode, setRoomCode] = useState<string | null>(null);

    const setAuth = useCallback((token: string, spotifyUser: SpotifyUser) => {
        setAccessToken(token);
        setUser(spotifyUser);
    }, []);

    const clearAuth = useCallback(() => {
        setAccessToken(null);
        setUser(null);
        setMySelectedPlaylist(null);
        setPartnerPlaylistId(null);
        setSessionId(null);
        setRoomCode(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                accessToken,
                user,
                setAuth,
                clearAuth,
                mySelectedPlaylist,
                setMySelectedPlaylist,
                partnerPlaylistId,
                setPartnerPlaylistId,
                sessionId,
                setSessionId,
                roomCode,
                setRoomCode,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used inside <AuthProvider>');
    }
    return ctx;
}
