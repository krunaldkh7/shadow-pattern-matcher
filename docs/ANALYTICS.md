# Analytics

The app sends usage events to **Google Analytics for Firebase** (project
`shadow-pattern`) through React Native Firebase. Nothing is sent from Expo Go.

## Where to look

Firebase console → **Analytics**:

- **Realtime**: users active in the last 30 minutes, by country, and the events
  they are sending right now. Data appears within about a minute.
- **Dashboard / Events**: daily totals. These reports can take up to 24 hours.
- **Retention**: how many players come back after 1, 7, 30 days.

To watch your own phone's events live while testing, use
**Analytics → DebugView** (Android: `adb shell setprop debug.firebase.analytics.app com.krunal.shadowpattern`;
iOS: add `-FIRDebugEnabled` to the Xcode scheme's launch arguments).

## Events

| Event | When | Parameters |
|---|---|---|
| `screen_view` | Every screen change | `screen_name` (home, tiers, tier, play, settings, my-levels, create, leaderboard, …) |
| `level_start` | A level opens | `level`, `tier` (easy…master, or custom), `custom` |
| `level_complete` | A level is solved | `level`, `tier`, `custom`, `stars`, `seconds`, `hints` |
| `level_skip` | A level is skipped with a reward video | `level`, `tier`, `custom` |
| `hint_used` | A hint is given | `kind` (bulb / ghost), `paid` (true when bought with an ad) |
| `bonus_bulbs_earned` | "Earn all 3 bulbs" ad watched | `level`, `tier`, `custom` |
| `custom_level_created` | A drawn level is saved | `strokes` |
| `leaderboard_join` | The player picks a leaderboard name | — |

Firebase also records its automatic events (`first_open`, `session_start`,
`app_update`, …) and, through the linked AdMob account, ad impressions.

## Privacy

Before publishing, the privacy policy (see `src/legal.ts`) must say that the
app uses Google Analytics for Firebase and Google AdMob, and the Play Store
**Data safety** form must declare "App activity" and "Device or other IDs"
collected for analytics and advertising.
