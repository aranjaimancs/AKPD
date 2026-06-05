# Map Tile Provider Setup

The People page map loads tiles from a configurable URL.

## Local dev (default — no setup needed)

`.env.local` already has:
```
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors
```

OpenStreetMap's public tile servers are fine for local development. **Do not use them in production** — their ToS prohibits heavy or commercial use.

---

## Production — Stadia Maps (free tier, 200k tiles/month)

1. Sign up at **client.stadiamaps.com** → create a free account.
2. Create a new API key. Under "Allowed domains" add your production domain (e.g. `akpd.vercel.app`).
3. In Vercel environment variables set:
   ```
   NEXT_PUBLIC_MAP_TILE_URL=https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=YOUR_KEY
   NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors
   ```
4. For a dark map style matching the navy theme, use `alidade_smooth_dark` instead of `alidade_smooth`.

---

## Alternative — MapTiler (free tier, 100k tiles/month)

1. Sign up at **cloud.maptiler.com**.
2. Create an API key.
3. Set:
   ```
   NEXT_PUBLIC_MAP_TILE_URL=https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=YOUR_KEY
   NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=© <a href="https://www.maptiler.com/copyright/">MapTiler</a> © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors
   ```

---

Both providers work with the existing code — it's a one-line env var swap.
