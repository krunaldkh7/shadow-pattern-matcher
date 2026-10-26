import { Component, useEffect, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Test-build safety net: instead of closing the app on a JavaScript error,
 * show the error on screen so it can be screenshotted and fixed.
 *
 * Catches both render errors (ErrorBoundary) and errors thrown anywhere else,
 * e.g. inside the 3D frame loop or a gesture callback (global handler).
 */

type Listener = (e: Error) => void;
const listeners = new Set<Listener>();
let firstError: Error | null = null;

function report(e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e));
  if (!firstError) firstError = err;
  listeners.forEach((l) => l(err));
}

// Install once, at import time, before anything else runs.
const g = globalThis as unknown as {
  ErrorUtils?: { getGlobalHandler: () => unknown; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void };
};
if (g.ErrorUtils) {
  const previous = g.ErrorUtils.getGlobalHandler() as ((e: unknown, fatal?: boolean) => void) | undefined;
  g.ErrorUtils.setGlobalHandler((e: unknown, fatal?: boolean) => {
    report(e);
    // In development keep the default red-box so startup errors aren't hidden.
    if (__DEV__) previous?.(e, fatal);
  });
}

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    report(error);
  }
  render() {
    return this.state.error ? <CrashScreen error={this.state.error} /> : this.props.children;
  }
}

function CrashScreen({ error }: { error: Error }) {
  const stack = (error.stack ?? '').split('\n').slice(0, 14).join('\n');
  return (
    <View style={styles.root}>
      <Text style={styles.title}>The game hit an error</Text>
      <Text style={styles.sub}>Take a screenshot of this screen and send it to fix the problem.</Text>
      <ScrollView style={styles.box} contentContainerStyle={{ padding: 14 }}>
        <Text selectable style={styles.message}>
          {error.name}: {error.message}
        </Text>
        <Text selectable style={styles.stack}>
          {stack}
        </Text>
        <Text style={styles.meta}>
          {Platform.OS} {String(Platform.Version)}
        </Text>
      </ScrollView>
    </View>
  );
}

export function CrashGuard({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(firstError);
  useEffect(() => {
    const l: Listener = (e) => setError((prev) => prev ?? e);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (error) return <CrashScreen error={error} />;
  return <Boundary>{children}</Boundary>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efe4cc', paddingTop: 64, paddingHorizontal: 20, paddingBottom: 30 },
  title: { fontSize: 22, fontWeight: '700', color: '#3b2b20' },
  sub: { fontSize: 15, color: 'rgba(59,43,32,0.7)', marginTop: 6, marginBottom: 16 },
  box: { flex: 1, backgroundColor: '#fff8ea', borderRadius: 6, borderWidth: 1, borderColor: '#d9c9a8' },
  message: { fontSize: 15, fontWeight: '700', color: '#7a1f12', marginBottom: 10 },
  stack: { fontSize: 11, color: '#3b2b20', fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo' }) },
  meta: { fontSize: 11, color: 'rgba(59,43,32,0.6)', marginTop: 10 },
});
