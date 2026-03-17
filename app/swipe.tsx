import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  TouchableOpacity,
  Pressable,
  Animated,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import Swiper from "react-native-deck-swiper";
import { useAuth } from "../context/AuthContext";
import { useAuthProtection } from "../hooks/useAuthProtection";
import { MusicTrack } from "../services/musicTypes";
import { TrackCard } from "../components/TrackCard";
import { Colors } from "../constants/Colors";
import { MusicButton } from "../components/MusicButton";
import { supabase } from "../lib/supabase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function SwipeScreen() {
  const router = useRouter();
  useAuthProtection();
  const {
    accessToken,
    user,
    sessionId,
    setPartnerPlaylistId,
    partnerPlaylistId,
  } = useAuth();

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const [index, setIndex] = useState(0);
  const swiperRef = useRef<Swiper<MusicTrack> | null>(null);

  const flameAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(flameAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flameAnim]);

  const flameStyle = useMemo(() => {
    const scale = flameAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.08],
    });
    const opacity = flameAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.85, 1],
    });
    return { transform: [{ scale }], opacity };
  }, [flameAnim]);

  // Refs pour éviter les problèmes de closure stale dans les callbacks Realtime
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // ─── Phase 1: Vérifier que le partenaire a aussi choisi sa playlist ───────

  useEffect(() => {
    if (!accessToken || !sessionId || !user) {
      router.replace("/session-management");
      return;
    }

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const checkPartnerReady = async () => {
      if (accessToken === "mock-token") {
        setTracks([
          {
            id: "mock-t1",
            name: "Debug Track 1",
            artists: [{ name: "The Debuggers" }],
            album: {
              name: "Testing Album",
              images: [
                {
                  url: "https://placehold.co/400x400/1DB954/white?text=Track+1",
                },
              ],
            },
            preview_url: null,
            duration_ms: 180000,
            uri: "spotify:track:mock1",
          },
          {
            id: "mock-t2",
            name: "Awesome Song",
            artists: [{ name: "Agent JS" }],
            album: {
              name: "The Great Refactor",
              images: [
                {
                  url: "https://placehold.co/400x400/1DB954/white?text=Track+2",
                },
              ],
            },
            preview_url: null,
            duration_ms: 120000,
            uri: "spotify:track:mock2",
          },
        ]);
        setWaitingForPartner(false);
        setLoading(false);
        return true;
      }

      const { data: session, error } = await supabase
        .from("sessions")
        .select("user1_id, user1_tracks, user2_tracks")
        .eq("id", sessionId)
        .single();

      if (error || !session) {
        console.error("[SWIPE] Session fetch error:", error);
        return false;
      }

      const currentUser = userRef.current;
      if (!currentUser) return false;

      const isHost = session.user1_id === currentUser.id;
      // Chaque user swipe SES PROPRES tracks
      const myTracks: MusicTrack[] | null = isHost
        ? session.user1_tracks
        : session.user2_tracks;

      console.log(
        "[SWIPE] Am I host?",
        isHost,
        "| My tracks ready?",
        !!myTracks
      );

      if (myTracks && myTracks.length > 0 && isMounted) {
        setTracks(myTracks);
        setWaitingForPartner(false);
        setLoading(false);
        return true;
      } else if (isMounted) {
        setWaitingForPartner(true);
        return false;
      }
      return false;
    };

    // Première vérification
    checkPartnerReady().then((found) => {
      if (!found && isMounted) {
        pollingInterval = setInterval(async () => {
          console.log("[SWIPE] Polling for partner tracks...");
          const ready = await checkPartnerReady();
          if (ready && pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        }, 3000);
      }
    });

    // Écouter les changements en temps réel — dès que le partenaire sauvegarde ses tracks
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload: any) => {
          console.log("[SWIPE] Realtime update received");
          const session = payload.new;
          const currentUser = userRef.current;
          if (!currentUser) return;

          const isHost = session.user1_id === currentUser.id;
          const myTracks: MusicTrack[] | null = isHost
            ? session.user1_tracks
            : session.user2_tracks;

          if (myTracks && myTracks.length > 0 && isMounted) {
            setTracks(myTracks);
            setWaitingForPartner(false);
            setLoading(false);
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
          }
        }
      )
      .subscribe((status: string) => {
        console.log("[SWIPE] Realtime subscription status:", status);
      });

    return () => {
      isMounted = false;
      if (pollingInterval) clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [accessToken, sessionId]);

  // Phase 2 supprimée — les tracks viennent directement de Supabase (voir Phase 1)

  // ─── Swiper Handlers ───────────────────────────────────────────────────────

  const onSwiped = () => {
    setIndex((prev) => prev + 1);
  };

  const saveSwipe = async (track: MusicTrack, direction: "left" | "right") => {
    if (!sessionId || !user) return;

    try {
      const { error } = await supabase.from("swipes").insert([
        {
          session_id: sessionId,
          user_id: user.id,
          track_id: track.id,
          direction,
        },
      ]);
      if (error) throw error;
    } catch (err) {
      console.error("[SAVE_SWIPE]", err);
    }
  };

  const onSwipedLeft = (cardIndex: number) => {
    const track = tracks[cardIndex];
    if (track) saveSwipe(track, "left");
  };

  const onSwipedRight = (cardIndex: number) => {
    const track = tracks[cardIndex];
    if (track) saveSwipe(track, "right");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (waitingForPartner) {
    return (
      <View style={styles.centered}>
        <View style={styles.stateIcon}>
          <ActivityIndicator color={Colors.spotifyGreen} />
        </View>
        <Text style={styles.title}>En attente du partenaire...</Text>
        <Text style={styles.subtitle}>
          Ton partenaire n'a pas encore choisi sa playlist. Dès qu'il l'aura
          fait, tu pourras swiper !
        </Text>
        <View style={{ height: 10 }} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.spotifyGreen} size="large" />
        <Text style={styles.loadingText}>Chargement de ta playlist...</Text>
      </View>
    );
  }

  if (tracksError) {
    return (
      <View style={styles.centered}>
        <View style={[styles.stateIcon, styles.stateIconError]}>
          <FeatherIcon />
        </View>
        <Text style={styles.title}>Oups !</Text>
        <Text style={styles.subtitle}>{tracksError}</Text>
        <MusicButton
          onPress={() => router.replace("/playlist-select")}
          label="Choisir une autre playlist"
          style={{ marginTop: 24 }}
          variant={"spotify"}
        />
      </View>
    );
  }

  function FeatherIcon() {
    return <Ionicons name="alert-circle" size={26} color={Colors.swipeLeft} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

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
        <Text style={styles.playlistName}>Ta playlist</Text>
        <Text style={styles.countText}>
          {index + 1} / {tracks.length}
        </Text>
      </View>

      <View style={styles.swiperContainer}>
        {tracks.length > 0 && index < tracks.length ? (
          <Swiper
            ref={(r) => {
              swiperRef.current = r;
            }}
            cards={tracks}
            renderCard={(track) => <TrackCard track={track} />}
            onSwiped={onSwiped}
            onSwipedLeft={onSwipedLeft}
            onSwipedRight={onSwipedRight}
            cardIndex={index}
            backgroundColor={"transparent"}
            stackSize={3}
            stackSeparation={15}
            animateCardOpacity
            overlayLabels={{
              left: {
                title: "PAS FAN",
                style: {
                  label: {
                    backgroundColor: "rgba(0,0,0,0.35)",
                    borderColor: Colors.swipeLeft,
                    color: Colors.swipeLeft,
                    borderWidth: 3,
                    borderRadius: 14,
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    overflow: "hidden",
                  },
                  wrapper: {
                    flexDirection: "column",
                    alignItems: "flex-end",
                    justifyContent: "flex-start",
                    marginTop: 30,
                    marginLeft: -30,
                    transform: [{ rotate: "-14deg" }],
                  },
                },
              },
              right: {
                title: "COUP DE COEUR",
                style: {
                  label: {
                    backgroundColor: "rgba(0,0,0,0.35)",
                    borderColor: Colors.swipeRight,
                    color: Colors.swipeRight,
                    borderWidth: 3,
                    borderRadius: 14,
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    overflow: "hidden",
                  },
                  wrapper: {
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    marginTop: 30,
                    marginLeft: 30,
                    transform: [{ rotate: "14deg" }],
                  },
                },
              },
            }}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.stateIcon}>
              <Ionicons name="sparkles" size={26} color={Colors.spotifyGreen} />
            </View>
            <Text style={styles.emptyTitle}>C'est fini !</Text>
            <Text style={styles.emptyText}>
              Tu as swipé toutes tes musiques. Découvre maintenant vos coups de
              cœur communs !
            </Text>
            <MusicButton
              onPress={() => router.push("/matches")}
              label="Voir les matchs"
              style={{ marginTop: 24, width: "100%" }}
              variant={"spotify"}
            />
            <TouchableOpacity
              onPress={() => router.replace("/playlist-select")}
              style={{ marginTop: 16 }}
            >
              <Text style={{ color: Colors.textMuted }}>
                Choisir une autre playlist
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.matchFloatingBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => router.push("/matches")}
        >
          <Animated.View style={flameStyle}>
            <MaterialCommunityIcons
              name="fire"
              size={20}
              color={Colors.accentPink}
            />
          </Animated.View>
        </Pressable>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => swiperRef.current?.swipeLeft()}
            style={({ pressed }) => [
              styles.fab,
              styles.fabReject,
              pressed && styles.fabPressed,
            ]}
          >
            <Ionicons name="close" size={28} color={Colors.swipeLeft} />
          </Pressable>

          <Pressable
            onPress={() => swiperRef.current?.swipeRight()}
            style={({ pressed }) => [
              styles.fab,
              styles.fabLike,
              pressed && styles.fabPressed,
            ]}
          >
            <Ionicons name="heart" size={26} color={Colors.swipeRight} />
          </Pressable>
        </View>
      </View>
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
    padding: 40,
    gap: 16,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  stateIconError: {
    backgroundColor: "rgba(255,71,87,0.10)",
    borderColor: "rgba(255,71,87,0.25)",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playlistName: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  countText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  swiperContainer: {
    flex: 1,
    marginTop: -20,
  },
  footer: {
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(13,13,13,0.78)",
  },
  matchFloatingBtn: {
    position: "absolute",
    left: 18,
    top: -22,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  fab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  fabPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  fabReject: {
    backgroundColor: "rgba(255,71,87,0.10)",
    borderColor: "rgba(255,71,87,0.25)",
  },
  fabLike: {
    backgroundColor: "rgba(29,185,84,0.12)",
    borderColor: "rgba(29,185,84,0.28)",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
});
