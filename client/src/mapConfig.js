export const MAP_PATHS = Object.freeze({
  manifest: "/maps/locality.json",
  archive: "/maps/locality.pmtiles",
  glyphs: "/maps/fonts/{fontstack}/{range}.pbf",
  sprite: "/maps/sprites/v4/light",
});

function coordinate(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(Number.isFinite) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 85.05112878
  );
}

export function validateLocalityManifest(raw) {
  if (
    !raw ||
    raw.version !== 1 ||
    !Array.isArray(raw.bounds) ||
    raw.bounds.length !== 2 ||
    !raw.bounds.every(coordinate)
  )
    throw new Error("Invalid locality map bounds.");
  const [[west, south], [east, north]] = raw.bounds;
  if (
    west >= east ||
    south >= north ||
    east - west > 0.2 ||
    north - south > 0.2
  )
    throw new Error("The map must cover a small, non-wrapping locality.");
  if (
    !Number.isInteger(raw.minZoom) ||
    !Number.isInteger(raw.maxZoom) ||
    raw.minZoom < 10 ||
    raw.maxZoom > 22 ||
    raw.minZoom >= raw.maxZoom
  )
    throw new Error("Invalid locality map zoom range.");
  if (
    !Array.isArray(raw.places) ||
    raw.places.length !== 2 ||
    new Set(raw.places.map((place) => place?.id)).size !== 2
  )
    throw new Error("Both verified community stops are required.");
  const places = raw.places.map((place) => {
    if (
      !place ||
      !["station", "tenx"].includes(place.id) ||
      typeof place.name !== "string" ||
      !place.name.trim() ||
      place.name.length > 120 ||
      !coordinate(place.coordinates)
    )
      throw new Error("Invalid locality map stop.");
    const [lon, lat] = place.coordinates;
    if (lon < west || lon > east || lat < south || lat > north)
      throw new Error("A community stop is outside the locality map.");
    return {
      id: place.id,
      name: place.name.trim(),
      coordinates: [...place.coordinates],
    };
  });
  if (
    typeof raw.sourceDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.sourceDate) ||
    new Date(`${raw.sourceDate}T00:00:00Z`).toISOString().slice(0, 10) !==
      raw.sourceDate
  )
    throw new Error("Invalid map source date.");
  return {
    version: 1,
    bounds: [
      [west, south],
      [east, north],
    ],
    places,
    minZoom: raw.minZoom,
    maxZoom: raw.maxZoom,
    sourceDate: raw.sourceDate,
  };
}

export function localMapRequest(url, origin) {
  const isArchiveProtocol = url.startsWith("pmtiles://");
  const parsed = new URL(isArchiveProtocol ? url.slice(10) : url, origin);
  const path = parsed.pathname;
  const tile = path.match(/^\/maps\/locality\.pmtiles\/(\d+)\/(\d+)\/(\d+)$/);
  const validTile =
    tile &&
    Number(tile[1]) <= 22 &&
    Number(tile[2]) < 2 ** Number(tile[1]) &&
    Number(tile[3]) < 2 ** Number(tile[1]);
  const allowed = isArchiveProtocol
    ? path === MAP_PATHS.archive || validTile
    : path === MAP_PATHS.archive ||
      /^\/maps\/fonts\/[^/]+\/\d+-\d+\.pbf$/.test(path) ||
      /^\/maps\/sprites\/v4\/light(?:@2x)?\.(?:json|png)$/.test(path);
  if (
    parsed.origin !== origin ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !allowed
  )
    throw new Error("External map resources are disabled.");
  return { url, credentials: "same-origin" };
}
