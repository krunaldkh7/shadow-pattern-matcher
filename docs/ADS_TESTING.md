# Ads — Tester Guide

How every ad in **Shadow Pattern Matcher** behaves, where to find it, and how to test it.

## Before you start

**Which build to use.** Ads only appear in a real app build (an APK on Android, or the installed app on iPhone). **Expo Go never shows ads.** That is by design and is not a bug.

**Test ads only.** Every build used for testing shows Google's **test ads**, labelled "Test Ad". Tapping them is safe. Never tap real ads on your own device: AdMob can suspend the account for it.

**Where the settings come from.** The app downloads its ad settings from GitHub each time it **starts**:
`https://github.com/krunaldkh7/shadow-pattern-matcher-config` → `ads.json`

- A change to `ads.json` applies the next time the app is **fully closed and reopened**, not while it is running.
- GitHub can take up to **5 minutes** to serve the new file.
- If the file can't be downloaded (offline, timeout after 6 seconds, broken JSON), **all ads are off** for that session. The game still works normally.

**Ad readiness.** Full-screen ads are loaded in the background after the app starts. In the first few seconds after a launch, one may not be ready yet, and it is skipped silently. Wait about 10 seconds after opening the app before testing.

## Ad formats at a glance

| # | Format | Where | When it appears |
|---|---|---|---|
| 1 | Banner | Bottom of every menu screen **and** the game screen | Always, once loaded |
| 2 | Interstitial | Any screen except the game screen | After a random 6–12 taps |
| 3 | Rewarded | Game screen, both hint buttons | Only after the free hints are used up, when the player taps |
| 4 | Rewarded interstitial | "Level solved" card | After a solve where bulbs were spent; 5-second countdown first |
| 5 | Native advanced | "Choose a gallery" screen, between **Medium** and **Hard** | Always, once loaded |
| 6 | App open | Full screen | When returning to the app from the background, at most once every 4 hours |

---

## 1. Banner

**Where:** a strip at the very bottom of Home, Choose a gallery, each gallery's level list, Settings, How to play, and the **game screen**. It does **not** appear on the intro (gold dots) screen.

**Behaviour:**
- On the game screen, the Undo / Reset / Hint buttons and the "level solved" card move up so the banner never covers them.
- If a banner fails to load (or a refresh fails), it takes up no space and tries again after 30 seconds.

**Test:**
1. Open the app and wait a few seconds on Home. A "Test Ad" banner appears at the bottom.
2. Open a level. The banner is at the bottom, and the three buttons sit above it without overlapping.
3. Solve the level. The solved card sits above the banner.

## 2. Interstitial (full screen, tap-based)

**Where:** any screen **except** the game screen.

**Behaviour:**
- Every tap counts: buttons, cards, level tiles, the back arrow, and empty space. Scrolling also counts as a tap.
- After a **random** number of taps between **6 and 12**, a "Loading ad…" box shows for about 0.7 seconds, then the full-screen ad opens. A new random number is picked for the next one.
- Taps on the game screen (hints, pause menu, solved card) are **never** counted.
- If the counting tap opens a level, the ad does **not** open over the game. It waits for the next tap outside the game.
- Settings opened from the pause menu is not the game screen, so taps there count.

**Test:**
1. On Home, tap around (buttons or empty space) up to 12 times. "Loading ad…" appears, then the interstitial.
2. Close the ad. Keep tapping. Another one appears within the next 6–12 taps.
3. Open a level and tap the hints and pause menu many times. **No** interstitial appears.
4. Edge case: tap level tiles repeatedly to enter levels. An ad must never appear on top of a running level.

Config: `interstitial_taps_min`, `interstitial_taps_max` (both `0` = off).

## 3. Rewarded (extra hints)

**Where:** the game screen. There are two hint buttons, and each has **3 free uses per level**:

| Button | What it does | Free uses | Shown on screen |
|---|---|---|---|
| 💡 Lightbulb (top right) | Turns the sculpture halfway to the answer | 3 bulbs (the small bulbs under the button) | Bulbs go dark one by one |
| 👁 Hint (bottom right) | Shows a see-through "ghost" of the answer for a few seconds | 3 | Label reads `Hint 3/3`, `Hint 2/3`… |

**Behaviour:**
- While free uses remain, **no ad is ever shown**.
- Once a button's free uses are gone, its icon changes to ▶. The bottom label reads **"Watch ad"**.
- Tapping ▶ pauses the game timer and plays a reward video. If no video is ready yet, the app tries to load one for up to 8 seconds.
- **Watch to the end:** the hint is given, and no bulb is used.
- **Close early:** no hint.
- **No video available** (offline, no fill): a "No video right now" message appears, and the button stays active so you can retry.
- While a video is loading or playing, the hint buttons can't be tapped again.
- Stars for a level equal the bulbs left (minimum 1). Ghost hints never cost a bulb.

**Test:**
1. Open a level. Tap 💡 three times. Each tap turns the sculpture and darkens one bulb. **No ad.**
2. Tap 💡 a fourth time. A reward video plays. Watch it fully. The sculpture turns, and the bulbs stay dark.
3. Tap 💡 again and close the video early. Nothing happens to the sculpture.
4. Tap 👁 Hint three times (wait for each ghost to fade). The label counts down to `0/3`, then shows "Watch ad".
5. Tap "Watch ad", watch fully. The ghost appears.
6. Turn on airplane mode, then tap ▶. After a few seconds, "No video right now" appears.

## 4. Rewarded interstitial ("Earn all 3 bulbs")

**Where:** the "level solved" card.

**Behaviour:**
- Offered only when the level was solved with **fewer than 3 bulbs**, and only when an ad is already loaded.
- A box appears near the top of the screen, above the card: *"Earn all 3 bulbs — Watch a short ad to light every bulb for this level. Starting in 5…"* with a **No thanks** link. The card's buttons stay usable while it counts down. This intro screen is required by AdMob.
- After the 5-second countdown, the ad plays automatically.
- **Watch to the end:** the card shows 3 bulbs, and the level is saved with 3 stars (check the level list).
- **No thanks**, closing early, or tapping "Next level" during the countdown: no ad and no reward.
- Offered at most once per solve.

**Test:**
1. Use 💡 once, then solve the level. The offer box appears with a countdown.
2. Let it reach 0. The ad plays. Watch fully. The card shows 3 lit bulbs. Go back to the level list: that level shows 3 bulbs.
3. Solve another level using 💡, then tap **No thanks**. The box disappears and no ad plays.
4. Solve a level **without** using 💡. **No** offer appears.

## 5. Native advanced

**Where:** Home → **Play** → "Choose a gallery", as a card between **Medium** and **Hard**.

**Behaviour:** styled like the gallery cards, with an **"Ad"** badge in its top-left corner, an icon, a headline, a description and a button. If it doesn't load, nothing is shown, with no empty gap.

**Test:**
1. Open Choose a gallery and wait a moment. The ad card appears between Medium and Hard, with an "Ad" badge.
2. Tap its button. The advertiser page opens.

## 6. App open

**Where:** full screen, when the player comes back to the app.

**Behaviour:**
- Shown when the app returns from the **background** (switch to another app or the home screen, then come back).
- **Not** shown on a fresh launch, since the intro plays then.
- At most once every **240 minutes (4 hours)**.
- Not shown right after another full-screen ad closes.
- Not shown when the player returns after tapping an ad (store page, browser) or a link inside the app (Privacy Policy, Support…).
- An app open ad loaded more than 4 hours ago is replaced with a fresh one instead of being shown.

**Test:**
1. Open the app and wait about 10 seconds. Go to the phone's home screen, then reopen the app. The app open ad appears.
2. Repeat right away. **No** ad, because of the 4-hour cooldown.
3. To test again sooner, set `app_open_cooldown_minutes` to `0` in `ads.json`, wait about 5 minutes, then fully close and reopen the app.

---

## Turning ads off

| Test | Change in `ads.json` | Expected (after fully reopening the app) |
|---|---|---|
| All ads off | `"show_ads": false` | No ads anywhere. No banner space. Hint buttons stop after their 3 free uses (shown disabled) and never offer a video. |
| One format off | Delete that format's `…_ad_unit_id` (and its `ios` copy) | Only that format disappears. |
| Offline at launch | Airplane mode, then fully reopen the app | Same as all ads off for that session. |
| Broken config | Invalid JSON in `ads.json` | Same as all ads off. The app must not crash. |

Remember: GitHub can take up to 5 minutes to serve a changed file.

## Levels (context for testing)

- Each gallery's **first level is always open**: Easy 1, Medium 34, Hard 67, Expert 100, Master 132.
- After that, a level opens when the one before it is solved.
- Settings → **Reset progress** clears solved levels and stars.

## Reporting a problem

Please include:
- the device, OS version and build (APK date, or iPhone build);
- the screen and the exact steps;
- what you expected, and what happened;
- a screenshot or screen recording;
- whether the device was online, and whether `ads.json` was changed in the last 5 minutes.

Developers can see `[ads]` lines in the Metro console of a development build: config on/off, SDK initialized, and each ad loaded or failed.
