# Contributing to SubSwipe

Thanks for contributing.

## Dev setup
```bash
npm install
npm run dev
```

## Quality bar
- Keep UI smooth on mobile first.
- Avoid regressions in feed loading.
- Keep bundle size reasonable.
- Prefer small, focused PRs.

## PR checklist
- [ ] Build passes: `npm run build`
- [ ] No obvious console errors in browser
- [ ] Media feed works for at least 3 subreddits
- [ ] Added/updated docs when behavior changed

## Branching
- `main` is deploy-ready.
- Use feature branches: `feat/<name>`, `fix/<name>`.

## Commit style
Use conventional prefixes:
- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `chore:`
