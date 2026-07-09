/**
 * Tests for map.js — pure utility functions.
 *
 * These tests load map.js into the global scope (via __loadSource)
 * and test individual functions that do NOT require Yandex Maps API
 * interaction (no ymaps.Map, no ymaps.Placemark, etc.).
 *
 * Functions tested here:
 * - findRecordById()
 * - convertCoordsStringToArray()
 * - extractAllRings()
 * - sortMarkers()
 * - composePopupContent()
 * - determineStartingPoint()
 * - createPolygonForTurf()
 */

const { allSearches, activeExactSearch, activeSearch, oldSearch, minimalSearch, searchWithMissingFields } = require('./__fixtures__/searchRecords');

beforeAll(() => {
  // Load map.js — this sets up all global functions and STATE
  // We need userData to be set first to avoid errors
  global.userData = {
    params: {
      home_lat: 55.75,
      home_lon: 37.62,
      radius: 50,
      regions: ['1', '2'],
      searches: allSearches,
    },
  };
  __loadSource('src/js/map.js');
  // Load balloon.js for composePopupContent / declareBalloonClass tests
  __loadSource('src/js/balloon.js');
});

beforeEach(() => {
  __resetState();
  __resetTurfCounters();
  jest.clearAllMocks();
});

/* ──────────────── findRecordById ──────────────── */

describe('findRecordById()', () => {
  const csvText = 'id;name;coords;center\n1;Московская область;"[[[55.75,37.62]]]";"[55.75,37.62]"\n2;Омская область;"[[[54.99,73.37]]]";"[54.99,73.37]"';

  test('finds an existing record by ID', () => {
    const result = findRecordById(csvText, '1');
    expect(result).not.toBeNull();
    expect(result.id).toBe('1');
    expect(result.name).toBe('Московская область');
  });

  test('returns null for non-existent ID', () => {
    const result = findRecordById(csvText, '999');
    expect(result).toBeNull();
  });

  test('parses semicolon-delimited CSV correctly', () => {
    const result = findRecordById(csvText, '2');
    expect(result).not.toBeNull();
    expect(result.id).toBe('2');
    expect(result.name).toBe('Омская область');
    expect(result.coords).toBe('"[[[54.99,73.37]]]"');
  });

  test('returns null for empty CSV (only headers)', () => {
    const headerOnly = 'id;name;coords;center\n';
    const result = findRecordById(headerOnly, '1');
    expect(result).toBeNull();
  });

  test('returns null for completely empty CSV', () => {
    const result = findRecordById('', '1');
    expect(result).toBeNull();
  });
});

/* ──────────────── convertCoordsStringToArray ──────────────── */

describe('convertCoordsStringToArray()', () => {
  test('parses valid JSON coordinate string', () => {
    const result = convertCoordsStringToArray('[[[55.75,37.62],[55.76,37.63]]]');
    // JSON.parse returns the nested array as-is: [[[55.75,37.62],[55.76,37.63]]]
    expect(result).toEqual([[[55.75, 37.62], [55.76, 37.63]]]);
  });

  test('trims surrounding quotes from string', () => {
    const result = convertCoordsStringToArray('"[[[55.75,37.62]]]"');
    // After trimming quotes, JSON.parse returns [[[55.75,37.62]]]
    expect(result).toEqual([[[55.75, 37.62]]]);
  });

  test('handles string with escaped quotes that becomes valid JSON after replacement', () => {
    // The function replaces \" with " then parses as JSON.
    // Input: outer quotes removed -> \"[[[55.75,37.62]]]\"
    // Then \" -> " -> "[[[55.75,37.62]]]" -> JSON.parse returns string "[[[55.75,37.62]]]"
    // This tests the regex replacement logic even if the result is a string, not an array
    const input = '"\\"[[[55.75,37.62]]]\\""';
    const result = convertCoordsStringToArray(input);
    // After outer quote removal: \"[[[55.75,37.62]]]\"
    // After escaped quote replacement: "[[[55.75,37.62]]]"
    // JSON.parse("\"[[[55.75,37.62]]]\"") returns the string "[[[55.75,37.62]]]"
    expect(result).toBe('[[[55.75,37.62]]]');
  });

  test('returns null for invalid JSON', () => {
    const result = convertCoordsStringToArray('not-json');
    expect(result).toBeNull();
  });

  test('returns null for empty string', () => {
    const result = convertCoordsStringToArray('');
    expect(result).toBeNull();
  });
});

/* ──────────────── extractAllRings ──────────────── */

describe('extractAllRings()', () => {
  test('returns single ring for single polygon', () => {
    const coords = [[[55.75, 37.62], [55.76, 37.63], [55.75, 37.62]]];
    const result = extractAllRings(coords);
    expect(result).toEqual([coords[0]]);
  });

  test('returns multiple rings for multi-polygon', () => {
    const ring1 = [[55.75, 37.62], [55.76, 37.63], [55.75, 37.62]];
    const ring2 = [[55.77, 37.64], [55.78, 37.65], [55.77, 37.64]];
    const coords = [ring1, ring2];
    const result = extractAllRings(coords);
    expect(result).toEqual([ring1, ring2]);
  });

  test('handles single ring with nested array', () => {
    const coords = [[[1, 2], [3, 4], [5, 6]]];
    const result = extractAllRings(coords);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  test('handles empty array gracefully', () => {
    const result = extractAllRings([]);
    expect(result).toEqual([undefined]);
  });
});

/* ──────────────── sortMarkers ──────────────── */

describe('sortMarkers()', () => {
  function makeSearch(name, isOld, exact, lat, lng) {
    return {
      name,
      search_is_old: isOld,
      exact_coords: exact,
      coords: [lat, lng],
    };
  }

  test('sorts by priority: old first, then active, then active+exact (ascending)', () => {
    STATE.userSearchesList = [
      makeSearch('active_exact1', false, true, 55.75, 37.62),
      makeSearch('active1', false, false, 55.76, 37.63),
      makeSearch('old1', true, false, 55.77, 37.64),
    ];

    sortMarkers();

    // Priority: old=1, active=2, active+exact=3 — sorted ascending
    expect(STATE.userSearchesList[0].name).toBe('old1');
    expect(STATE.userSearchesList[1].name).toBe('active1');
    expect(STATE.userSearchesList[2].name).toBe('active_exact1');
  });

  test('sorts by rotated Y coordinate within same priority', () => {
    STATE.userSearchesList = [
      makeSearch('b', false, true, 56.0, 38.0),
      makeSearch('a', false, true, 55.0, 37.0),
    ];

    sortMarkers();

    // Both have priority 3, sorted by rotated Y descending
    // rotated Y = lng*cos(15°) - lat*sin(15°)
    // For a: 37*0.9659 - 55*0.2588 = 35.74 - 14.23 = 21.51
    // For b: 38*0.9659 - 56*0.2588 = 36.70 - 14.49 = 22.21
    // b should come first (higher rotated Y)
    expect(STATE.userSearchesList[0].name).toBe('b');
    expect(STATE.userSearchesList[1].name).toBe('a');
  });

  test('handles single marker without error', () => {
    STATE.userSearchesList = [
      makeSearch('only_one', false, true, 55.75, 37.62),
    ];

    expect(() => sortMarkers()).not.toThrow();
    expect(STATE.userSearchesList).toHaveLength(1);
  });

  test('handles empty list without error', () => {
    STATE.userSearchesList = [];
    expect(() => sortMarkers()).not.toThrow();
  });
});

/* ──────────────── composePopupContent ──────────────── */

describe('composePopupContent()', () => {
  test('generates HTML with all fields for complete search', () => {
    const html = composePopupContent(activeExactSearch);
    expect(html).toContain(activeExactSearch.display_name);
    expect(html).toContain(activeExactSearch.search_type);
    expect(html).toContain(activeExactSearch.freshness);
    expect(html).toContain(activeExactSearch.search_status);
    expect(html).toContain('Точные');
    expect(html).toContain('button_route');
    expect(html).toContain('button_forum');
    expect(html).toContain('button_show_description');
    expect(html).toContain('button_duration_calculate');
  });

  test('shows "неизвестный" when display_name is missing', () => {
    const html = composePopupContent(minimalSearch);
    expect(html).toContain('неизвестный');
  });

  test('shows "не определено" when search_type is missing', () => {
    const html = composePopupContent(searchWithMissingFields);
    expect(html).toContain('не определено');
  });

  test('shows "неизвестно" when freshness is missing', () => {
    const html = composePopupContent(searchWithMissingFields);
    expect(html).toContain('неизвестно');
  });

  test('shows "не определён" when search_status is missing', () => {
    const html = composePopupContent(searchWithMissingFields);
    expect(html).toContain('не определён');
  });

  test('shows "Точные" when exact_coords is true', () => {
    const html = composePopupContent(activeExactSearch);
    expect(html).toContain('Точные');
  });

  test('shows "ТРЕБУЮТ УТОЧНЕНИЯ" when exact_coords is false', () => {
    const html = composePopupContent(activeSearch);
    expect(html).toContain('ТРЕБУЮТ УТОЧНЕНИЯ');
  });

  test('includes all four action buttons', () => {
    const html = composePopupContent(activeExactSearch);
    expect(html).toContain('id="button_route"');
    expect(html).toContain('id="button_forum"');
    expect(html).toContain('id="button_show_description"');
    expect(html).toContain('id="button_duration_calculate"');
  });
});

/* ──────────────── determineStartingPoint ──────────────── */

describe('determineStartingPoint()', () => {
  test('returns home coordinates when available', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];
    STATE.currentUserLocation = [56.0, 38.0];

    const result = determineStartingPoint();
    expect(result).toEqual([55.75, 37.62]);
  });

  test('returns current user location when home is not set', () => {
    STATE.userHomeCoordinates = null;
    STATE.currentUserLocation = [56.0, 38.0];

    const result = determineStartingPoint();
    expect(result).toEqual([56.0, 38.0]);
  });

  test('returns null when neither home nor location is available', () => {
    STATE.userHomeCoordinates = null;
    STATE.currentUserLocation = null;

    const result = determineStartingPoint();
    expect(result).toBeNull();
    expect(global.alert).toHaveBeenCalled();
  });
});

/* ──────────────── createPolygonForTurf ──────────────── */

describe('createPolygonForTurf()', () => {
  test('sets polygonForTurf from MultiPolygon geometry', () => {
    STATE.userActiveArea = {
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[[55.75, 37.62], [55.76, 37.63], [55.77, 37.64], [55.75, 37.62]]]],
      },
    };

    createPolygonForTurf();
    expect(STATE.polygonForTurf).toBeDefined();
    expect(STATE.polygonForTurf[0]).toEqual([55.75, 37.62]);
  });

  test('sets polygonForTurf from Polygon geometry', () => {
    STATE.userActiveArea = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[55.75, 37.62], [55.76, 37.63], [55.77, 37.64], [55.75, 37.62]]],
      },
    };

    createPolygonForTurf();
    expect(STATE.polygonForTurf).toBeDefined();
    expect(STATE.polygonForTurf[0]).toEqual([55.75, 37.62]);
  });

  test('sets polygonForTurf to null when userActiveArea is null', () => {
    STATE.userActiveArea = null;
    createPolygonForTurf();
    expect(STATE.polygonForTurf).toBeNull();
  });

  test('closes the ring if first and last points differ', () => {
    STATE.userActiveArea = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[55.75, 37.62], [55.76, 37.63], [55.77, 37.64]]],
      },
    };

    createPolygonForTurf();
    // The ring should be closed: last point should equal first
    const last = STATE.polygonForTurf[STATE.polygonForTurf.length - 1];
    expect(last).toEqual([55.75, 37.62]);
  });
});
