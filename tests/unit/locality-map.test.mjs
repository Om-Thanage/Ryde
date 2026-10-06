import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localMapRequest, validateLocalityManifest } from '../../client/src/mapConfig.js';

// Synthetic coordinates test the boundary contract; these are not community location pins.
const fixture = () => ({ version: 1, bounds: [[72, 19], [72.02, 19.02]],
  places: [{id: 'station', name: 'Station test fixture', coordinates: [72.005, 19.005]},
    {id: 'tenx', name: 'Community test fixture', coordinates: [72.015, 19.015]}],
  minZoom: 12, maxZoom: 16, sourceDate: '2026-10-01' });

test('accepts exactly two distinct places inside a small geographic boundary', () => {
  const result = validateLocalityManifest(fixture());
  assert.deepEqual(result, fixture());
  assert.notEqual(result.bounds, fixture().bounds);
});

test('rejects remote-sized bounds, wrapping bounds, unsafe pins and invalid dates', () => {
  const cases = [
    {bounds: [[72, 19], [73, 20]]}, {bounds: [[73, 19], [72, 20]]},
    {bounds: [[72, 19], [72.02, Number.NaN]]},
    {places: [fixture().places[0], fixture().places[0]]},
    {places: [fixture().places[0], {...fixture().places[1], coordinates: [73, 20]}]},
    {places: [fixture().places[0], {...fixture().places[1], id: 'home'}]},
    {sourceDate: '2026-02-30'}, {sourceDate: 'invalid'},
    {minZoom: 0}, {maxZoom: 23}, {minZoom: 16, maxZoom: 12},
  ];
  for (const changes of cases) assert.throws(() => validateLocalityManifest({...fixture(), ...changes}));
});

test('map resources are restricted to fixed same-origin tile, glyph and sprite paths', () => {
  const origin = 'https://community.example';
  for (const path of ['/maps/locality.pmtiles', '/maps/fonts/Noto%20Sans%20Regular/0-255.pbf',
    '/maps/sprites/v4/light.json', '/maps/sprites/v4/light@2x.png']) {
    assert.equal(localMapRequest(`${origin}${path}`, origin).credentials, 'same-origin');
  }
  assert.equal(localMapRequest(`pmtiles://${origin}/maps/locality.pmtiles`, origin).url,
    `pmtiles://${origin}/maps/locality.pmtiles`);
  for (const url of ['https://tracker.example/maps/locality.pmtiles',
    `${origin}/maps/other.pmtiles`, `${origin}/api/auth/me`,
    `${origin}/maps/locality.pmtiles?redirect=evil`, `${origin}/maps/locality.pmtiles#fragment`,
    'https://user:pass@community.example/maps/locality.pmtiles']) {
    assert.throws(() => localMapRequest(url, origin));
  }
});


test('PMTiles tile URLs accept valid local ZXY and reject other resources or out-of-range coordinates', () => {
  const origin = 'https://community.example';
  const tile = `pmtiles://${origin}/maps/locality.pmtiles/15/22936/14564`;
  assert.equal(localMapRequest(tile, origin).url, tile);
  for (const url of [`pmtiles://${origin}/maps/locality.pmtiles/23/1/1`,
    `pmtiles://${origin}/maps/locality.pmtiles/12/4096/0`,
    `pmtiles://${origin}/maps/locality.pmtiles/12/0/4096`,
    `pmtiles://${origin}/maps/locality.pmtiles/12/-1/0`,
    `pmtiles://${origin}/maps/fonts/Noto%20Sans%20Regular/0-255.pbf`,
    `${origin}/maps/locality.pmtiles/15/22936/14564`,
    'pmtiles://tracker.example/maps/locality.pmtiles/15/22936/14564']) {
    assert.throws(() => localMapRequest(url, origin));
  }
});
