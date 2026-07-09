/**
 * Shared type definitions for LA Searcher Map.
 *
 * This file contains ONLY JSDoc type-definition blocks -- no runtime code.
 * It is loaded first in index.html so all subsequent modules can reference
 * these types in their JSDoc annotations.
 *
 * TypeScript checking: run `npm run typecheck` to validate types statically.
 */

/**
 * A single search record from the API response.
 *
 * @typedef {Object} SearchRecord
 * @property {string} name - Internal search ID (e.g., "12345").
 * @property {string} display_name - Human-readable name (e.g., "Иванов Иван, 1978 г.р.").
 * @property {Array<number>} coords - [lat, lng] coordinates.
 * @property {string} [link] - URL to the forum thread.
 * @property {string} [search_type] - Type of search (e.g., "лес", "город").
 * @property {string} [search_status] - Current status (e.g., "Активен", "СТОП").
 * @property {boolean} [search_is_old] - Whether the search is older/archived.
 * @property {boolean} [exact_coords] - Whether coordinates are exact.
 * @property {string} [freshness] - Human-readable time since last update.
 * @property {string} [content] - HTML description content for the info panel.
 */

/**
 * Parsed user data object from the API response.
 *
 * @typedef {Object} UserData
 * @property {Object} params - User parameters.
 * @property {number} params.home_lat - Home latitude.
 * @property {number} params.home_lon - Home longitude.
 * @property {number} params.radius - Search radius in kilometers.
 * @property {Array<string|number>} params.regions - List of region IDs assigned to the user.
 * @property {Array<SearchRecord>} params.searches - List of search records.
 */

/**
 * Centralized application state — all mutable global variables.
 *
 * @typedef {Object} AppState
 * @property {Array<number>|null} userHomeCoordinates - [lat, lng] home coordinates.
 * @property {number|null} userRadius - Search radius in kilometers.
 * @property {Array<string|number>} userRegionIdsList - Region IDs assigned to the user.
 * @property {Array<number>|null} currentUserLocation - [lat, lng] current geolocation.
 * @property {Array<number>|null} startingPoint - [lat, lng] route starting point.
 * @property {Array<SearchRecord>} userSearchesList - All search records from the API.
 * @property {Object|null} userCircle - ymaps.Circle instance for the home radius.
 * @property {Object|null} turfCircle - Turf.js polygon for the geodesic circle.
 * @property {Object|null} unitedUserRegionsMultiPolygon - Turf.js multipolygon of user regions.
 * @property {Array<Object>} listOfRegionObjects - Array of Turf.js polygon objects per region.
 * @property {Object|null} userActiveArea - Turf.js polygon of the active search area.
 * @property {{show: boolean, bounds: (Array<Array<number>>|null)}} boundaries - Map bounds state.
 * @property {Array<Array<number>>|null} geodesicCirclePoints - Calculated circle perimeter points.
 * @property {Object|null} BalloonContentLayout - Yandex Maps balloon layout class.
 * @property {Array<Object>} allRoutes - Active ymaps.multiRouter.MultiRoute instances.
 * @property {Object<string, Object>} markers - Map of marker name to ymaps.GeoObject.
 * @property {number|null} balloonMaxWidth - Maximum balloon width in pixels.
 * @property {Array<Array<number>>|null} polygonForTurf - Polygon ring for Turf operations.
 * @property {string|null} regionsCsvText - Raw CSV text of region data.
 */

/**
 * A parsed CSV record from the regions CSV file.
 *
 * @typedef {Object} CsvRecord
 * @property {string} id - Region ID.
 * @property {string} region - Region name.
 * @property {string} coords - Raw coordinate string (JSON array).
 * @property {string} coords_type - Type: "ru_regions_points" or "ru_regions_poly".
 */

/**
 * Theme configuration object.
 *
 * @typedef {Object} ThemeConfig
 * @property {Object} dark - Dark theme settings.
 * @property {string} dark.bg - Background color for dark theme.
 * @property {string} dark.loaderColor - Loader color for dark theme.
 * @property {Object} light - Light theme settings.
 * @property {string|null} light.bg - Background color for light theme (null = default).
 * @property {string} light.loaderColor - Loader color for light theme.
 */

// Note: No `export {}` here — this file is loaded as a <script> tag in the browser,
// so it must remain a global-scope script, not an ES module.
// TypeScript picks up @typedef from .js files via checkJs: true automatically.
