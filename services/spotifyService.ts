import { MusicUser, MusicPlaylist, MusicTrack } from './musicTypes';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// ─── Profil utilisateur ─────────────────────────────────────────────────────

export async function getUserProfile(
  getValidToken: () => Promise<string | null>
): Promise<MusicUser> {
  const token = await getValidToken();
  if (!token) throw new Error('No valid token');

  const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[SPOTIFY_PROFILE_ERROR] ${response.status} - ${errorBody}`);
    throw new Error(`Spotify API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    display_name: data.display_name,
    email: data.email,
    images: data.images || [],
    country: data.country,
  };
}

// ─── Playlists de l'utilisateur ─────────────────────────────────────────────

export async function getUserPlaylists(
  getValidToken: () => Promise<string | null>,
  limit = 20
): Promise<MusicPlaylist[]> {
  const token = await getValidToken();
  if (!token) throw new Error('No valid token');

  if (token === 'mock-token') {
    return [
      {
        id: 'mock-p1',
        name: 'Ma Playlist Debug',
        description: 'Playlist de test pour le développement',
        images: [{ url: 'https://placehold.co/400x400/1DB954/white?text=Playlist+1' }],
        trackCount: 10,
        ownerName: 'Test User',
        isPublic: true,
      },
      {
        id: 'mock-p2',
        name: 'Mix Electro',
        description: 'Une autre playlist de test',
        images: [{ url: 'https://placehold.co/400x400/1DB954/white?text=Playlist+2' }],
        trackCount: 5,
        ownerName: 'Test User',
        isPublic: true,
      },
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
  return data.items
    .filter((item: any) => item !== null)
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      images: item.images || [],
      trackCount: item.tracks?.total || 0,
      ownerName: item.owner?.display_name || '',
      ownerId: item.owner?.id || undefined,
      isPublic: item.public ?? false,
    }));
}

// ─── Morceaux d'une playlist ────────────────────────────────────────────────

export async function getPlaylistTracks(
  playlistId: string,
  getValidToken: () => Promise<string | null>,
  limit = 50
): Promise<MusicTrack[]> {
  console.log('[TRACKS_DEBUG] ← fonction appelée avec playlistId:', playlistId);

  const token = await getValidToken();
  console.log('[TRACKS_DEBUG] token reçu:', token ? token.slice(0, 20) + '...' : 'NULL');
  if (!token) throw new Error('No valid token');

  if (token === 'mock-token') {
    return [
      {
        id: 'mock-t1',
        name: 'Debug Track 1',
        artists: [{ name: 'The Debuggers' }],
        album: {
          name: 'Testing Album',
          images: [{ url: 'https://placehold.co/400x400/1DB954/white?text=Track+1' }],
        },
        preview_url: null,
        duration_ms: 180000,
        uri: 'spotify:track:mock1',
      },
      {
        id: 'mock-t2',
        name: 'Awesome Song',
        artists: [{ name: 'Agent JS' }],
        album: {
          name: 'The Great Refactor',
          images: [{ url: 'https://placehold.co/400x400/1DB954/white?text=Track+2' }],
        },
        preview_url: null,
        duration_ms: 120000,
        uri: 'spotify:track:mock2',
      },
    ];
  }

  const url = `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=${limit}`;
  console.log('[TRACKS_DEBUG] URL appelée:', url);

  let spotifyResponse;
  try {
    spotifyResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[TRACKS_DEBUG] status HTTP:', spotifyResponse.status);
  } catch (networkErr) {
    console.error('[TRACKS_DEBUG] ← FETCH A THROW (erreur réseau):', networkErr);
    throw networkErr;
  }

  if (!spotifyResponse.ok) {
    const errorBodyText = await spotifyResponse.text();
    let spotifyMessage: string | null = null;
    try {
      const parsed = JSON.parse(errorBodyText);
      spotifyMessage =
        parsed?.error?.message ||
        parsed?.message ||
        (typeof parsed === 'string' ? parsed : null);
    } catch {
      // ignore JSON parse failures
    }

    if (spotifyResponse.status === 403) {
      try {
        const playlistUrl =
          `${SPOTIFY_API_BASE}/playlists/${playlistId}` +
          `?fields=tracks.items(track(id,name,artists(name),album(name,images),preview_url,duration_ms,uri))`;
        const playlistResp = await fetch(playlistUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (playlistResp.ok) {
          const pdata = await playlistResp.json();
          const items = (pdata?.tracks?.items as any[]) || [];
          return items
            .filter((item) => item?.track?.id || item?.track?.uri)
            .map((item) => {
              const track = item.track;
              const stableId = track.id || track.uri;
              return {
                id: stableId,
                name: track.name,
                artists: track.artists || [],
                album: {
                  name: track.album?.name || '',
                  images: track.album?.images || [],
                },
                preview_url: track.preview_url || null,
                duration_ms: track.duration_ms || 0,
                uri: track.uri,
              };
            });
        } else {
          const pErr = await playlistResp.text();
          console.error(`[SPOTIFY_PLAYLIST_FALLBACK_ERROR] ${playlistResp.status} - ${pErr}`);
        }
      } catch (fallbackErr) {
        console.error('[SPOTIFY_PLAYLIST_FALLBACK_ERROR]', fallbackErr);
      }
      throw new Error(`403_FORBIDDEN:${spotifyMessage ?? errorBodyText}`);
    }

    if (spotifyResponse.status === 401) {
      throw new Error('401_UNAUTHORIZED');
    }

    throw new Error(`Spotify API error: ${spotifyResponse.status} - ${errorBodyText}`);
  }

  const data = await spotifyResponse.json();
  const rawItems = (data.items as any[]) || [];
  const total = typeof data?.total === 'number' ? data.total : null;

  const localCount = rawItems.filter((it) => it?.is_local === true).length;
  const nullTrackCount = rawItems.filter((it) => !it?.track).length;

  console.log(
    `[TRACKS_DEBUG] id=${playlistId} total=${total ?? 'unknown'} rawItems=${rawItems.length} local=${localCount} nullTrack=${nullTrackCount}`
  );

  const mapped = rawItems
    .filter((item) => item?.track?.id || item?.track?.uri)
    .map((item) => {
      const t = item.track;
      const stableId = t.id || t.uri;
      return {
        id: stableId,
        name: t.name,
        artists: t.artists || [],
        album: {
          name: t.album?.name || '',
          images: t.album?.images || [],
        },
        preview_url: t.preview_url || null,
        duration_ms: t.duration_ms || 0,
        uri: t.uri,
      };
    });

  console.log(`[TRACKS_DEBUG] mapped=${mapped.length} tracks pour playlist="${playlistId}"`);

  if (mapped.length === 0 && rawItems.length > 0) {
    throw new Error(
      `PLAYLIST_UNSUPPORTED_ITEMS:items=${rawItems.length},local=${localCount},trackNull=${nullTrackCount}`
    );
  }

  if (mapped.length === 0) {
    if (total === 0) {
      throw new Error('PLAYLIST_EMPTY');
    }
    throw new Error(
      `PLAYLIST_NO_SWIPABLE_ITEMS:total=${total ?? 'unknown'},items=${rawItems.length},local=${localCount},trackNull=${nullTrackCount}`
    );
  }

  return mapped;
}

// ─── Créer une playlist partagée ────────────────────────────────────────────

export async function createSharedPlaylist(
  userId: string,
  name: string,
  getValidToken: () => Promise<string | null>
): Promise<MusicPlaylist> {
  const token = await getValidToken();
  if (!token) throw new Error('No valid token');

  const response = await fetch(`${SPOTIFY_API_BASE}/users/${userId}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description: 'Créé par TuneSwippe – Vos coups de cœur communs',
      public: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[SPOTIFY_CREATE_PLAYLIST_ERROR] ${response.status} - ${errorBody}`);
    throw new Error(`Spotify API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    images: data.images || [],
    trackCount: data.tracks?.total || 0,
    ownerName: data.owner?.display_name || '',
    isPublic: data.public ?? false,
  };
}

// ─── Ajouter des morceaux à une playlist ────────────────────────────────────

export async function addTracksToPlaylist(
  playlistId: string,
  trackUris: string[],
  getValidToken: () => Promise<string | null>
): Promise<void> {
  const token = await getValidToken();
  if (!token) throw new Error('No valid token');

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