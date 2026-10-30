# Froobaloo

The games hub at https://froobaloo.com. A home page plus a set of small daily games,
each living at its own path.

| Path | Game | Source |
|---|---|---|
| `/` | Hub home page | `site/` in this repo |
| `/wordsummit/` | Wordsummit | `jtoeman/scrabboggle`, built files on its `site` branch |
| `/caseboard/` | Caseboard | `jtoeman/caseboard`, plain files on `main` |
| `/movieleague/` | The Movie League (test build at `/movieleague/test/`, hidden from search engines) | `jtoeman/movieleague`, built files on its `site` branch |
| `/cryptadoodle/` | Cryptadoodle, menu card tagged In testing (game page `noindex`) | `jtoeman/cryptadoodle`, plain files on `main` |

## How it deploys

Each game repo builds itself and publishes to its `site` branch (Caseboard needs no
build), then pings this repo. This repo's workflow (`.github/workflows/deploy.yml`)
pulls the hub page and every game together and publishes to GitHub Pages. It runs on a
push here, on a ping from a game, or by hand from the Actions tab.

The old jtoeman.github.io addresses are not supported. Links should always point at
froobaloo.com.

## Deep links

GitHub Pages serves a single `404.html` for every missing path. `site/404.html` sends
paths inside a single-page game (like `/wordsummit/game/2026-10-05`) to that game's
front door as `?__route=...`, and a small script in the game's `index.html` restores
the real path. The list of those games lives at the top of `site/404.html`.

## Analytics

The hub page reports to its own Amplitude project, "Froobaloo" (the games have their
own projects). It records page views, sessions, where visitors came from, and a
`Game Card Clicked` event (`game`, `position`) when someone opens a game. IP addresses
are not collected. Set `AMPLITUDE_API_KEY` near the bottom of `site/index.html`; empty
means no analytics.

## New games email list

The "More games are on the way" box on the hub saves emails to a Google Sheet through
the Google Apps Script in `notify/new-games.gs`, which also sends the launch email for
each new game. Setup and "how to announce a game" steps are at the top of that file.
Set `NEW_GAMES_ENDPOINT` near the bottom of `site/index.html` to the script's /exec URL;
empty means the box stays hidden. Signups also fire `New Games Signup Submitted` in
Amplitude. `notify/` is not published to the site.

## Settings this depends on

- **Secret `HUB_TOKEN`** in this repo and in each game repo: a fine-grained token with
  Contents read and write on all four repos.
- **Pages:** Settings > Pages > Source is "GitHub Actions", custom domain
  `froobaloo.com`, Enforce HTTPS on.
- **DNS (GoDaddy):** `froobaloo.com` A records to GitHub Pages
  (185.199.108.153, .109, .110, .111) and `www` CNAME to `jtoeman.github.io`.
  GitHub sends `www` and plain `http` to `https://froobaloo.com`.
- **OneSignal (Caseboard push):** the web app's site URL in the OneSignal dashboard
  must be `https://froobaloo.com`, and the daily message should open
  `https://froobaloo.com/caseboard/`. The push worker lives at
  `/caseboard/OneSignalSDKWorker.js` and only controls `/caseboard/`.

## Adding a game

1. In the game repo, build with a base path of `/<slug>/`, publish the output to a
   `site` branch, and ping this repo (copy the steps from an existing game's workflow).
2. Add a checkout step and a copy line for it in `.github/workflows/deploy.yml`.
3. If it is a single-page app with its own paths, add `/<slug>/` to the list in
   `site/404.html` and the `__route` restore script to its `index.html`.
4. Add its card to `site/index.html`.

## Shared kit for games

`site/kit/froobaloo.js` is loaded by every game (`<script src="/kit/froobaloo.js" defer>`).
It holds the list of games and provides `<froobaloo-badge>` (the F tile linking home),
`<froobaloo-next current="<game id>">` (the end-of-game "Next up" card: the next game not
played today) and `Froobaloo.markPlayed(id)`. "Played today" lives in localStorage
(`froobaloo-played-v1`, New York day), shared because all games are on froobaloo.com.
The hub page uses it to show "Played today" on each card. Adding a game: add it to
`GAMES` in the kit and a card here.
