import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import type { Auth, Persistence } from 'firebase/auth';
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  initializeFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { progress, totalPoints } from '../game/progress';

/**
 * Global leaderboard on Firebase (Firestore + anonymous auth). Each player
 * has one document, scores/{uid}, holding their name and total points. The
 * Firebase project comes from app.json → expo.extra.firebase; while that is
 * empty the leaderboard reports "not set up" and nothing touches the network.
 */

// @firebase/auth (unlike the firebase/auth wrapper) ships a React Native
// build with AsyncStorage persistence, so the anonymous player id survives
// restarts instead of creating a new leaderboard entry on every launch.
const firebaseAuth = require('@firebase/auth') as typeof import('firebase/auth') & {
  getReactNativePersistence: (storage: typeof ReactNativeAsyncStorage) => Persistence;
};

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

const config = (Constants.expoConfig?.extra as { firebase?: Partial<FirebaseConfig> } | undefined)?.firebase;

export const leaderboardConfigured = !!(config?.apiKey && config.projectId && config.appId);

export interface LeaderboardEntry {
  uid: string;
  name: string;
  total: number;
}

const COLLECTION = 'scores';
export const MAX_NAME_LENGTH = 20;

let services: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;
function firebase() {
  if (!leaderboardConfigured) return null;
  if (services) return services;
  const app = getApps()[0] ?? initializeApp(config as FirebaseConfig);
  const auth = firebaseAuth.initializeAuth(app, {
    persistence: firebaseAuth.getReactNativePersistence(ReactNativeAsyncStorage),
  });
  // Long-polling auto-detect keeps Firestore working on mobile networks that block streaming.
  const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  services = { app, auth, db };
  return services;
}

/** The player's anonymous Firebase user id, signing in on first use. */
async function playerId(): Promise<string | null> {
  const fb = firebase();
  if (!fb) return null;
  if (fb.auth.currentUser) return fb.auth.currentUser.uid;
  const cred = await firebaseAuth.signInAnonymously(fb.auth);
  return cred.user.uid;
}

export async function myPlayerId() {
  try {
    return await playerId();
  } catch {
    return null;
  }
}

/** Publish the player's current total. No-op until they've chosen a name. */
export async function submitScore() {
  const fb = firebase();
  const { playerName } = progress.get();
  if (!fb || !playerName) return;
  try {
    const uid = await playerId();
    if (!uid) return;
    await setDoc(doc(fb.db, COLLECTION, uid), {
      name: playerName.slice(0, MAX_NAME_LENGTH),
      total: totalPoints(progress.get()),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Offline or rejected: the next change (or opening the leaderboard) retries.
  }
}

export async function fetchTop(count = 50): Promise<LeaderboardEntry[]> {
  const fb = firebase();
  if (!fb) return [];
  const snap = await getDocs(query(collection(fb.db, COLLECTION), orderBy('total', 'desc'), limit(count)));
  return snap.docs.map((d) => ({ uid: d.id, name: String(d.get('name') ?? ''), total: Number(d.get('total') ?? 0) }));
}

/** 1-based rank of a total: everyone strictly above it, plus one. */
export async function rankOf(total: number): Promise<number | null> {
  const fb = firebase();
  if (!fb) return null;
  const snap = await getCountFromServer(query(collection(fb.db, COLLECTION), where('total', '>', total)));
  return snap.data().count + 1;
}

/**
 * Keep the leaderboard in step with progress: whenever the total changes,
 * publish it (debounced, so a burst of saves sends one write).
 */
export function startLeaderboardSync() {
  if (!leaderboardConfigured) return;
  let lastSent = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    const s = progress.get();
    const total = totalPoints(s);
    if (!s.playerName || total === lastSent) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      lastSent = total;
      submitScore();
    }, 1500);
  };
  progress.subscribe(check);
  check();
}
