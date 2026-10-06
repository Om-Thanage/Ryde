# Self-hosted Protomaps rendering assets

These are upstream binary glyph ranges and sprites copied without modification.
They are map rendering resources, not geographic map data. No PMTiles archive,
endpoint coordinates or locality metadata are supplied by this asset bundle.

## Glyphs

Source: https://github.com/protomaps/basemaps-assets

Pinned commit: `028c18f713baecad011301ff7a69acc39bcc2ae7`.

Source directories and exact MapLibre font names:

- `fonts/Noto Sans Regular`
- `fonts/Noto Sans Medium`
- `fonts/Noto Sans Italic`
- `fonts/Noto Sans Devanagari Regular v1`

Glyph URL template: `/maps/fonts/{fontstack}/{range}.pbf`.
Use the upstream Protomaps style generator so it selects the single Devanagari
font for the positioned-glyph (`pgf:*`) labels rather than requesting a combined
comma-separated fontstack directory that does not exist here.

Each font includes these complete 256-codepoint ranges: `0-255`, `256-511`,
`512-767`, `768-1023`, `2304-2559`, `8192-8447`, `8448-8703`, `43264-43519`,
and `65280-65535`. These cover Latin letters, combining marks, Devanagari,
Devanagari Extended, common punctuation/currency/symbols and full-width forms.

The Devanagari v1 font additionally includes `62720-62975`, `62976-63231`,
`63232-63487`, and `63488-63743`. These are essential: Protomaps' shaped
Devanagari labels use a positioned-glyph encoding in these private-use ranges.
They are the four ranges in the upstream Devanagari font that differ from the
regular font at the pinned commit. Copying only the standard Unicode Devanagari
block would miss the shaped Marathi labels.

This is an English/Marathi subset, not every Unicode script. Add exact upstream
ranges at the pinned revision if a verified local tile label needs another
range; do not silently send missing glyph requests to a third-party CDN.

License: SIL Open Font License 1.1, preserved at `fonts/OFL.txt`.
Copyright 2022 The Noto Project Authors.

## Sprites

Same Protomaps asset repository and pinned commit as above.
Copied `sprites/v4/light.json`, `light.png`, `light@2x.json`, `light@2x.png`.
MapLibre sprite prefix: `/maps/sprites/v4/light`.

Upstream states that these sprites derive from MIT-licensed
https://github.com/tangrams/icons . The authoritative MIT notice was copied
from that repository at commit `92510779634f4a006c61ea70e50cb8c52c765a81`
into `sprites/LICENSE.md`, preserving Copyright (c) 2017 Mapzen.

## Acquisition and deployment

Acquired through HTTPS Git from the official repositories using a shallow,
filtered sparse checkout. Git objects preserve the upstream file bytes; no
TLS, package integrity or signature checks were disabled. Only the selected
ranges and light sprites are redistributed here, approximately 3.06 MB total
including the font and icon notices (40 glyph files, four sprite files).

Serve these alongside the application on the same origin. Keep this provenance
document and license notices in distributed builds. The map itself separately
requires a genuine regional PMTiles archive, attribution and HTTP range serving.
