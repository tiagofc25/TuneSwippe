import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/Colors';
import { MusicButton } from '../components/MusicButton';

export default function SessionManagementScreen() {
    const router = useRouter();
    const { user, setSessionId, setRoomCode, sessionId } = useAuth();

    const [mode, setMode] = useState<'root' | 'create' | 'join' | 'code-display'>('root');
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedCode, setGeneratedCode] = useState('');
    const [partnerJoined, setPartnerJoined] = useState(false);

    // ─── Realtime + Polling: écouter quand le partenaire rejoint la room ─────

    useEffect(() => {
        if (!sessionId || mode !== 'code-display') return;

        let isMounted = true;
        let pollingInterval: ReturnType<typeof setInterval> | null = null;

        const checkPartnerJoined = async () => {
            const { data: session, error: err } = await supabase
                .from('sessions')
                .select('user2_id')
                .eq('id', sessionId)
                .single();

            if (!err && session?.user2_id && isMounted) {
                setPartnerJoined(true);
                console.log('[SESSION] Partenaire a rejoint la room (polling) !');
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                }
                return true;
            }
            return false;
        };

        // Polling de secours toutes les 3 secondes
        pollingInterval = setInterval(() => {
            console.log('[SESSION] Polling for partner join...');
            checkPartnerJoined();
        }, 3000);

        // Écouter les changements en temps réel (Supabase Realtime)
        const channel = supabase
            .channel(`session-waiting-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                    filter: `id=eq.${sessionId}`,
                },
                (payload: any) => {
                    console.log('[SESSION] Realtime update:', payload.new);
                    if (payload.new.user2_id && isMounted) {
                        setPartnerJoined(true);
                        console.log('[SESSION] Partenaire a rejoint la room (realtime) !');
                        if (pollingInterval) {
                            clearInterval(pollingInterval);
                            pollingInterval = null;
                        }
                    }
                }
            )
            .subscribe((status: string) => {
                console.log('[SESSION] Realtime subscription status:', status);
            });

        return () => {
            isMounted = false;
            if (pollingInterval) clearInterval(pollingInterval);
            supabase.removeChannel(channel);
        };
    }, [sessionId, mode]);

    // ─── Actions ──────────────────────────────────────────────────────────────

    const generateCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    const handleCreateRoom = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);

        const code = generateCode();

        try {
            const { data, error: sbError } = await supabase
                .from('sessions')
                .insert([
                    {
                        code,
                        user1_id: user.id,
                        user1_display_name: user.display_name,
                        status: 'waiting'
                    }
                ])
                .select()
                .single();

            if (sbError) throw sbError;

            setSessionId(data.id);
            setRoomCode(code);
            setGeneratedCode(code);
            setMode('code-display');
            console.log('[SESSION] Room créée:', code);
        } catch (err) {
            setError("Erreur lors de la création de la room");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!user || !inputValue) return;
        setLoading(true);
        setError(null);

        try {
            // 1. Trouver la session par code
            const { data: session, error: findError } = await supabase
                .from('sessions')
                .select('*')
                .eq('code', inputValue.toUpperCase())
                .single();

            if (findError || !session) {
                throw new Error("Room introuvable");
            }

            if (session.user2_id && session.user2_id !== user.id) {
                throw new Error("Cette room est déjà complète");
            }

            // 2. Rejoindre
            const { error: updateError } = await supabase
                .from('sessions')
                .update({
                    user2_id: user.id,
                    user2_display_name: user.display_name
                })
                .eq('id', session.id);

            if (updateError) throw updateError;

            setSessionId(session.id);
            setRoomCode(session.code);
            console.log('[SESSION] Room rejointe:', session.code);
            router.push('/playlist-select');
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Erreur pour rejoindre";
            setError(msg);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // ─── Renders ──────────────────────────────────────────────────────────────

    const renderRoot = () => (
        <View style={styles.menu}>
            <MusicButton
                onPress={() => setMode('create')}
                label="Créer une Room"
                style={styles.menuBtn}
                variant="default"
            />
            <TouchableOpacity
                onPress={() => setMode('join')}
                style={styles.secondaryBtn}
            >
                <Text style={styles.secondaryBtnText}>Rejoindre une Room</Text>
            </TouchableOpacity>
        </View>
    );

    const renderCreate = () => (
        <View style={styles.form}>
            <Text style={styles.infoText}>
                Tu vas générer un code unique à partager avec ton partenaire.
            </Text>
            <MusicButton
                onPress={handleCreateRoom}
                label="Générer le code"
                isLoading={loading}
                variant="default"
            />
            <TouchableOpacity onPress={() => setMode('root')} style={styles.backBtn}>
                <Text style={styles.backBtnText}>Retour</Text>
            </TouchableOpacity>
        </View>
    );

    const renderCodeDisplay = () => (
        <View style={styles.form}>
            <Text style={styles.infoText}>
                Partage ce code avec ton partenaire pour qu'il rejoigne la room :
            </Text>
            <View style={styles.codeBox}>
                <Text style={styles.codeText}>{generatedCode}</Text>
            </View>
            <TouchableOpacity
                style={styles.copyBtn}
                onPress={async () => {
                    await Clipboard.setStringAsync(generatedCode);
                    Alert.alert('Copié !', 'Le code a été copié dans le presse-papier.');
                }}
            >
                <Text style={styles.copyBtnText}>📋 Copier le code</Text>
            </TouchableOpacity>

            {partnerJoined ? (
                <>
                    <Text style={styles.partnerJoinedText}>✅ Ton partenaire a rejoint la room !</Text>
                    <MusicButton
                        onPress={() => router.push('/playlist-select')}
                        label="Continuer →"
                        variant="default"
                    />
                </>
            ) : (
                <>
                    <ActivityIndicator color={Colors.spotifyGreen} style={{ marginTop: 8 }} />
                    <Text style={styles.waitingText}>En attente du partenaire...</Text>
                    <MusicButton
                        onPress={() => router.push('/playlist-select')}
                        label="Continuer sans attendre →"
                        variant="default"
                    />
                </>
            )}
        </View>
    );

    const renderJoin = () => (
        <View style={styles.form}>
            <Text style={styles.infoText}>
                Entre le code partagé par ton partenaire.
            </Text>
            <TextInput
                style={styles.input}
                placeholder="CODE (ex: XJ92LK)"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                value={inputValue}
                onChangeText={setInputValue}
                maxLength={6}
            />
            <MusicButton
                onPress={handleJoinRoom}
                label="Rejoindre"
                isLoading={loading}
                disabled={inputValue.length < 6}
                variant="default"
            />
            <TouchableOpacity onPress={() => setMode('root')} style={styles.backBtn}>
                <Text style={styles.backBtnText}>Retour</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <Stack.Screen options={{ headerShown: true, headerTitle: 'Room', headerTransparent: true, headerTintColor: '#FFF' }} />

            <View style={styles.content}>
                <Text style={styles.emoji}>🏠</Text>
                <Text style={styles.title}>Prêt à matcher ?</Text>

                {mode === 'root' && renderRoot()}
                {mode === 'create' && renderCreate()}
                {mode === 'join' && renderJoin()}
                {mode === 'code-display' && renderCodeDisplay()}

                {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 16,
    },
    emoji: { fontSize: 64, marginBottom: 8 },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: 24,
    },
    menu: {
        width: '100%',
        gap: 16,
    },
    menuBtn: { width: '100%' },
    secondaryBtn: {
        paddingVertical: 16,
        alignItems: 'center',
        borderRadius: 50,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    secondaryBtnText: {
        color: Colors.textPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    form: {
        width: '100%',
        alignItems: 'center',
        gap: 20,
    },
    infoText: {
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 10,
    },
    input: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 18,
        color: Colors.textPrimary,
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 4,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    backBtn: { marginTop: 10 },
    backBtnText: {
        color: Colors.textMuted,
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    codeBox: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        paddingVertical: 24,
        paddingHorizontal: 32,
        borderWidth: 2,
        borderColor: Colors.accent,
        width: '100%',
        alignItems: 'center',
    },
    codeText: {
        fontSize: 36,
        fontWeight: '900',
        color: Colors.accent,
        letterSpacing: 8,
    },
    copyBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    copyBtnText: {
        color: Colors.textPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    errorText: {
        color: Colors.swipeLeft,
        marginTop: 20,
        textAlign: 'center',
    },
    partnerJoinedText: {
        color: Colors.spotifyGreen,
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 8,
    },
    waitingText: {
        color: Colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
    },
});
