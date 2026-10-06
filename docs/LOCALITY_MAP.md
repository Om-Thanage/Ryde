# Locality map: Thane Railway Station ↔ Raymond TenX Habitat

The geographic reference uses MapLibre GL JS, Protomaps vector tiles and PMTiles. All runtime map requests are same-origin. Opening the map is optional; the initial page does not fetch tiles, load the renderer or request device location. Departure destinations and pickup choices remain the existing two-stop contract.

## Current status

The integration, manifest validation and bounded-view controls are implemented. The actual community map **is not provisioned yet**: this cloud returns HTTP CONNECT 403 for Protomaps download sites and the public location-verification services. An allowlist addition was saved in the environment configuration draft; applying that draft is an environment settings action. No fabricated coordinates, remote provider fallback or unrelated city map ships in their place. The UI reports “Locality map not yet available” until verified local files are installed.

## Files served by the app

Put these assets under `client/public/maps/` before building the web image:

- `locality.pmtiles`: a small Protomaps regional vector extract. Do not download/commit a planet archive.
- `locality.json`: version 1 manifest described below, with verified public landmark coordinates.
- `fonts/{fontstack}/{range}.pbf` and `sprites/v4/light{,@2x}.{json,png}`: pinned official Protomaps basemap assets; see `client/public/maps/ASSET_SOURCES.md` for provenance/licences.

The manifest fields are `version: 1`, `bounds: [[west,south],[east,north]]`, `places: [{id,name,coordinates}, …]`, integer `minZoom` / `maxZoom`, and `sourceDate: "YYYY-MM-DD"`. Coordinates are **longitude, latitude**. Exactly two distinct place IDs are accepted: `station` and `tenx`. Both markers must lie inside the bounds. Bounds must not wrap or span more than 0.2 degrees on either axis; minimum zoom is at least 10 and maximum zoom at most 22. These checks reject malformed configuration; operators must still verify that the actual rectangle covers only the intended locality.

## Provisioning the real dataset

1. Enable access to `maps.protomaps.com`, `build.protomaps.com` and the chosen public location-verification sources in cloud environment settings. Confirm Thane Railway Station's west-side landmark and Raymond TenX Habitat against public geographic data and the community's actual entrances. Record source links and verification date; a building-centre pin is not a verified pickup gate.
2. Pick the smallest rectangle that contains both landmarks and the intervening streets. Choose a useful minimum zoom for that rectangle, then confirm it at both mobile and desktop widths. MapLibre `maxBounds`, fixed tile-source bounds and disabled world wrapping constrain the view; this app has no wider-area search.
3. Select a published **v4-schema** daily Protomaps archive from the official [build catalogue](https://maps.protomaps.com/builds). Use the official [PMTiles CLI](https://github.com/protomaps/go-pmtiles) with normal HTTPS verification. For a release binary, verify its published checksum before executing it. Run `pmtiles extract ARCHIVE_HTTPS_URL client/public/maps/locality.pmtiles --bbox=WEST,SOUTH,EAST,NORTH --maxzoom=15`, replacing every placeholder with verified values. This command performs regional extraction using byte ranges; do not hotlink the planet archive from the client.
4. Run `pmtiles verify client/public/maps/locality.pmtiles` and inspect `pmtiles show` for schema, bounds and zoom coverage. Write `locality.json` with the same bounds, real landmark names/coordinates and the archive's source date. Record the exact archive URL, extraction command, CLI version and SHA-256 of the resulting local files in the provenance document. Structural PMTiles verification is not a source checksum verification.
5. Build and run the web container. Verify an HTTP `Range: bytes=0-126` request to `/maps/locality.pmtiles` returns **206**, with `Content-Range` and uncompressed archive bytes. Verify fonts/sprites load, both markers are geographically correct, map panning and zoom remain in the local view, attribution is visible, and the browser makes no third-party requests or CSP violations.

Nginx serves `/maps/` as files with byte-range support, disables gzip for archives and returns 404 for missing assets. It does not substitute the SPA HTML for a missing map. The MapLibre worker is a same-origin static module, allowed by `worker-src 'self'`; the policy adds neither external origins nor `unsafe-eval`.

PMTiles extracts can retain broader low-zoom tile geometry. The user-visible map bounds are a viewport restriction, not a claim that every archived feature has been geometrically clipped. If strict geometric clipping becomes a data requirement, generate a clipped extract with Planetiler rather than claiming bbox extraction does it.

## Sources

- [Protomaps getting started](https://docs.protomaps.com/guide/getting-started), [MapLibre basemaps](https://docs.protomaps.com/basemaps/maplibre), [PMTiles CLI](https://docs.protomaps.com/pmtiles/cli).
- Official documentation inspected via `protomaps/docs` Git source at commit `80e0388a8c141b86a1af3a8a23e9ec7d1f2ea87f` on 2026-10-06; web endpoints were blocked.
- OpenStreetMap-derived tile data requires visible OpenStreetMap attribution and observance of the ODbL. Protomaps renderer/style tooling has separate open-source licences; bundled fonts/icons carry their own notices.
