# Global leaderboard — Firebase setup

The app's points and leaderboard screen are built in. The leaderboard stays
switched off ("isn't switched on yet") until the app is connected to a Firebase
project. This takes about 10 minutes and is free (Spark plan).

## 1. Create the project

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it (e.g. `shadow-pattern-matcher`). Google Analytics is optional.

## 2. Turn on anonymous sign-in

**Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**

Players never see a login: the app signs each one in anonymously so it can tell
whose score is whose.

## 3. Create the database

1. **Build → Firestore Database → Create database.**
2. Pick a location close to your players. It can't be changed later.
3. Start in **production mode**.
4. Open the **Rules** tab, replace everything with the contents of
   [`firestore.rules`](../firestore.rules) from this repo, and click **Publish**.

The rules let anyone read the board, but each player can only write their own
entry, with a 2–20 character name and a total no higher than the game allows.

## 4. Connect the app

1. **Project settings (⚙) → General → Your apps → Add app → Web (`</>`).**
   Give it a nickname; Firebase Hosting isn't needed.
2. Firebase shows a `firebaseConfig` object. Copy four values into
   [`app.json`](../app.json) under `expo.extra.firebase`:

```json
"firebase": {
  "apiKey": "AIza…",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project",
  "appId": "1:1234567890:web:abc123"
}
```

These values identify the project; they aren't secret. The rules in step 3 are
what protect the data.

3. Build the app again (APK / iOS). The leaderboard turns on by itself.

## How points work

| | Points |
|---|---|
| Solving a gallery level | 100 |
| Each bulb kept (stars) | +50 (up to +150) |
| Speed bonus | +1 per second under 60 seconds (up to +60) |
| Skipped levels, your own drawn levels | 0 |

A level counts its **best** score only, so replaying can raise it but never
double it. The maximum is 163 × 310 = 50,530 points.

## Good to know

- Scores are sent from the phone, so a determined cheater could still post a
  fake total within the allowed range. The rules block impossible totals and
  editing other players' entries.
- "Reset progress" in Settings resets the total to 0, and the leaderboard entry
  follows on the next sync.
- Deleting the app creates a new anonymous player on reinstall; the old entry
  stays on the board.
