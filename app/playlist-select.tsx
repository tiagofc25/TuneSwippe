import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useAuthProtection } from "../hooks/useAuthProtection";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth";
import {
  getUserPlaylists,
  getPlaylistTracks,
} from "../services/spotifyService";
import { MusicPlaylist } from "../services/musicTypes";
import { PlaylistCard } from "../components/PlaylistCard";
import { Colors } from "../constants/Colors";
import { SpotifyButton } from "../components/SpotifyButton";
import { supabase } from "../lib/supabase";
import { Feather } from "@expo/vector-icons";

export default function PlaylistSelectScreen() {
  const router = useRouter();
  useAuthProtection();
  const {
    accessToken,
    user,
    setMySelectedPlaylist,
    mySelectedPlaylist,
    sessionId,
  } = useAuth();

  const { getValidToken, isLoading: isAuthLoading } = useSpotifyAuth();

  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch playlists ──────────────────────────────────────────────────────

  useEffect(() => {
    // Attendre que l'authentification soit complète avant de charger les playlists
    if (isAuthLoading) return;

    (async () => {
      try {
        // Priorité au token global (évite les soucis d'instances multiples de useSpotifyAuth)
        const tokenProvider = async () => accessToken ?? (await getValidToken());
        const data = await getUserPlaylists(tokenProvider, 50);
        setPlaylists(data);
      } catch (err) {
        setError("Impossible de récupérer vos playlists");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isAuthLoading, accessToken, getValidToken]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleSelect = (playlist: MusicPlaylist) => {
    setMySelectedPlaylist(playlist);
  };

  const handleContinue = async () => {
    if (!mySelectedPlaylist || !sessionId || !user) return;

    setIsSaving(true);
    setError(null);

    try {
      // Diagnostic: si le propriétaire réel de la playlist ne correspond pas au compte connecté,
      // Spotify peut refuser l'accès aux tracks même si la playlist semble visible.
      if (
        mySelectedPlaylist.ownerId &&
        mySelectedPlaylist.ownerId !== user.id
      ) {
        throw new Error(
          `PLAYLIST_OWNER_MISMATCH: owner=${mySelectedPlaylist.ownerId} me=${user.id}`
        );
      }

      console.log(
        "[PLAYLIST-SELECT] ownerId/me:",
        mySelectedPlaylist.ownerId ?? "(unknown)",
        "/",
        user.id
      );

      // 1. Fetch les tracks de MA propre playlist avec MON token (via getValidToken)
      console.log("[PLAYLIST-SELECT] Fetching own playlist tracks...");
      const tokenProvider = async () => accessToken ?? (await getValidToken());
      const tracks = await getPlaylistTracks(
        mySelectedPlaylist.id,
        tokenProvider,
        50
      );

      // 2. Déterminer si on est l'hôte (user1) ou l'invité (user2)
      const { data: session, error: fetchErr } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (fetchErr) throw fetchErr;

      const isHost = session.user1_id === user.id;
      const updateData = isHost
        ? { user1_playlist_id: mySelectedPlaylist.id, user1_tracks: tracks }
        : { user2_playlist_id: mySelectedPlaylist.id, user2_tracks: tracks };

      // 3. Stocker l'ID ET les tracks sérialisées dans Supabase
      const { error: updateErr } = await supabase
        .from("sessions")
        .update(updateData)
        .eq("id", sessionId);

      if (updateErr) throw updateErr;

      console.log(
        "[SESSION] Playlist + tracks enregistrées:",
        mySelectedPlaylist.name,
        `(${tracks.length} tracks)`
      );
      router.push("/swipe");
    } catch (err) {
      console.error(err);
      const anyErr = err as any;
      if (
        anyErr?.code === "PGRST204" &&
        typeof anyErr?.message === "string" &&
        anyErr.message.includes("user1_tracks")
      ) {
        setError(
          "Ton Supabase n'a pas les colonnes `user1_tracks` / `user2_tracks` dans la table `sessions`.\n\n" +
            "Fix: exécute ce SQL dans Supabase (SQL Editor):\n" +
            "ALTER TABLE sessions\n" +
            "  ADD COLUMN IF NOT EXISTS user1_tracks JSONB,\n" +
            "  ADD COLUMN IF NOT EXISTS user2_tracks JSONB;"
        );
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("PLAYLIST_OWNER_MISMATCH")) {
        setError(
          "Tu es connecté à un autre compte Spotify que le propriétaire de cette playlist.\n\n" +
            "Solution: reconnecte-toi avec le bon compte (celui qui possède la playlist)."
        );
      } else if (message.includes("PLAYLIST_UNSUPPORTED_ITEMS")) {
        setError(
          "Cette playlist contient des morceaux que Spotify n’expose pas via l’API (souvent des « Local Files »).\n\n" +
            "Solution: choisis une playlist composée de morceaux Spotify (pas locaux), ou enlève les fichiers locaux de la playlist."
        );
      } else if (message.includes("PLAYLIST_EMPTY")) {
        setError(
          "Cette playlist semble vide côté Spotify API (0 morceau).\n\n" +
            "Vérifie qu'elle contient bien des morceaux Spotify (pas uniquement locaux) et que tu es connecté au bon compte."
        );
      } else if (message.includes("PLAYLIST_NO_SWIPABLE_ITEMS")) {
        const details = message.split(":").slice(1).join(":");
        setError(
          "Impossible de récupérer des morceaux « swipables » depuis Spotify pour cette playlist.\n\n" +
            "Souvent: playlist vide côté API, ou composée de contenus non exposés (Local Files).\n" +
            (details ? `\nDétail: ${details}` : "")
        );
      } else if (message.includes("403_FORBIDDEN")) {
        const details = message.includes(":") ? message.split(":").slice(1).join(":") : "";
        setError(
          "Spotify refuse l’accès à cette playlist (403).\n\n" +
            "Causes fréquentes :\n" +
            "• Autorisation Spotify sans les bons scopes → reconnecte-toi\n" +
            "• App Spotify en mode Développement → ajoute ton compte en « test user » dans le Dashboard\n"
            + (details ? `\nDétail Spotify: ${details}` : "")
        );
      } else if (message.includes("401_UNAUTHORIZED")) {
        setError("Session Spotify expirée. Reconnecte-toi.");
      } else {
        setError("Erreur lors de l'enregistrement du choix");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Renders ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "Choisir une playlist",
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Tes Playlists</Text>
        <Text style={styles.subtitle}>
          Sélectionne la playlist dont tu veux swiper les morceaux.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.spotifyGreen} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorRow}>
            <Feather name="alert-triangle" size={16} color={Colors.swipeLeft} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <SpotifyButton
            onPress={() => router.replace("/")}
            label="Réessayer la connexion"
            style={{ marginTop: 20 }}
          />
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <PlaylistCard
              playlist={item}
              isSelected={mySelectedPlaylist?.id === item.id}
              onSelect={handleSelect}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                Aucune playlist trouvée.{"\n\n"}
                Crée une playlist dans Spotify pour pouvoir l'utiliser ici.
              </Text>
            </View>
          }
        />
      )}

      {/* Footer sticky */}
      {mySelectedPlaylist && (
        <View style={styles.footer}>
          <SpotifyButton
            onPress={handleContinue}
            isLoading={isSaving}
            label={`Utiliser "${mySelectedPlaylist.name.slice(0, 15)}${
              mySelectedPlaylist.name.length > 15 ? "..." : ""
            }"`}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Espace pour le footer bouton
  },
  separator: {
    height: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  errorText: {
    color: Colors.swipeLeft,
    textAlign: "center",
    fontWeight: "700",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 34,
    backgroundColor: "rgba(13, 13, 13, 0.9)", // fond flouté/transparent
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
