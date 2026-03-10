const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export interface SpotifyUser {
    id: string;
    display_name: string;
    email: string;
    images: { url: string }[];
    country: string;
    service: 'spotify';
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    description: string;
    images: { url: string }[];
    tracks: { total: number };
    owner: { display_name: string };
    trackCount: number;
    ownerName: string;
    service: 'spotify';
}

export interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album: {
        name: string;
        images: { url: string; width: number; height: number }[];
    };
    preview_url: string | null;
    duration_ms: number;
    uri: string;
    service: 'spotify';
}

export interface SpotifyPlaylistTrack {
    track: SpotifyTrack;
}

// ─── Profil utilisateur ─────────────────────────────────────────────────────

export async function getUserProfile(token: string): Promise<SpotifyUser> {
    const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[SPOTIFY_PROFILE_ERROR] ${response.status} - ${errorBody}`);
        throw new Error(`Spotify API error: ${response.status} - ${errorBody}`);
    }
    const data = await response.json();
    return { ...data, service: 'spotify' };
}

// ─── Playlists de l'utilisateur ─────────────────────────────────────────────

export async function getUserPlaylists(
    token: string,
    limit = 20
): Promise<SpotifyPlaylist[]> {
    if (token === 'mock-token') {
        return [
            {
                id: 'mock-p1',
                name: 'Ma Playlist Debug 🎧',
                description: 'Playlist de test pour le développement',
                images: [{ url: 'https://placehold.co/400x400/1DB954/white?text=Playlist+1' }],
                tracks: { total: 10 },
                owner: { display_name: 'Test User' },
                trackCount: 10,
                ownerName: 'Test User',
                service: 'spotify'
            },
            {
                id: 'mock-p2',
                name: 'Mix Électro ⚡',
                description: 'Une autre playlist de test',
                images: [{ url: 'https://placehold.co/400x400/1DB954/white?text=Playlist+2' }],
                tracks: { total: 5 },
                owner: { display_name: 'Test User' },
                trackCount: 5,
                ownerName: 'Test User',
                service: 'spotify'
            }
        ];
    }

    const response = await fetch(
        `${SPOTIFY_API_BASE}/me/playlists?limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[SPOTIFY_PLAYLISTS_ERROR] ${response.status} - ${errorBody}`);
        throw new Error(`Spotify API error: ${response.status} - ${errorBody}`);
    }
    const data = await response.json();
    return data.items.map((item: any) => ({
        ...item,
        trackCount: item.tracks?.total || 0,
        ownerName: item.owner?.display_name || '',
        service: 'spotify'
    }));
}

// ─── Morceaux d'une playlist (50 premiers) ──────────────────────────────────

export async function getPlaylistTracks(
    token: string,
    playlistId: string,
    limit = 50
): Promise<SpotifyTrack[]> {
    if (token === 'mock-token') {
        return [
            {
                id: 'mock-t1',
                name: 'Debug Track 1',
                artists: [{ name: 'The Debuggers' }],
                album: {
                    name: 'Testing Album',
                    images: [{ url: 'https://placehold.co/400x400/1DB954/white?text=Track+1', width: 400, height: 400 }]
                },
                preview_url: null,
                duration_ms: 180000,
                uri: 'spotify:track:mock1',
                service: 'spotify'
            },
            {
                id: 'mock-t2',
                name: 'Awesome Song',
                artists: [{ name: 'Agent JS' }],
                album: {
                    name: 'The Great Refactor',
                    images: [{ url: 'https://placehold.co/400x400/1DB954/white?text=Track+2', width: 400, height: 400 }]
                },
                preview_url: null,
                duration_ms: 120000,
                uri: 'spotify:track:mock2',
                service: 'spotify'
            }
        ];
    }

    const response = await fetch(
        `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=${limit}&fields=items(track(id,name,artists,album,preview_url,duration_ms,uri))`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[SPOTIFY_TRACKS_ERROR] ${response.status} - ${errorBody}`);
        throw new Error(`Spotify API error: ${response.status} - ${errorBody}`);
    }
    const data = await response.json();
    return (data.items as SpotifyPlaylistTrack[])
        .map((item) => ({ ...item.track, service: 'spotify' } as SpotifyTrack))
        .filter(Boolean);
}

// ─── Créer une playlist partagée ────────────────────────────────────────────

export async function createSharedPlaylist(
    token: string,
    userId: string,
    name: string
): Promise<SpotifyPlaylist> {
    const response = await fetch(
        `${SPOTIFY_API_BASE}/users/${userId}/playlists`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                description: 'Créé par TuneSwippe 🎵 – Vos coups de cœur communs',
                public: false,
            }),
        }
    );
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[SPOTIFY_CREATE_PLAYLIST_ERROR] ${response.status} - ${errorBody}`);
        throw new Error(`Spotify API error: ${response.status} - ${errorBody}`);
    }
    return response.json();
}

// ─── Ajouter des morceaux à une playlist ────────────────────────────────────

export async function addTracksToPlaylist(
    token: string,
    playlistId: string,
    trackUris: string[]
): Promise<void> {
    // Spotify accepte max 100 tracks par requête
    const chunks: string[][] = [];
    for (let i = 0; i < trackUris.length; i += 100) {
        chunks.push(trackUris.slice(i, i + 100));
    }
    for (const chunk of chunks) {
        const response = await fetch(
            `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uris: chunk }),
            }
        );
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[SPOTIFY_ADD_TRACKS_ERROR] ${response.status} - ${errorBody}`);
            throw new Error(`Spotify API error: ${response.status} - ${errorBody}`);
        }
    }
}
