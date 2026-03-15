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
import {
  getUserPlaylists as getSpotifyPlaylists,
  getPlaylistTracks as getSpotifyTracks,
} from "../services/spotify";
import { MusicPlaylist } from "../services/musicTypes";
import { PlaylistCard } from "../components/PlaylistCard";
import { Colors } from "../constants/Colors";
import { SpotifyButton } from "../components/SpotifyButton";
import { supabase } from "../lib/supabase";
import { Feather } from "@expo/vector-icons";

export default function PlaylistSelectScreen() {
  const router = useRouter();
  const {
    accessToken,
    user,
    setMySelectedPlaylist,
    mySelectedPlaylist,
    sessionId,
  } = useAuth();

  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch playlists ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!accessToken) {
      router.replace("/");
      return;
    }

    (async () => {
      try {
        if (accessToken) {
          const data = await getSpotifyPlaylists(accessToken, 50);
          setPlaylists(data);
        }
      } catch (err) {
        setError("Impossible de récupérer vos playlists");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, router]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleSelect = (playlist: MusicPlaylist) => {
    setMySelectedPlaylist(playlist);
  };

  const handleContinue = async () => {
    if (!mySelectedPlaylist || !sessionId || !user || !accessToken) return;

    setIsSaving(true);
    setError(null);

    try {
      // 1. Fetch les tracks de MA propre playlist avec MON token
      console.log("[PLAYLIST-SELECT] Fetching own playlist tracks...");
      const tracks = await getSpotifyTracks(
        accessToken,
        mySelectedPlaylist.id,
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
      setError("Erreur lors de l'enregistrement du choix");
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
