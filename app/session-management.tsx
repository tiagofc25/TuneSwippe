import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/Colors';
import { SpotifyButton } from '../components/SpotifyButton';

export default function SessionManagementScreen() {
    const router = useRouter();
    const { user, setSessionId, setRoomCode } = useAuth();

    const [mode, setMode] = useState<'root' | 'create' | 'join'>('root');
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            console.log('[SESSION] Room créée:', code);
            router.push('/playlist-select');
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
            <SpotifyButton
                onPress={() => setMode('create')}
                label="Créer une Room"
                style={styles.menuBtn}
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
            <SpotifyButton
                onPress={handleCreateRoom}
                label="Générer le code"
                isLoading={loading}
            />
            <TouchableOpacity onPress={() => setMode('root')} style={styles.backBtn}>
                <Text style={styles.backBtnText}>Retour</Text>
            </TouchableOpacity>
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
            <SpotifyButton
                onPress={handleJoinRoom}
                label="Rejoindre"
                isLoading={loading}
                disabled={inputValue.length < 6}
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
    errorText: {
        color: Colors.swipeLeft,
        marginTop: 20,
        textAlign: 'center',
    },
});
