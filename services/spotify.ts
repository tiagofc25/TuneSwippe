const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export interface SpotifyUser {
    id: string;
    display_name: string;
    email: string;
    images: { url: string }[];
    country: string;
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    description: string;
    images: { url: string }[];
    tracks: { total: number };
    owner: { display_name: string };
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
        throw new Error(`Spotify API error: ${response.status}`);
    }
    return response.json();
}

// ─── Playlists de l'utilisateur ─────────────────────────────────────────────

export async function getUserPlaylists(
    token: string,
    limit = 20
): Promise<SpotifyPlaylist[]> {
    const response = await fetch(
        `${SPOTIFY_API_BASE}/me/playlists?limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
    }
    const data = await response.json();
    return data.items;
}

// ─── Morceaux d'une playlist (50 premiers) ──────────────────────────────────

export async function getPlaylistTracks(
    token: string,
    playlistId: string,
    limit = 50
): Promise<SpotifyTrack[]> {
    const response = await fetch(
        `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=${limit}&fields=items(track(id,name,artists,album,preview_url,duration_ms,uri))`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
    }
    const data = await response.json();
    return (data.items as SpotifyPlaylistTrack[])
        .map((item) => item.track)
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
        throw new Error(`Spotify API error: ${response.status}`);
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
            throw new Error(`Spotify API error: ${response.status}`);
        }
    }
}
