# Strapped

Find out if a watch suits you before you buy it. Pick a watch from the catalog (or look up any model by name), add a photo of your wrist and, optionally, your outfit, and the AI gives a fit score with size and style notes, plus a try-on picture of the watch on your own wrist.

- Fit score and lookups: Claude (`ANTHROPIC_API_KEY`)
- Try-on picture: Google Gemini image model (`GEMINI_API_KEY`, optional `GEMINI_IMAGE_MODEL`)

## Run it

```
npm install
cp .env.example .env.local   # then paste your API keys
npm run dev
```

Without `ANTHROPIC_API_KEY` the fit check returns a demo result and the "look up any watch" search is off. Without `GEMINI_API_KEY` the result shows no try-on picture.

## Deploy (Vercel)

1. Push this folder to a GitHub repo.
2. In Vercel, import the repo (framework: Next.js, no settings to change).
3. Add the environment variables `ANTHROPIC_API_KEY` and `GEMINI_API_KEY`.
4. Deploy. On a phone, open the link and use "Add to Home Screen" to install it.

## Watch catalog

`data/watches.txt` is the source list (one watch per line, pipe-separated). After editing it, regenerate `data/catalog.json`:

```
python3 scripts/build_catalog.py
```

Sizes are from published specs where known and approximate otherwise. Watches that aren't in the list can be looked up by name in the app; the AI fills in their specs.
