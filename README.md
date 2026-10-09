# Froobaloo

The games hub at https://froobaloo.com. A home page plus a set of small daily games,
each living at its own path.

| Path | Game | Source |
|---|---|---|
| `/` | Hub home page | `site/` in this repo |
| `/wordsummit/` | Wordsummit | `jtoeman/scrabboggle`, built files on its `site` branch |
| `/caseboard/` | Caseboard | `jtoeman/caseboard`, plain files on `main` |
| `/movieleague/` | The Movie League (test build at `/movieleague/test/`, hidden from search engines) | `jtoeman/movieleague`, built files on its `site` branch |

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
