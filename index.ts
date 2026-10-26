// Order matters: patch globals and install the crash screen before any route loads.
import './src/polyfills';
import './src/ui/CrashGuard';
import 'expo-router/entry';
