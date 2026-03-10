import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    ReactNode,
} from 'react';
import { MusicUser, MusicPlaylist } from '../services/musicTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
    // Auth
    accessToken: string | null;
    user: MusicUser | null;
    setAuth: (token: string, user: MusicUser) => void;
    clearAuth: () => void;

    // Playlists
    mySelectedPlaylist: MusicPlaylist | null;
    setMySelectedPlaylist: (playlist: MusicPlaylist | null) => void;
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
    const [user, setUser] = useState<MusicUser | null>(null);
    const [mySelectedPlaylist, setMySelectedPlaylist] =
        useState<MusicPlaylist | null>(null);
    const [partnerPlaylistId, setPartnerPlaylistId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [roomCode, setRoomCode] = useState<string | null>(null);

    const setAuth = useCallback((token: string, musicUser: MusicUser) => {
        setAccessToken(token);
        setUser(musicUser);
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
