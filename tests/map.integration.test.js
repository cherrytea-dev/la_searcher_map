/**
 * Integration tests for map.js — functions that interact with ymaps API,
 * turf.js, fetch, and the global STATE object.
 *
 * These tests load map.js and test functions that require mocked
 * ymaps, turf, and fetch to be set up.
 */

const fs = require('fs');
const path = require('path');

// Load the CSV fixture
const csvFixture = fs.readFileSync(path.resolve(__dirname, '__fixtures__/regions.csv'), 'utf8');

beforeAll(() => {
  // Set up userData before loading map.js
  global.window = global;
  global.userData = {
    params: {
      home_lat: 55.75,
      home_lon: 37.62,
      radius: 50,
      regions: ['1', '3'],
      searches: [],
    },
  };
  __loadSource('src/js/map.js');
  // Load balloon.js for declareBalloonClass used by addMarker tests
  __loadSource('src/js/balloon.js');
});

beforeEach(() => {
  __resetState();
  __resetTurfCounters();
  jest.clearAllMocks();
});

/* ──────────────── defineRegionsMultiPolygon ──────────────── */

describe('defineRegionsMultiPolygon()', () => {
  test('creates a single polygon for one region with one ring', async () => {
    STATE.userRegionIdsList = ['1'];

    global.__mockFetchResponse(csvFixture);
    await defineRegionsMultiPolygon();

    expect(STATE.unitedUserRegionsMultiPolygon).not.toBeNull();
    expect(STATE.unitedUserRegionsMultiPolygon._mockType).toBe('polygon');
    expect(turf.polygon).toHaveBeenCalled();
  });

  test('creates a multiPolygon for multiple regions', async () => {
    STATE.userRegionIdsList = ['1', '2'];

    global.__mockFetchResponse(csvFixture);
    await defineRegionsMultiPolygon();

    expect(STATE.unitedUserRegionsMultiPolygon).not.toBeNull();
    expect(STATE.unitedUserRegionsMultiPolygon._mockType).toBe('multiPolygon');
    expect(turf.multiPolygon).toHaveBeenCalled();
  });

  test('handles CSV fetch error gracefully', async () => {
    STATE.userRegionIdsList = ['1'];
    global.__mockFetchError('Network error');

    await defineRegionsMultiPolygon();

    // STATE.unitedUserRegionsMultiPolygon stays null (initial value)
    expect(STATE.unitedUserRegionsMultiPolygon).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  test('handles unknown region ID without throwing', async () => {
    STATE.userRegionIdsList = ['999']; // ID not in CSV fixture
    global.__mockFetchResponse(csvFixture);

    await expect(defineRegionsMultiPolygon()).resolves.not.toThrow();

    // No valid regions found — turf.multiPolygon is called with empty array
    expect(STATE.unitedUserRegionsMultiPolygon).not.toBeNull();
    expect(STATE.unitedUserRegionsMultiPolygon._mockType).toBe('multiPolygon');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Region ID not found'),
      '999'
    );
  });

  test('handles mix of valid and invalid region IDs without throwing', async () => {
    STATE.userRegionIdsList = ['1', '999', '2']; // '999' doesn't exist
    global.__mockFetchResponse(csvFixture);

    await expect(defineRegionsMultiPolygon()).resolves.not.toThrow();

    // Should still create a multiPolygon from valid regions
    expect(STATE.unitedUserRegionsMultiPolygon).not.toBeNull();
    expect(STATE.unitedUserRegionsMultiPolygon._mockType).toBe('multiPolygon');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Region ID not found'),
      '999'
    );
  });

  test('handles malformed coordinates in CSV without throwing', async () => {
    // Create a CSV with malformed coordinates for one region
    const malformedCsv = 'id;name;coords;center\n1;Valid;"[[[55.75,37.62]]]";"[55.75,37.62]"\n2;Bad;NOT_JSON;"[0,0]"';
    STATE.userRegionIdsList = ['1', '2'];
    global.__mockFetchResponse(malformedCsv);

    await expect(defineRegionsMultiPolygon()).resolves.not.toThrow();

    // Should still create a polygon from the valid region
    expect(STATE.unitedUserRegionsMultiPolygon).not.toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not parse coordinates'),
      '2'
    );
  });
});

/* ──────────────── defineUserActiveArea ──────────────── */

describe('defineUserActiveArea()', () => {
  test('creates active area from circle when both circle and regions exist', async () => {
    STATE.geodesicCirclePoints = [[55.75, 37.62], [55.76, 37.63], [55.75, 37.62]];
    STATE.unitedUserRegionsMultiPolygon = turf.polygon([[[55.75, 37.62], [55.76, 37.63], [55.75, 37.62]]]);

    await defineUserActiveArea();

    expect(STATE.userActiveArea).not.toBeNull();
    expect(turf.polygon).toHaveBeenCalled();
  });

  test('creates active area from circle only when no regions', async () => {
    STATE.geodesicCirclePoints = [[55.75, 37.62], [55.76, 37.63], [55.75, 37.62]];
    STATE.unitedUserRegionsMultiPolygon = null;

    await defineUserActiveArea();

    expect(STATE.userActiveArea).not.toBeNull();
  });

  test('creates active area from regions only when no circle', async () => {
    STATE.geodesicCirclePoints = null;
    STATE.unitedUserRegionsMultiPolygon = turf.polygon([[[55.75, 37.62], [55.76, 37.63], [55.75, 37.62]]]);

    await defineUserActiveArea();

    expect(STATE.userActiveArea).not.toBeNull();
  });

  test('leaves active area null when neither circle nor regions exist', async () => {
    STATE.geodesicCirclePoints = null;
    STATE.unitedUserRegionsMultiPolygon = null;

    await defineUserActiveArea();

    expect(STATE.userActiveArea).toBeNull();
  });
});

/* ──────────────── findBounds ──────────────── */

describe('findBounds()', () => {
  test('calculates bounds from home, markers, and active area', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];
    STATE.userSearchesList = [
      { coords: [55.76, 37.63] },
      { coords: [55.77, 37.64] },
    ];
    STATE.userActiveArea = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[55.75, 37.62], [55.76, 37.63], [55.77, 37.64], [55.75, 37.62]]],
      },
    };

    findBounds();

    expect(STATE.boundaries.show).toBe(true);
    expect(STATE.boundaries.bounds).toBeDefined();
    expect(STATE.boundaries.bounds[0]).toBeDefined();
    expect(STATE.boundaries.bounds[1]).toBeDefined();
  });

  test('calculates bounds from home only when no markers or area', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];
    STATE.userSearchesList = [];
    STATE.userActiveArea = null;

    findBounds();

    // Without area points, boundaries.show should remain false
    // But bounds should still be calculated from markers (home)
    expect(STATE.boundaries.bounds).toBeDefined();
  });

  test('handles empty data gracefully', () => {
    STATE.userHomeCoordinates = null;
    STATE.userSearchesList = [];
    STATE.userActiveArea = null;

    expect(() => findBounds()).not.toThrow();
  });

  test('handles userActiveArea with missing geometry without throwing', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];
    STATE.userSearchesList = [{ coords: [55.76, 37.63] }];
    STATE.userActiveArea = {};

    expect(() => findBounds()).not.toThrow();
    expect(STATE.boundaries.bounds).toBeDefined();
  });

  test('handles userActiveArea with null geometry without throwing', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];
    STATE.userSearchesList = [{ coords: [55.76, 37.63] }];
    STATE.userActiveArea = { geometry: null };

    expect(() => findBounds()).not.toThrow();
    expect(STATE.boundaries.bounds).toBeDefined();
  });

  test('handles userActiveArea with missing coordinates without throwing', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];
    STATE.userSearchesList = [{ coords: [55.76, 37.63] }];
    STATE.userActiveArea = {
      geometry: {
        type: 'Polygon',
      },
    };

    expect(() => findBounds()).not.toThrow();
    expect(STATE.boundaries.bounds).toBeDefined();
  });

  test('handles userActiveArea with empty coordinates array without throwing', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];
    STATE.userSearchesList = [{ coords: [55.76, 37.63] }];
    STATE.userActiveArea = {
      geometry: {
        type: 'Polygon',
        coordinates: [],
      },
    };

    expect(() => findBounds()).not.toThrow();
    expect(STATE.boundaries.bounds).toBeDefined();
  });
});

/* ──────────────── addScrollControl ──────────────── */

describe('addScrollControl()', () => {
  test('prevents default on swipe down from top of page', () => {
    addScrollControl();

    const touchStartEvent = new Event('touchstart', { cancelable: true });
    touchStartEvent.touches = [{ clientY: 20 }];
    document.dispatchEvent(touchStartEvent);

    const touchMoveEvent = new Event('touchmove', { cancelable: true });
    touchMoveEvent.touches = [{ clientY: 150 }];
    const preventDefaultSpy = jest.spyOn(touchMoveEvent, 'preventDefault');
    document.dispatchEvent(touchMoveEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    preventDefaultSpy.mockRestore();
  });

  test('does not prevent default on swipe up', () => {
    addScrollControl();

    const touchStartEvent = new Event('touchstart', { cancelable: true });
    touchStartEvent.touches = [{ clientY: 200 }];
    document.dispatchEvent(touchStartEvent);

    const touchMoveEvent = new Event('touchmove', { cancelable: true });
    touchMoveEvent.touches = [{ clientY: 100 }];
    const preventDefaultSpy = jest.spyOn(touchMoveEvent, 'preventDefault');
    document.dispatchEvent(touchMoveEvent);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    preventDefaultSpy.mockRestore();
  });

  test('does not prevent default on swipe down from bottom of page', () => {
    addScrollControl();

    const touchStartEvent = new Event('touchstart', { cancelable: true });
    touchStartEvent.touches = [{ clientY: 500 }];
    document.dispatchEvent(touchStartEvent);

    const touchMoveEvent = new Event('touchmove', { cancelable: true });
    touchMoveEvent.touches = [{ clientY: 600 }];
    const preventDefaultSpy = jest.spyOn(touchMoveEvent, 'preventDefault');
    document.dispatchEvent(touchMoveEvent);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    preventDefaultSpy.mockRestore();
  });
});

/* ──────────────── defineGeodesicCirclePoints ──────────────── */

describe('defineGeodesicCirclePoints()', () => {
  test('calculates geodesic circle points when home coordinates and radius are set', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];
    STATE.userRadius = 50; // 50 km

    defineGeodesicCirclePoints();

    expect(STATE.geodesicCirclePoints).not.toBeNull();
    expect(STATE.geodesicCirclePoints.length).toBeGreaterThan(0);
    expect(ymaps.coordSystem.geo.solveDirectProblem).toHaveBeenCalled();
  });

  test('does nothing when home coordinates are not set', () => {
    STATE.userHomeCoordinates = null;
    STATE.userRadius = 50;

    defineGeodesicCirclePoints();

    expect(STATE.geodesicCirclePoints).toBeNull();
  });

  test('does nothing when radius is not set', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];
    STATE.userRadius = null;

    defineGeodesicCirclePoints();

    expect(STATE.geodesicCirclePoints).toBeNull();
  });

  test('closes the polygon ring', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];
    STATE.userRadius = 50;

    defineGeodesicCirclePoints();

    const points = STATE.geodesicCirclePoints;
    const first = points[0];
    const last = points[points.length - 1];
    expect(first[0]).toBe(last[0]);
    expect(first[1]).toBe(last[1]);
  });
});

/* ──────────────── addCurvedCircle ──────────────── */

describe('addCurvedCircle()', () => {
  test('creates a circle when radius <= 2000 and home coordinates are set', () => {
    STATE.userRadius = 50; // 50 km — <= 2000
    STATE.userHomeCoordinates = [55.75, 37.62];

    addCurvedCircle();

    expect(ymaps.Circle).toHaveBeenCalled();
    expect(STATE.userCircle).toBeDefined();
  });

  test('does not create a circle when radius > 2000', () => {
    STATE.userRadius = 2500; // > 2000
    STATE.userHomeCoordinates = [55.75, 37.62];

    addCurvedCircle();

    expect(ymaps.Circle).not.toHaveBeenCalled();
    expect(STATE.userCircle).toBeNull();
  });

  test('does not create a circle when home coordinates are not set', () => {
    STATE.userRadius = 50;
    STATE.userHomeCoordinates = null;

    addCurvedCircle();

    expect(ymaps.Circle).not.toHaveBeenCalled();
    expect(STATE.userCircle).toBeNull();
  });
});

/* ──────────────── addHome ──────────────── */

describe('addHome()', () => {
  test('adds a placemark when home coordinates are set', () => {
    STATE.userHomeCoordinates = [55.75, 37.62];

    addHome();

    expect(ymaps.Placemark).toHaveBeenCalledWith(
      [55.75, 37.62],
      expect.objectContaining({
        balloonContent: expect.any(String),
      }),
      expect.objectContaining({
        preset: 'islands#governmentCircleIcon',
      })
    );
  });

  test('does not add a placemark when home coordinates are null', () => {
    STATE.userHomeCoordinates = null;

    addHome();

    expect(ymaps.Placemark).not.toHaveBeenCalled();
  });
});

/* ──────────────── addFogOnMap ──────────────── */

describe('addFogOnMap()', () => {
  test('creates fog polygon with cutout when userActiveArea exists', () => {
    STATE.userActiveArea = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[55.75, 37.62], [55.76, 37.63], [55.77, 37.64], [55.75, 37.62]]],
      },
    };

    addFogOnMap();

    expect(ymaps.GeoObject).toHaveBeenCalled();
  });

  test('creates fog polygon without cutout when userActiveArea is null', () => {
    STATE.userActiveArea = null;

    addFogOnMap();

    expect(ymaps.GeoObject).toHaveBeenCalled();
  });

  test('handles userActiveArea with missing geometry without throwing', () => {
    STATE.userActiveArea = { noGeometry: true };

    expect(() => addFogOnMap()).not.toThrow();
    expect(ymaps.GeoObject).toHaveBeenCalled();
  });

  test('handles userActiveArea with null geometry without throwing', () => {
    STATE.userActiveArea = { geometry: null };

    expect(() => addFogOnMap()).not.toThrow();
    expect(ymaps.GeoObject).toHaveBeenCalled();
  });

  test('handles userActiveArea with missing coordinates without throwing', () => {
    STATE.userActiveArea = {
      geometry: {
        type: 'Polygon',
      },
    };

    expect(() => addFogOnMap()).not.toThrow();
    expect(ymaps.GeoObject).toHaveBeenCalled();
  });

  test('handles userActiveArea with empty coordinates array without throwing', () => {
    STATE.userActiveArea = {
      geometry: {
        type: 'Polygon',
        coordinates: [],
      },
    };

    expect(() => addFogOnMap()).not.toThrow();
    expect(ymaps.GeoObject).toHaveBeenCalled();
  });
});

/* ──────────────── addMarker ──────────────── */

describe('addMarker()', () => {
  test('creates green marker for active + exact search', () => {
    const record = {
      name: 'test',
      display_name: 'Test',
      coords: [55.75, 37.62],
      search_is_old: false,
      exact_coords: true,
      search_status: 'АКТИВЕН',
    };

    addMarker(record);

    expect(ymaps.GeoObject).toHaveBeenCalled();
    expect(STATE.markers['test']).toBeDefined();
  });

  test('creates orange marker for active non-exact search', () => {
    const record = {
      name: 'test2',
      display_name: 'Test2',
      coords: [55.76, 37.63],
      search_is_old: false,
      exact_coords: false,
      search_status: 'АКТИВЕН',
    };

    addMarker(record);

    expect(ymaps.GeoObject).toHaveBeenCalled();
    expect(STATE.markers['test2']).toBeDefined();
  });

  test('creates grey marker for old search', () => {
    const record = {
      name: 'test3',
      display_name: 'Test3',
      coords: [55.77, 37.64],
      search_is_old: true,
      exact_coords: false,
      search_status: 'СТОП',
    };

    addMarker(record);

    expect(ymaps.GeoObject).toHaveBeenCalled();
    expect(STATE.markers['test3']).toBeDefined();
  });
});
