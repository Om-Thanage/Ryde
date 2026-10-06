import { useEffect, useRef, useState } from "react";
import {
  Map,
  Marker,
  NavigationControl,
  AttributionControl,
  addProtocol,
  setWorkerUrl,
} from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MAP_PATHS,
  localMapRequest,
  validateLocalityManifest,
} from "../mapConfig";

const protocol = new Protocol();
addProtocol("pmtiles", protocol.tile);
setWorkerUrl(mapWorkerUrl);

export default function LocalityMap({ onClose }) {
  const container = useRef(null);
  const [status, setStatus] = useState("loading");
  const [manifest, setManifest] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let map;
    let disposed = false;
    let deadline;
    function unavailable() {
      if (disposed) return;
      clearTimeout(deadline);
      controller.abort();
      setStatus("unavailable");
      const failedMap = map;
      map = undefined;
      failedMap?.remove();
    }
    deadline = setTimeout(unavailable, 15000);
    async function openMap() {
      try {
        const response = await fetch(MAP_PATHS.manifest, {
          signal: controller.signal,
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Map data unavailable.");
        const config = validateLocalityManifest(await response.json());
        if (disposed) return;
        setManifest(config);
        const [[west, south], [east, north]] = config.bounds;
        map = new Map({
          container: container.current,
          style: {
            version: 8,
            glyphs: MAP_PATHS.glyphs,
            sprite: MAP_PATHS.sprite,
            sources: {
              protomaps: {
                type: "vector",
                url: `pmtiles://${window.location.origin}${MAP_PATHS.archive}`,
                bounds: [west, south, east, north],
                attribution:
                  '<a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
              },
            },
            layers: layers("protomaps", namedFlavor("light"), { lang: "en" }),
          },
          center: [(west + east) / 2, (south + north) / 2],
          zoom: config.minZoom,
          minZoom: config.minZoom,
          maxZoom: config.maxZoom,
          maxBounds: config.bounds,
          renderWorldCopies: false,
          attributionControl: false,
          pitchWithRotate: false,
          dragRotate: false,
          touchZoomRotate: true,
          transformRequest: (url) =>
            localMapRequest(url, window.location.origin),
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(
          new NavigationControl({ showCompass: false }),
          "top-right",
        );
        map.addControl(
          new AttributionControl({ compact: false }),
          "bottom-right",
        );
        map.fitBounds(config.bounds, { padding: 25, duration: 0 });
        config.places.forEach((place) => {
          const pin = document.createElement("div");
          pin.className = `locality-pin ${place.id}`;
          const dot = document.createElement("span");
          dot.className = "locality-pin-dot";
          dot.setAttribute("aria-hidden", "true");
          const label = document.createElement("span");
          label.textContent = place.name;
          label.className = "locality-pin-label";
          pin.append(dot, label);
          new Marker({ element: pin, anchor: "left" })
            .setLngLat(place.coordinates)
            .addTo(map);
        });
        map.once("load", () => {
          if (!disposed) {
            clearTimeout(deadline);
            setStatus("ready");
          }
        });
        map.on("error", unavailable);
      } catch (error) {
        if (!disposed && error.name !== "AbortError") unavailable();
      }
    }
    openMap();
    return () => {
      disposed = true;
      clearTimeout(deadline);
      controller.abort();
      const closedMap = map;
      map = undefined;
      closedMap?.remove();
    };
  }, [attempt]);
  return (
    <section className="locality-map" aria-label="Community locality map">
      <div className="locality-map-header">
        <div>
          <span className="eyebrow">JUST OUR TWO STOPS</span>
          <h3>The neighbourhood, in view.</h3>
        </div>
        <button className="text-button" onClick={onClose}>
          Back to schematic
        </button>
      </div>
      <div
        ref={container}
        className="locality-map-canvas"
        role="region"
        aria-label="Locality reference map. Use arrow keys to pan and plus or minus to zoom within the community area."
        hidden={status === "unavailable"}
      />
      {status === "loading" && (
        <p className="locality-map-loading" role="status">
          Opening the locality map…
        </p>
      )}
      {status === "unavailable" && (
        <div className="locality-map-fallback" role="status">
          <span className="eyebrow">OUR TWO STOPS STAY THE SAME</span>
          <h3>Locality map not yet available.</h3>
          <p>
            Verified local map data could not be loaded. You can still find a
            group and coordinate at the listed public meeting points.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
          >
            Retry map
          </button>
        </div>
      )}
      {manifest && status === "ready" && (
        <ul className="locality-map-places">
          {manifest.places.map((place) => (
            <li key={place.id}>
              <span className={`place-dot ${place.id}`} aria-hidden="true" />
              {place.name}
            </li>
          ))}
        </ul>
      )}
      <p className="fine locality-map-note">
        Local area reference only · no route guidance or live location.{" "}
        {status === "ready" &&
          manifest &&
          `Map source: ${manifest.sourceDate}.`}
      </p>
    </section>
  );
}
