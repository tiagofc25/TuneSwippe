import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  createSharedPlaylist as createSpotifyPlaylist,
  addTracksToPlaylist as addSpotifyTracks,
} from "../services/spotify";
import { MusicTrack } from "../services/musicTypes";
import { Colors } from "../constants/Colors";
import { MusicButton } from "../components/MusicButton";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function MatchesScreen() {
  const router = useRouter();
  const {
    accessToken,
    user,
    sessionId,
    mySelectedPlaylist,
    partnerPlaylistId,
  } = useAuth();

  const [matches, setMatches] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportedId, setExportedId] = useState<string | null>(null);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const pulseStyle = useMemo(() => {
    const scale = pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.06],
    });
    return { transform: [{ scale }] };
  }, [pulse]);

  useEffect(() => {
    if (!sessionId || !accessToken || !user) {
      router.replace("/session-management");
      return;
    }

    fetchMatches();

    // Écouter les nouveaux swipes en temps réel pour mettre à jour les matchs automatiquement
    const channel = supabase
      .channel(`swipes-matches-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "swipes",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          console.log(
            "[MATCHES] Nouveau swipe détecté en temps réel:",
            payload.new
          );
          // Re-calculer les matchs à chaque nouveau swipe "right"
          if (payload.new.direction === "right") {
            fetchMatches();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      // 1. Récupérer les tracks des deux playlists depuis Supabase (pas d'appel Spotify)
      const { data: session, error: sessionErr } = await supabase
        .from("sessions")
        .select("user1_id, user1_tracks, user2_tracks")
        .eq("id", sessionId)
        .single();

      if (sessionErr || !session) throw sessionErr;

      const allPossibleTracks: MusicTrack[] = [
        ...((session.user1_tracks as MusicTrack[]) || []),
        ...((session.user2_tracks as MusicTrack[]) || []),
      ];

      // 2. Récupérer tous les swipes "right" de la session
      const { data: swipes, error } = await supabase
        .from("swipes")
        .select("*")
        .eq("session_id", sessionId)
        .eq("direction", "right");

      if (error) throw error;

      // 3. Trouver les track_ids swipés par les 2 utilisateurs différents
      const trackGroups: { [key: string]: string[] } = {};
      swipes?.forEach((s) => {
        if (!trackGroups[s.track_id]) trackGroups[s.track_id] = [];
        trackGroups[s.track_id].push(s.user_id);
      });

      const matchedIds = Object.keys(trackGroups).filter((tid) => {
        const users = new Set(trackGroups[tid]);
        return users.size >= 2;
      });

      if (matchedIds.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      // 4. Retrouver les détails des tracks depuis les données Supabase
      const uniqueMatchedTracks = matchedIds
        .map((id) => allPossibleTracks.find((t) => t.id === id))
        .filter(Boolean) as MusicTrack[];

      setMatches(uniqueMatchedTracks);
    } catch (err) {
      console.error("[FETCH_MATCHES_ERR]", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!accessToken || !user || matches.length === 0) return;

    setExporting(true);
    try {
      const playlistName = `TuneSwippe Matchs`;

      const newPlaylist = await createSpotifyPlaylist(
        accessToken,
        user.id,
        playlistName
      );
      const trackUris = matches.map((t) => (t as any).uri || "");
      await addSpotifyTracks(accessToken, newPlaylist.id, trackUris);
      setExportedId(newPlaylist.id);
      Alert.alert("Succès !", "Ta playlist de matchs a été créée sur Spotify.");
    } catch (err) {
      console.error("[EXPORT_ERR]", err);
      Alert.alert("Erreur", "Impossible de créer la playlist Spotify.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.spotifyGreen} size="large" />
        <Text style={styles.loadingText}>
          Calcul des coups de cœur communs...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "Vos Matchs",
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: "#FFF",
          headerShadowVisible: false,
        }}
      />

      <LinearGradient
        colors={[
          "rgba(29,185,84,0.06)",
          "rgba(0,0,0,0)",
          "rgba(255,255,255,0.04)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.header}>
        <Text style={styles.matchCount}>
          {matches.length} morceau{matches.length > 1 ? "x" : ""} matché
          {matches.length > 1 ? "s" : ""} !
        </Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.trackItem}>
            {item.album?.images?.[0]?.url || (item as any).images?.[0]?.url ? (
              <Image
                source={{
                  uri:
                    item.album?.images?.[0]?.url ||
                    (item as any).images?.[0]?.url,
                }}
                style={styles.albumArt}
              />
            ) : (
              <LinearGradient
                colors={["rgba(29,185,84,0.35)", "rgba(255,255,255,0.06)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.albumArt, styles.albumFallback]}
              >
                <Ionicons
                  name="musical-notes"
                  size={18}
                  color="rgba(255,255,255,0.92)"
                />
              </LinearGradient>
            )}
            <View style={styles.trackInfo}>
              <Text style={styles.trackName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.artistName} numberOfLines={1}>
                {item.artists.map((a) => a.name).join(", ")}
              </Text>
            </View>
            <Animated.View style={[styles.matchBadge, pulseStyle]}>
              <MaterialCommunityIcons
                name="fire"
                size={18}
                color={Colors.accentPink}
              />
            </Animated.View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="heart-dislike"
                size={30}
                color="rgba(255,255,255,0.90)"
              />
            </View>
            <Text style={styles.emptyTitle}>Pas encore de match</Text>
            <Text style={styles.emptyText}>
              Swippez tous les deux à droite sur les mêmes morceaux pour les
              voir ici !
            </Text>
            <MusicButton
              onPress={() => router.back()}
              label="Continuer à swiper"
              style={{ marginTop: 20 }}
              variant={"spotify"}
            />
          </View>
        }
      />

      {matches.length > 0 && (
        <View style={styles.footer}>
          <MusicButton
            onPress={handleExport}
            label={exportedId ? "Matchs exportés !" : "Exporter vers Spotify"}
            isLoading={exporting}
            disabled={!!exportedId}
            variant={"spotify"}
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
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  header: {
    padding: 24,
    paddingTop: 0,
  },
  matchCount: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.spotifyGreen,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  albumFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  trackInfo: {
    marginLeft: 16,
    flex: 1,
  },
  trackName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  artistName: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  matchBadge: {
    marginLeft: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,107,138,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,107,138,0.22)",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 34,
    backgroundColor: "rgba(13,13,13,0.78)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
});
