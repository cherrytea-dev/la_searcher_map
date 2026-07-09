/**
 * Core map module for LA Searcher Map.
 *
 * Initializes and manages the Yandex Maps instance, renders search markers,
 * draws geodesic circles, computes region-based active areas, and handles
 * route planning.
 *
 * This file is loaded dynamically by telegram.js after the Yandex Maps API
 * and all prerequisites are ready. All code runs inside ymaps.ready().
 *
 * Dependencies (global scope):
 *   - ymaps (Yandex Maps API 2.1)
 *   - turf (Turf.js for geospatial calculations)
 *   - $ (jQuery 2.2.3)
 *   - userData (from telegram.js)
 *   - userTheme (from telegram.js)
 *   - createInfoPanel (from info_panel.js)
 *   - createDescriptionPanel (from description_panel.js)
 *   - declareBalloonClass (from balloon.js)
 *   - createCityListBox (from controls.js)
 */

/* ──────────────── Application State ──────────────── */

/**
 * Centralized application state — all mutable global variables live here
 * to avoid scattered declarations and to make state flow explicit.
 * @type {AppState}
 */
const STATE = {
    userHomeCoordinates: null,
    userRadius: null,
    userRegionIdsList: [],
    currentUserLocation: null,
    startingPoint: null,
    userSearchesList: [],
    userCircle: null,
    turfCircle: null,
    unitedUserRegionsMultiPolygon: null,
    listOfRegionObjects: [],
    userActiveArea: null,
    boundaries: { show: false, bounds: null },
    geodesicCirclePoints: null,
    BalloonContentLayout: null,
    allRoutes: [],
    markers: {},
    balloonMaxWidth: null,
    polygonForTurf: null,
    regionsCsvText: null,
};

/* ──────────────── Constants ──────────────── */

/** @type {[number, number]} Default map center (Moscow). */
const DEFAULT_CENTER_COORDINATES = [55.75254, 37.623082];
/** @type {number} Coefficient to shrink bounds around the active area. */
const BOUNDARIES_SHRINK_COEFFICIENT = 0.2;
/** @type {number} Coefficient to expand bounds around markers. */
const BOUNDARIES_EXPAND_COEFFICIENT = 0;
/** @type {number} Northern boundary for geodesic circle clamping. */
const COUNTRY_BOUNDARY_NORTH = 70;
/** @type {number} Southern boundary for geodesic circle clamping. */
const COUNTRY_BOUNDARY_SOUTH = 41;
/** @type {number} Western boundary for geodesic circle clamping. */
const COUNTRY_BOUNDARY_WEST = 20;
/** @type {number} Eastern boundary for geodesic circle clamping. */
const COUNTRY_BOUNDARY_EAST = 180;
/** @type {[[number, number], [number, number]]} Restricted map panning area. */
const RESTRICTED_MAP_AREA = [[82.23618, -90], [-73.87011, 181]];
/** @type {string} Color for inactive route strokes. */
const MARKER_COLOR_INACTIVE = '#FF6600';
/** @type {string} Color for active route strokes. */
const MARKER_COLOR_ACTIVE = '#ff3300';
/** @type {number} Balloon width as a fraction of map container width. */
const BALLOON_RELATIVE_WIDTH = 0.75;
/** @type {string} Custom dark map type key. */
const DARK_MAP = 'custom#dark';
/** @type {number} Number of segments for geodesic circle approximation. */
const GEODESIC_CIRCLE_SEGMENTS = 72;
/** @type {number} Maximum home radius in kilometers. */
const MAX_RADIUS_KM = 2000;
/** @type {number} Rotation degrees for marker spiral sorting. */
const MARKER_SORT_ROTATION_DEG = 15;
/** @type {number} Touch scroll threshold in pixels from top. */
const SCROLL_THRESHOLD_PX = 100;

/* ──────────────── Theme ──────────────── */

/** @type {string} Fog overlay fill color. */
let fogColor = 'rgb(255, 255, 255)';
/** @type {string} Fog overlay border color. */
let forBorderColor = 'rgb(255, 255, 255)';

/**
 * Registers the custom dark Yandex map style if the user theme is dark.
 * Must be called before initMap().
 * @returns {void}
 */
function addDarkTheme() {
    if (userTheme === 'dark') {
        ymaps.layer.storage.add(DARK_MAP, function DarkLayer() {
            return new ymaps.Layer(
                'https://core-renderer-tiles.maps.yandex.net/tiles?l=map&theme=dark&%c&%l&scale={{ scale }}'
            );
        });

        ymaps.mapType.storage.add(DARK_MAP, new ymaps.MapType('Dark Map', [DARK_MAP]));
    }
}

/* ──────────────── Map Initialization ──────────────── */

/**
 * Creates the Yandex Map instance with restricted bounds and
 * computes the balloon max width based on the map container size.
 * @returns {void}
 */
function initMap() {
    const center = STATE.userHomeCoordinates || DEFAULT_CENTER_COORDINATES;
    const mapParams = {
        center,
        zoom: 9,
        controls: [],
    };

    if (userTheme === 'dark') {
        mapParams.type = DARK_MAP;
    }

    map = new ymaps.Map('map', mapParams, {
        restrictMapArea: RESTRICTED_MAP_AREA,
        suppressMapOpenBlock: true,
    });

    const mapElement = document.getElementById('map');
    STATE.balloonMaxWidth = Math.round(mapElement.offsetWidth * BALLOON_RELATIVE_WIDTH);
}

/* ──────────────── Controls ──────────────── */

/**
 * Adds all map controls: geolocation, traffic, info button, zoom, city listbox.
 * @returns {void}
 */
function addControls() {
    const geolocationControl = new ymaps.control.GeolocationControl({
        options: {
            layout: 'round#buttonLayout',
        },
    });

    geolocationControl.events.add('locationchange', function (event) {
        const position = event.get('position');
        STATE.currentUserLocation = position;
        console.log("User's location updated: Latitude =", position[0], "Longitude =", position[1]);
    });

    const trafficControl = new ymaps.control.TrafficControl({
        state: { trafficShown: false },
        options: {
            size: 'small',
            float: 'left',
        },
    });

    const infoControl = new ymaps.control.Button({
        data: {
            title: 'О карте',
            content: 'О карте',
        },
        options: {
            layout: 'round#buttonLayout',
            maxWidth: 120,
            float: 'left',
        },
    });

    infoControl.events.add('click', function () {
        createInfoPanel();
        setTimeout(function () {
            infoControl.state.set('selected', false);
        }, 10);
    });

    map.controls.add(geolocationControl);
    map.controls.add(trafficControl);
    map.controls.add(infoControl);

    const zoomControl = new ymaps.control.ZoomControl({
        options: {
            layout: 'round#zoomLayout',
        },
    });

    map.controls.add(zoomControl);

    // FIXME – trying to catch what "open in yandex" does
    const ymapsLink = document.querySelector('.ymaps-2-1-79-gotoymaps');
    if (ymapsLink) {
        ymapsLink.addEventListener('click', (event) => {
            console.log('Yandex Maps link clicked!');
            event.preventDefault();
            console.log(event);
        });
    } else {
        console.log('Yandex Maps link not found');
    }
    // FIXME ^^^

    const cityListBox = createCityListBox();
    if (cityListBox) {
        map.controls.add(cityListBox);
    }
}

/**
 * Adds a dropdown list for filtering search types (active / all new / all actual).
 * @returns {void}
 */
function addDropDownListOfSearchTypes() {
    const listItems = [
        new ymaps.control.ListBoxItem('Только активные'),
        new ymaps.control.ListBoxItem('Все новые за 10 дней'),
        new ymaps.control.ListBoxItem('Все актуальные за 60 дней'),
    ];

    const myListBox = new ymaps.control.ListBox({
        data: {
            content: 'Выбрать отображаемые поиски',
        },
        items: listItems,
        options: {
            float: 'left',
        },
    });

    map.controls.add(myListBox);
}

/* ──────────────── Polygon Helpers ──────────────── */

/**
 * Ensures a polygon ring is closed (first point === last point).
 * Mutates the array in place if needed.
 * @param {Array<number[]>} ring - Array of [lat, lng] points.
 * @returns {Array<number[]>} The same ring, now closed.
 */
function closePolygonRing(ring) {
    if (!ring || ring.length === 0) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push(first);
    }
    return ring;
}

/* ──────────────── Geodesic Circle ──────────────── */

/**
 * Draws the user's home radius circle on the map (if radius <= MAX_RADIUS_KM).
 * @returns {void}
 */
function addCurvedCircle() {
    if (STATE.userRadius && STATE.userHomeCoordinates && STATE.userRadius <= MAX_RADIUS_KM) {
        STATE.userCircle = new ymaps.Circle(
            [STATE.userHomeCoordinates, STATE.userRadius * 1000],
            {},
            {
                draggable: false,
                fill: false,
                cursor: 'grab',
                strokeColor: forBorderColor,
                strokeOpacity: 0.8,
                strokeWidth: 3,
                geodesic: true,
            }
        );
        map.geoObjects.add(STATE.userCircle);
    }
}

/**
 * Calculates geodesic circle points using Yandex coordinate system.
 * Stores the result in STATE.geodesicCirclePoints.
 * @returns {void}
 */
function defineGeodesicCirclePoints() {
    if (STATE.userHomeCoordinates && STATE.userRadius) {
        const startPoint = STATE.userHomeCoordinates;
        const degreeStep = 360 / GEODESIC_CIRCLE_SEGMENTS;
        const radius = STATE.userRadius * 1000;

        const points = [];

        for (let i = 0; i <= GEODESIC_CIRCLE_SEGMENTS; i++) {
            const azimuth = (Math.PI / 180) * (degreeStep * i);
            const direction = [Math.cos(azimuth), Math.sin(azimuth)];
            const destination = ymaps.coordSystem.geo.solveDirectProblem(startPoint, direction, radius).endPoint;

            if (destination[1] > COUNTRY_BOUNDARY_EAST) destination[1] = COUNTRY_BOUNDARY_EAST;
            if (destination[1] < COUNTRY_BOUNDARY_WEST) destination[1] = COUNTRY_BOUNDARY_WEST;
            if (destination[0] > COUNTRY_BOUNDARY_NORTH) destination[0] = COUNTRY_BOUNDARY_NORTH;
            if (destination[0] < COUNTRY_BOUNDARY_SOUTH) destination[0] = COUNTRY_BOUNDARY_SOUTH;

            points.push(destination);
        }

        closePolygonRing(points);
        STATE.geodesicCirclePoints = points;
    }
}

/**
 * Draws the geodesic circle as a polygon on the map.
 * @returns {void}
 */
function drawGeodesicCircle() {
    if (STATE.geodesicCirclePoints) {
        const polygon = new ymaps.Polygon([STATE.geodesicCirclePoints]);
        map.geoObjects.add(polygon);
    }
}

/* ──────────────── CSV / Region Parsing ──────────────── */

/**
 * Finds a record in CSV text by ID.
 * @param {string} csvText - Raw CSV text (semicolon-delimited).
 * @param {string|number} id - The ID to search for.
 * @returns {Object|null} Parsed record object, or null if not found.
 */
function findRecordById(csvText, id) {
    const rows = csvText.split('\n');
    const headers = rows[0].split(';');
    const idIndex = headers.indexOf('id');

    for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].split(';');
        if (cells[idIndex] == id) {
            return cells.reduce((obj, cell, index) => {
                obj[headers[index]] = cell;
                return obj;
            }, {});
        }
    }
    return null;
}

/**
 * Parses a coordinate string (JSON) into an array.
 * @param {string} coordsString - Raw coordinate string, possibly with surrounding quotes.
 * @returns {Array|null} Parsed coordinate array, or null on failure.
 */
function convertCoordsStringToArray(coordsString) {
    const formattedString = coordsString.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"');
    try {
        return JSON.parse(formattedString);
    } catch (e) {
        console.error('Error parsing coordinates:', e);
        return null;
    }
}

/**
 * Extracts all polygon rings from a region's coordinate array.
 *
 * A single polygon has structure: [[[lat,lon], ...]] — returns one ring.
 * A multi-polygon has structure: [[[lat,lon], ...], [[lat,lon], ...], ...] — returns multiple rings.
 *
 * @param {Array} coordsArray - Coordinate array from CSV.
 * @returns {Array<Array<Array<number>>>} Array of rings, where each ring is an array of [lat, lon] pairs.
 */
function extractAllRings(coordsArray) {
    if (coordsArray.length > 1 && Array.isArray(coordsArray[0][0])) {
        return coordsArray;
    }
    return [coordsArray[0]];
}

/**
 * Fetches the regions CSV, parses it, and builds a Turf multipolygon
 * from the user's selected regions. Stores result in STATE.unitedUserRegionsMultiPolygon.
 * @returns {Promise<void>}
 */
async function defineRegionsMultiPolygon() {
    const csvPath = 'data/regions_from_yandex.csv';
    try {
        const response = await fetch(csvPath);
        const csvText = await response.text();
        STATE.regionsCsvText = csvText;
        let allRings = [];

        STATE.userRegionIdsList.forEach((regionId) => {
            console.log('user region id: ', regionId);
            const regionRecordInCSV = findRecordById(csvText, regionId);
            if (!regionRecordInCSV) {
                console.warn('Region ID not found in CSV:', regionId);
                return;
            }
            const regionCoordinatesListInCSV = convertCoordsStringToArray(regionRecordInCSV.coords);
            if (!regionCoordinatesListInCSV) {
                console.warn('Could not parse coordinates for region ID:', regionId);
                return;
            }
            const rings = extractAllRings(regionCoordinatesListInCSV);
            rings.forEach((ring) => {
                STATE.listOfRegionObjects.push(turf.polygon([ring]));
            });
            allRings = allRings.concat(rings);
        });

        if (allRings.length === 1) {
            STATE.unitedUserRegionsMultiPolygon = turf.polygon([allRings[0]]);
        } else {
            const multiPolygonCoords = allRings.map((ring) => [ring]);
            STATE.unitedUserRegionsMultiPolygon = turf.multiPolygon(multiPolygonCoords);
        }
    } catch (error) {
        console.error('Error fetching CSV:', error);
    }
}

/* ──────────────── Active Area & Fog ──────────────── */

/**
 * Extracts the coordinate ring from the user's active area for Turf operations.
 * Ensures the ring is closed (first point === last point).
 * @returns {void}
 */
function createPolygonForTurf() {
    console.log('userActiveArea', STATE.userActiveArea);

    if (!STATE.userActiveArea) {
        STATE.polygonForTurf = null;
        return;
    }

    if (STATE.userActiveArea.geometry.type === 'MultiPolygon') {
        STATE.polygonForTurf = STATE.userActiveArea.geometry.coordinates[0][0];
    } else {
        STATE.polygonForTurf = STATE.userActiveArea.geometry.coordinates[0];
    }
    console.log('polygonForTurf 0', STATE.polygonForTurf);

    closePolygonRing(STATE.polygonForTurf);
    console.log('polygonForTurf 1', STATE.polygonForTurf);
}

/**
 * Computes the user's active search area by intersecting the geodesic circle
 * with the user's region polygons. Stores result in STATE.userActiveArea.
 * @returns {Promise<void>}
 */
async function defineUserActiveArea() {
    if (STATE.geodesicCirclePoints) {
        STATE.turfCircle = turf.polygon([STATE.geodesicCirclePoints]);
        console.log('turfCircle', STATE.turfCircle);
    }

    if (STATE.turfCircle && STATE.unitedUserRegionsMultiPolygon) {
        console.log('unitedUserRegionsMultiPolygon: ', STATE.unitedUserRegionsMultiPolygon);
        STATE.userActiveArea = STATE.turfCircle;
        createPolygonForTurf();
        if (STATE.polygonForTurf) {
            STATE.userActiveArea = turf.polygon([STATE.polygonForTurf]);
        }
    } else if (STATE.turfCircle || STATE.unitedUserRegionsMultiPolygon) {
        STATE.userActiveArea = STATE.turfCircle || STATE.unitedUserRegionsMultiPolygon;
        createPolygonForTurf();
        if (STATE.polygonForTurf) {
            STATE.userActiveArea = turf.polygon([STATE.polygonForTurf]);
        }
        console.log('userActiveArea', STATE.userActiveArea);
    }
}

/**
 * Adds a semi-transparent "fog" overlay on the map with a cutout
 * for the user's active search area.
 * @returns {void}
 */
function addFogOnMap() {
    let cutOutArea = null;
    if (
        STATE.userActiveArea &&
        STATE.userActiveArea.geometry &&
        STATE.userActiveArea.geometry.coordinates &&
        STATE.userActiveArea.geometry.coordinates[0]
    ) {
        cutOutArea = STATE.userActiveArea.geometry.coordinates[0];
    }

    const polygonFeature = new ymaps.GeoObject(
        {
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [85, -100], [85, 0], [85, 100], [85, 180],
                        [85, -110], [-85, -110], [-85, 180],
                        [-85, 100], [-85, 0], [-85, -100], [85, -100],
                    ],
                    cutOutArea,
                ],
            },
        },
        {
            fillColor: fogColor,
            fillOpacity: 0.5,
            strokeWidth: 3,
            strokeColor: forBorderColor,
            strokeOpacity: 0.8,
            cursor: 'drag',
        }
    );
    map.geoObjects.add(polygonFeature);
}

/* ──────────────── Home Marker ──────────────── */

/**
 * Adds a home marker at the user's home coordinates.
 * @returns {void}
 */
function addHome() {
    if (STATE.userHomeCoordinates) {
        map.geoObjects.add(
            new ymaps.Placemark(
                STATE.userHomeCoordinates,
                {
                    balloonContent:
                        'Домашние координаты. Внимание, это не ваша текущая позиция, ' +
                        'а фиксированная точка, которую вы задали в Боте как "Домашние координаты"',
                },
                {
                    preset: 'islands#governmentCircleIcon',
                    iconColor: 'lightgrey',
                }
            )
        );
    }
}

/* ──────────────── Bounds Calculation ──────────────── */

/**
 * Calculates bounding box from an array of [lat, lng] points,
 * applying a shrink/expand coefficient.
 *
 * @param {Array<number[]>} points - Array of [lat, lng] coordinates.
 * @param {number} [coefficient=0] - Shrink (negative) or expand (positive) coefficient.
 * @returns {Array<number[]>|null} [[lat_min, lon_min], [lat_max, lon_max]] or null.
 */
function calculateBoundsFromPoints(points, coefficient = 0) {
    if (!points || points.length === 0) return null;

    // Guard: ensure points are coordinate pairs, not flat numbers
    if (!Array.isArray(points[0]) || typeof points[0][0] !== 'number') {
        return null;
    }

    let lonMin = points[0][1];
    let lonMax = points[0][1];
    let latMin = points[0][0];
    let latMax = points[0][0];

    for (let i = 1; i < points.length; i++) {
        const point = points[i];
        if (!Array.isArray(point) || point.length < 2) continue;
        const [lat, lon] = point;
        if (lon < lonMin) lonMin = lon;
        if (lon > lonMax) lonMax = lon;
        if (lat < latMin) latMin = lat;
        if (lat > latMax) latMax = lat;
    }

    const lonRange = (lonMax - lonMin) * coefficient;
    const latRange = (latMax - latMin) * coefficient;

    return [
        [latMin - latRange, lonMin - lonRange],
        [latMax + latRange, lonMax + lonRange],
    ];
}

/**
 * Calculates optimal map bounds to fit all markers and the active area.
 * Stores result in STATE.boundaries.
 * @returns {void}
 */
function findBounds() {
    // Collect marker coordinates (home + search records)
    const markerPoints = [];
    if (STATE.userHomeCoordinates) {
        markerPoints.push(STATE.userHomeCoordinates);
    }
    STATE.userSearchesList.forEach((marker) => {
        markerPoints.push(marker.coords);
    });

    // Collect area polygon points
    const areaPoints = [];
    if (
        STATE.userActiveArea &&
        STATE.userActiveArea.geometry &&
        STATE.userActiveArea.geometry.coordinates &&
        STATE.userActiveArea.geometry.coordinates[0] &&
        STATE.userActiveArea.geometry.coordinates[0].length !== 0
    ) {
        STATE.userActiveArea.geometry.coordinates[0].forEach((point) => {
            areaPoints.push(point);
        });
    }

    // Calculate bounds for area (with shrink) and markers (with expand)
    const areaBounds = calculateBoundsFromPoints(areaPoints, BOUNDARIES_SHRINK_COEFFICIENT);
    const markerBounds = calculateBoundsFromPoints(markerPoints, BOUNDARIES_EXPAND_COEFFICIENT);

    // Prefer area bounds, fall back to marker bounds
    const finalBounds = areaBounds || markerBounds;

    STATE.boundaries.show = areaBounds !== null || markerBounds !== null;
    STATE.boundaries.bounds = finalBounds;
    console.log('bounds', STATE.boundaries.bounds);
}

/**
 * Animates the map to the calculated bounds.
 * @returns {void}
 */
function setBounds() {
    if (STATE.boundaries.show === true) {
        map.setBounds(STATE.boundaries.bounds, { duration: 600 });
    }
}

/* ──────────────── Marker Sorting ──────────────── */

/**
 * Sorts markers by priority (active+exact > active > old) then by
 * rotated Y coordinate for a spiral-like visual ordering.
 * @returns {void}
 */
function sortMarkers() {
    const radians = MARKER_SORT_ROTATION_DEG * (Math.PI / 180);
    const cosValue = Math.cos(radians);
    const sinValue = Math.sin(radians);

    STATE.userSearchesList.sort((a, b) => {
        const getPriority = (element) => {
            if (element.search_is_old !== true && element.exact_coords === true) return 3;
            if (element.search_is_old !== true && element.exact_coords !== true) return 2;
            return 1;
        };

        const aPriority = getPriority(a);
        const bPriority = getPriority(b);

        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }

        // Same priority — sort by rotated Y coordinate (descending)
        const aCoords = a.coords;
        const bCoords = b.coords;
        const aNew = aCoords[1] * cosValue - aCoords[0] * sinValue;
        const bNew = bCoords[1] * cosValue - bCoords[0] * sinValue;
        return bNew - aNew;
    });
}

/* ──────────────── Markers ──────────────── */

/**
 * Creates a color-coded marker for a search record and adds it to the map.
 *
 * Color logic:
 *   - Green: active + exact coordinates
 *   - Orange: active (but not exact)
 *   - Grey: old / archived
 *
 * @param {SearchRecord} record - A search record from the API.
 * @returns {void}
 */
function addMarker(record) {
    declareBalloonClass(record);

    let preset;
    if (record.search_is_old) {
        preset = 'islands#grayIcon';
    } else if (record.exact_coords && record.search_status !== 'СТОП') {
        preset = 'islands#greenStretchyIcon';
    } else {
        preset = 'islands#orangeStretchyIcon';
    }

    const iconContent = record.search_is_old ? null : `${record.display_name}`;

    const marker = new ymaps.GeoObject(
        {
            geometry: {
                type: 'Point',
                coordinates: record.coords,
            },
            properties: {
                iconContent: iconContent,
                coordinates: record.coords,
                markerDisplayName: record.display_name,
                markerFreshness: record.freshness,
                markerLink: record.link,
                markerTopicType: record.search_type,
                record: record,
            },
        },
        {
            preset: preset,
            balloonContentLayout: STATE.BalloonContentLayout,
            balloonPanelMaxMapArea: 0,
            balloonMaxWidth: STATE.balloonMaxWidth,
        }
    );
    STATE.markers[record.name] = marker;
    map.geoObjects.add(marker);
}

/**
 * Adds user's current location markers (Yandex + browser geolocation).
 * @returns {void}
 */
function addUserCurrentLocation() {
    const geolocation = ymaps.geolocation;

    geolocation
        .get({
            provider: 'yandex',
            mapStateAutoApply: true,
        })
        .then(function (result) {
            result.geoObjects.options.set('preset', 'islands#redCircleIcon');
            result.geoObjects.get(0).properties.set({
                balloonContentBody: 'Мое местоположение',
            });
            map.geoObjects.add(result.geoObjects);
        });

    geolocation
        .get({
            provider: 'browser',
            mapStateAutoApply: true,
        })
        .then(function (result) {
            result.geoObjects.options.set('preset', 'islands#blueCircleIcon');
            map.geoObjects.add(result.geoObjects);
        });
}

/* ──────────────── Routes ──────────────── */

/**
 * Creates a Yandex MultiRoute from a starting point to a search record's coordinates,
 * with traffic and via-point toggle buttons.
 *
 * @param {SearchRecord} record - The search record (destination).
 * @param {Object} marker - The ymaps marker object for the destination.
 * @param {Array<number>} startingPoint - [lat, lng] start coordinates.
 * @returns {void}
 */
function addRoute(record, marker, startingPoint) {
    const multiRoute = new ymaps.multiRouter.MultiRoute(
        {
            referencePoints: [startingPoint, record.coords],
            params: { results: 1 },
        },
        {
            boundsAutoApply: false,
            wayPointVisible: false,
            routeStrokeWidth: 6,
            routeActiveStrokeWidth: 8,
            routeActiveStrokeColor: MARKER_COLOR_INACTIVE,
        }
    );

    const trafficButton = new ymaps.control.Button({
        data: { content: 'Учитывать пробки' },
        options: { selectOnClick: true },
    });
    const viaPointButton = new ymaps.control.Button({
        data: { content: 'Добавить транзитную точку' },
        options: { selectOnClick: true },
    });

    trafficButton.events.add('select', function () {
        multiRoute.model.setParams({ avoidTrafficJams: true }, true);
    });
    trafficButton.events.add('deselect', function () {
        multiRoute.model.setParams({ avoidTrafficJams: false }, true);
    });

    viaPointButton.events.add('select', function () {
        const referencePoints = multiRoute.model.getReferencePoints();
        referencePoints.splice(1, 0, 'Москва, ул. Солянка, 7');
        multiRoute.model.setReferencePoints(referencePoints, [1]);
    });
    viaPointButton.events.add('deselect', function () {
        const referencePoints = multiRoute.model.getReferencePoints();
        referencePoints.splice(1, 1);
        multiRoute.model.setReferencePoints(referencePoints, []);
    });

    map.geoObjects.add(multiRoute);
    STATE.allRoutes.push(multiRoute);

    multiRoute.events.add('activeroutechange', function () {
        const activeRoute = multiRoute.getActiveRoute();
        if (activeRoute) {
            const durationInTraffic = activeRoute.properties.get('durationInTraffic');
            if (durationInTraffic) {
                const durationElement = document.getElementById('route-duration');
                if (durationElement) {
                    durationElement.style.display = '';
                    durationElement.textContent = `${durationInTraffic.text}`;
                }

                const durationElementDefault = document.getElementById('route-duration-default');
                if (durationElementDefault) {
                    durationElementDefault.style.display = 'none';
                }

                if (record.search_is_old !== true) {
                    const newIconContent = `${record.display_name} [${durationInTraffic.text}] `;
                    marker.properties.set('iconContent', newIconContent);
                    marker.properties.set('duration', durationInTraffic);
                }

                declareBalloonClass(record);
            }
        }
    });
}

/**
 * Removes all route overlays from the map.
 * @returns {void}
 */
function removeAllRoutes() {
    STATE.allRoutes.forEach(function (route) {
        map.geoObjects.remove(route);
    });
    STATE.allRoutes = [];
}

/* ──────────────── Scroll Control ──────────────── */

/**
 * Prevents touch scroll interference with the map in Telegram.
 * @returns {void}
 */
function addScrollControl() {
    let touchStartY = 0;
    let lastTouchY = 0;
    let preventNextScroll = false;

    document.addEventListener(
        'touchstart',
        function (event) {
            touchStartY = event.touches[0].clientY;
            lastTouchY = touchStartY;
            preventNextScroll = false;
        },
        { passive: false }
    );

    document.addEventListener(
        'touchmove',
        function (event) {
            const touchY = event.touches[0].clientY;
            const isSwipeDown = touchY > lastTouchY;

            if (isSwipeDown && touchStartY < SCROLL_THRESHOLD_PX) {
                preventNextScroll = true;
            }

            lastTouchY = touchY;

            if (preventNextScroll) {
                event.preventDefault();
            }
        },
        { passive: false }
    );
}

/* ──────────────── Route Starting Point ──────────────── */

/**
 * Determines the starting point for route calculation.
 * Priority: home coordinates > current user location > alert user.
 *
 * @returns {Array<number>|null} [lat, lng] starting point, or null if unavailable.
 */
function determineStartingPoint() {
    if (STATE.userHomeCoordinates) {
        return STATE.userHomeCoordinates;
    } else if (STATE.currentUserLocation) {
        return STATE.currentUserLocation;
    } else {
        alert(
            'Для построения маршрута, пожалуйста, разрешите приложению определить ваше положение ' +
            '(кнопка в левом верхнем углу карты) ' +
            'ИЛИ введите ваши Домашние Коориднаты через меню настроек бота.'
        );
        return null;
    }
}

/* ──────────────── Initialization Phases ──────────────── */

/**
 * Phase 1: Draw the home radius circle and calculate geodesic circle points.
 * @returns {void}
 */
function drawHomeArea() {
    addCurvedCircle();
    defineGeodesicCirclePoints();
}

/**
 * Phase 2: Load region polygons from CSV and compute the user's active search area.
 * @returns {Promise<void>}
 */
async function computeActiveArea() {
    await defineRegionsMultiPolygon();
    await defineUserActiveArea();
}

/**
 * Phase 3: Render the fog overlay and home marker on the map.
 * @returns {void}
 */
function renderOverlays() {
    addFogOnMap();
    addHome();
}

/**
 * Phase 4: Calculate optimal map bounds and animate the map to fit them.
 * @returns {void}
 */
function fitMapToBounds() {
    findBounds();
    setBounds();
}

/**
 * Phase 5: Sort markers by priority and add them to the map.
 * @returns {void}
 */
function renderMarkers() {
    sortMarkers();
    STATE.userSearchesList.forEach(addMarker);
}

/* ──────────────── Application Bootstrap ──────────────── */

/**
 * Parses user data from the global `userData` object (set by telegram.js)
 * and populates the STATE object.
 *
 * @param {UserData} userData - The user data object from the API.
 * @returns {void}
 */
function parseUserData(userData) {
    if (!userData) return;

    if (userData.params.home_lat && userData.params.home_lon) {
        STATE.userHomeCoordinates = [userData.params.home_lat, userData.params.home_lon];
    }
    console.log('WE VE GOT THE HOME COORDS', STATE.userHomeCoordinates);

    STATE.userRadius = userData.params.radius;
    console.log('WE VE GOT THE RADIUS', STATE.userRadius);

    STATE.userRegionIdsList = userData.params.regions;
    console.log('WE VE GOT THE REGIONS', STATE.userRegionIdsList);

    STATE.userSearchesList = userData.params.searches;
    console.log('WE VE GOT THE SEARCHES', STATE.userSearchesList);

    // TODO – avoiding cases with several coordinates. To be redesigned in the future
    // The API returns coords as [[lat, lng], ...] — take the first set
    STATE.userSearchesList.forEach((search) => {
        if (Array.isArray(search.coords[0])) {
            search.coords = /** @type {Array<number>} */ (search.coords[0]);
        }
    });
    // TODO ^^^
}

/**
 * Applies the theme (dark/light) by setting fog and border colors.
 * Dark theme colors are set in initMap() via the map type parameter.
 * @returns {void}
 */
function applyTheme() {
    if (userTheme === 'dark') {
        fogColor = 'rgb(0, 0, 0)';
        forBorderColor = 'rgb(0, 0, 0)';
    }
}

/**
 * Main application entry point.
 * Runs inside ymaps.ready() — initializes the map, loads data, renders markers.
 * @returns {Promise<void>}
 */
async function initApp() {
    try {
        parseUserData(userData);
        applyTheme();
        addDarkTheme();
        initMap();

        drawHomeArea();
        await computeActiveArea();
        renderOverlays();
        fitMapToBounds();
        renderMarkers();
        addControls();

        document.getElementById('login_page').style.display = 'none';
    } catch (error) {
        console.error('App initialization failed:', error);
    }
}

// Start the application when Yandex Maps API is ready
ymaps.ready(initApp);
