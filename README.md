# Reddy Reels

A seamless, swipe-style web app that pulls media from Reddit channels (subreddits) and presents it like short-form vertical reels.

## Stack
- React + TypeScript + Vite
- Framer Motion (transitions)
- GitHub Pages (auto-deploy via Actions)

## Features
- Comma-separated subreddit input (e.g. `funny,memes,wallpapers`)
- Pulls images/videos from public Reddit JSON
- Vertical swipe/scroll feed with snap points
- Smooth in-view transitions
- Links back to original Reddit posts

## Local dev
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deployment
This repo includes a GitHub Actions workflow to deploy to **GitHub Pages** on push to `main`.

After first push:
1. GitHub repo → Settings → Pages
2. Source should be **GitHub Actions**
3. Site URL will be:
   `https://<your-username>.github.io/reddy-reels/`

## Roadmap
- NSFW/safety filters
- Save playlists/favorites
- Infinite loading/pagination
- Keyboard + gesture navigation enhancements
