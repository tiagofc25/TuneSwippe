export interface MusicUser {
    id: string;
    display_name: string;
    email?: string;
    images: { url: string }[];
    country?: string;
}

export interface MusicPlaylist {
    id: string;
    name: string;
    description?: string;
    images: { url: string }[];
    trackCount: number;
    ownerName: string;
    ownerId?: string;
    isPublic: boolean;
}

export interface MusicTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album: {
        name: string;
        images: { url: string; width?: number; height?: number }[];
    };
    preview_url: string | null;
    duration_ms: number;
    uri: string;
}
