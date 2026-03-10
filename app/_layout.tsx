import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { AuthProvider } from '../context/AuthContext';

import * as AuthSession from 'expo-auth-session';

// --- LOG DEBUG POUR LE DASHBOARD SPOTIFY ---
const debugRedirectUri = AuthSession.makeRedirectUri({
    scheme: 'tuneswippe',
    path: 'callback',
});
console.log('********************************************');
console.log('VOTRE REDIRECT URI A COPIER DANS SPOTIFY :');
console.log(debugRedirectUri);
console.log('********************************************');

export default function RootLayout() {
    return (
        <AuthProvider>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Colors.background },
                    animation: 'fade',
                }}
            />
        </AuthProvider>
    );
}
