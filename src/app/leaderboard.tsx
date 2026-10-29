import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { track } from '../analytics/analytics';
import { progress, totalPoints, useProgress } from '../game/progress';
import {
  fetchTop,
  leaderboardConfigured,
  MAX_NAME_LENGTH,
  myPlayerId,
  rankOf,
  submitScore,
  type LeaderboardEntry,
} from '../leaderboard/leaderboard';
import { nameProblem, type NameProblem } from '../leaderboard/nameFilter';
import { MenuButton, MenuScreen } from '../ui/components/MenuKit';
import { FONT, INK } from '../ui/theme';

/** Global leaderboard: your total and rank, then the top 50 players. */
export default function Leaderboard() {
  const state = useProgress();
  const total = totalPoints(state);

  if (!leaderboardConfigured) {
    return (
      <MenuScreen title="Leaderboard">
        <Text style={styles.note}>The global leaderboard isn’t switched on yet. Your points are still being counted.</Text>
        <YourPoints total={total} rank={null} />
      </MenuScreen>
    );
  }
  if (!state.playerName) return <PickName />;
  return <Board total={total} name={state.playerName} />;
}

const NAME_HINTS: Record<NameProblem, string> = {
  short: 'At least 2 characters.',
  blocked: 'Please choose a different name.',
  contact: 'No emails, links or phone numbers, please.',
};

function PickName() {
  const [name, setName] = useState('');
  const problem = nameProblem(name);
  const valid = problem === null;
  return (
    <MenuScreen title="Leaderboard">
      <Text style={styles.lead}>Pick a name to show next to your points on the global leaderboard.</Text>
      <TextInput
        value={name}
        onChangeText={(t) => setName(t.slice(0, MAX_NAME_LENGTH))}
        placeholder="Your name"
        placeholderTextColor={INK.inkSoft}
        style={styles.input}
        autoFocus
        returnKeyType="done"
        accessibilityLabel="Leaderboard name"
      />
      <MenuButton
        variant="primary"
        icon="trophy-outline"
        label="Join the leaderboard"
        onPress={() => {
          if (!valid) return;
          progress.setPlayerName(name.trim());
          track('leaderboard_join');
          submitScore();
        }}
      />
      {problem && name.length > 0 ? <Text style={styles.hint}>{NAME_HINTS[problem]}</Text> : null}
    </MenuScreen>
  );
}

function Board({ total, name }: { total: number; name: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setEntries(null);
    try {
      // Publish first so the list and rank include the latest total.
      await submitScore();
      const [top, r, uid] = await Promise.all([fetchTop(50), rankOf(total), myPlayerId()]);
      setEntries(top);
      setRank(r);
      setMe(uid);
    } catch {
      setError(true);
    }
  }, [total]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching the board on open is the point of this screen
    load();
  }, [load]);

  return (
    <MenuScreen title="Leaderboard">
      <YourPoints total={total} rank={rank} name={name} />

      {error ? (
        <View style={styles.center}>
          <Text style={styles.note}>Couldn’t load the leaderboard. Check your connection.</Text>
          <MenuButton icon="refresh" label="Try again" onPress={load} />
        </View>
      ) : entries === null ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={INK.ink} />
      ) : entries.length === 0 ? (
        <Text style={styles.note}>No scores yet — solve a level to be the first.</Text>
      ) : (
        <View style={styles.list}>
          {entries.map((e, i) => (
            <Row key={e.uid} rank={i + 1} entry={e} mine={e.uid === me} />
          ))}
        </View>
      )}
    </MenuScreen>
  );
}

function YourPoints({ total, rank, name }: { total: number; rank: number | null; name?: string }) {
  return (
    <View style={styles.mine}>
      <Ionicons name="trophy" size={26} color={INK.brass} />
      <View style={{ flex: 1 }}>
        <Text style={styles.mineLabel}>{name ?? 'Your points'}</Text>
        <Text style={styles.mineTotal}>{total.toLocaleString()} pts</Text>
      </View>
      {rank !== null ? <Text style={styles.mineRank}>#{rank}</Text> : null}
    </View>
  );
}

const MEDALS = ['#d4a72c', '#a8a9ad', '#b0703c'];

function Row({ rank, entry, mine }: { rank: number; entry: LeaderboardEntry; mine: boolean }) {
  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      <Text style={[styles.rank, rank <= 3 && { color: MEDALS[rank - 1] }]}>{rank}</Text>
      <Text style={[styles.name, mine && styles.nameMine]} numberOfLines={1}>
        {entry.name}
        {mine ? ' (you)' : ''}
      </Text>
      <Text style={[styles.points, mine && styles.nameMine]}>{entry.total.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: FONT.body, fontSize: 15, lineHeight: 21, color: INK.inkSoft, marginBottom: 12 },
  note: { fontFamily: FONT.bodyItalic, fontSize: 14, color: INK.inkSoft, textAlign: 'center', marginVertical: 18 },
  hint: { fontFamily: FONT.body, fontSize: 13, color: INK.inkSoft, marginTop: 8 },
  center: { gap: 8 },
  input: {
    marginBottom: 12,
    height: 48,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: INK.ink,
    paddingHorizontal: 14,
    fontFamily: FONT.label,
    fontSize: 16,
    color: INK.ink,
    backgroundColor: 'rgba(239,228,204,0.45)',
  },
  mine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 4,
    backgroundColor: INK.ink,
    marginBottom: 16,
  },
  mineLabel: { fontFamily: FONT.body, fontSize: 13, color: 'rgba(239,228,204,0.75)' },
  mineTotal: { fontFamily: FONT.numeral, fontSize: 24, color: INK.paper, fontVariant: ['tabular-nums'] },
  mineRank: { fontFamily: FONT.numeral, fontSize: 26, color: INK.bulbLit },
  list: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 3,
    backgroundColor: 'rgba(239,228,204,0.45)',
  },
  rowMine: { backgroundColor: INK.paper, borderWidth: 1.5, borderColor: INK.brass },
  rank: { width: 30, fontFamily: FONT.numeral, fontSize: 17, color: INK.inkSoft, fontVariant: ['tabular-nums'] },
  name: { flex: 1, fontFamily: FONT.label, fontSize: 16, color: INK.ink },
  nameMine: { color: INK.ink, fontFamily: FONT.numeral },
  points: { fontFamily: FONT.numeral, fontSize: 16, color: INK.ink, fontVariant: ['tabular-nums'] },
});
