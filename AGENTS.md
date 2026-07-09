# LizaAlert "Searcher Map" — AI Assistant Guide

> **Purpose:** This file helps AI assistants (Cline, Claude, etc.) understand the project structure, architecture, coding conventions, and key implementation details before making changes.

---

## 1. Project Overview

**LizaAlert "Searcher Map"** is a front-end interactive map application for tracking lost people searches, built for the [LizaAlert](https://lizaalert.org/) non-profit Search & Rescue organization. It displays active and recent search operations on a Yandex Maps interface, with region-based filtering, geodesic radius circles, route planning, and Telegram integration.

- **Type:** Single-page web application (no build tools, no bundler)
- **Language:** Vanilla JavaScript (ES6+), HTML5, CSS3, **TypeScript (dev-only for type checking)**
- **Dependencies:** Loaded via `<script>` tags in [`src/index.html`](src/index.html:7)
- **License:** MIT — see [`LICENSE.md`](LICENSE.md)
- **Testing:** Jest with `jest-environment-jsdom` — see [`tests/`](tests/) directory
- **Type Checking:** TypeScript `--noEmit --checkJs` — run with `npm run typecheck`

---

## 2. File Structure

```
la_searcher_map/
├── AGENTS.md                  # This file — AI assistant guide
├── README.md                  # Project overview (Russian)
├── CONTRIBUTING.md            # Contribution guidelines
├── LICENSE.md                 # MIT License
├── package.json               # NPM scripts: test, test:watch, test:coverage, typecheck
├── tsconfig.json              # TypeScript config for dev-only type checking
├── .gitignore                 # Git ignore (includes coverage/)
├── plans/
│   ├── js-type-safety-analysis.md  # Type safety migration plan & analysis
│   └── unit-test-plan.md      # Unit test implementation plan
├── tests/
│   ├── jest.config.js         # Jest configuration (jsdom environment)
│   ├── setup.js               # Global mocks & test helpers
│   ├── map.test.js            # Pure logic tests for map.js (33 tests)
│   ├── map.integration.test.js # Integration tests with ymaps mocks (27 tests)
│   ├── telegram.test.js       # Tests for telegram.js (10 tests)
│   ├── info_panel.test.js     # Tests for info_panel.js (10 tests)
│   ├── description_panel.test.js # Tests for description_panel.js (9 tests)
│   ├── __fixtures__/
│   │   ├── regions.csv        # Sample CSV with 4 regions
│   │   └── searchRecords.js   # 6 sample search records for all marker types
│   └── __mocks__/             # Additional Jest mocks (if needed)
└── src/
    ├── index.html             # Main HTML entry point
    ├── css/
    │   ├── styles.css         # Main application styles
    │   ├── info_panel.css     # Info panel modal styles
    │   └── loader.css         # CSS loader animation
    ├── js/
    │   ├── types.js           # JSDoc @typedef definitions (zero runtime code)
    │   ├── globals.d.ts       # Ambient type declarations for global deps
    │   ├── map.js             # Core map logic (951 lines)
    │   ├── telegram.js        # Telegram integration & app bootstrap
    │   ├── balloon.js         # Balloon popup content & layout class
    │   ├── controls.js        # Custom Yandex Maps controls (region ListBox)
    │   ├── description_panel.js  # Search description modal overlay
    │   ├── info_panel.js      # "About the Map" help panel
    │   ├── yandex_rounded_controls.js  # Custom Yandex Maps UI controls
    │   └── hawk.js            # Hawk.so error tracking (minified)
    ├── images/
    │   ├── icon_cross.jpg     # Close button icon
    │   ├── icon_curr_loc.png  # Current location icon
    │   ├── icon_home.png      # Home marker icon
    │   ├── icon_marker_green.png  # Active + exact match marker
    │   ├── icon_marker_grey.png   # Old/archived search marker
    │   └── icon_marker_orange.png # Active search marker
    └── data/
        └── regions_from_yandex.csv  # Region boundary polygons (171 lines)
```


---

## 3. Architecture & Data Flow

### 3.1 Entry Points

The application supports three entry modes, detected in [`telegram.js:defineEntryPoint()`](src/js/telegram.js:99):

| Mode | Detection | Behavior |
|------|-----------|----------|
| `web_app` | `window.Telegram.WebApp.initData` exists | Telegram WebApp — uses Telegram user data, no login page |
| `web_view` | `TelegramWebviewProxy` exists | Telegram in-app browser — shows login page with Telegram widget |
| `web_browser` | Fallback | Standalone browser — shows login page with Telegram widget |

### 3.2 Initialization Sequence

1. **HTML loads** [`src/index.html`](src/index.html) — scripts load in order:
   - [`hawk.js`](src/js/hawk.js) (error tracking) → eruda (debug console) → jQuery → Turf.js → [`types.js`](src/js/types.js) (JSDoc typedefs) → [`info_panel.js`](src/js/info_panel.js) → [`description_panel.js`](src/js/description_panel.js) → styles → [`telegram.js`](src/js/telegram.js)
2. **`telegram.js`** detects entry point, initializes Telegram WebApp, sets theme
3. **`telegram.js`** dynamically loads Yandex Maps API script → [`yandex_rounded_controls.js`](src/js/yandex_rounded_controls.js) → [`map.js`](src/js/map.js)
4. **`map.js`** runs inside `ymaps.ready()` callback — initializes map, fetches data, renders markers

### 3.3 Data Flow

```
Telegram Bot (@LizaAlert_Searcher_Bot)
  ↓ (userData passed via Telegram WebApp or URL params)
telegram.js — apiCall() → Yandex Cloud Function (POST)
  ↓ (JSON response with searches array)
map.js — ymaps.ready() → initMap() → fetch + render
```

- **API endpoint:** `https://functions.yandexcloud.net/d4e6t4q6qj3r7l4kqj2v`
- **Request:** POST with `tg_user_id`, `tg_user_name`, `tg_user_first_name`, `tg_user_last_name`
- **Response:** JSON with `searches` array — each search has `id`, `name`, `description`, `lat`, `lng`, `status`, `type`, `created_at`, etc.

---

## 4. Core Module: [`src/js/map.js`](src/js/map.js)

### 4.1 Global State (`STATE` object, lines 8–27)

Centralized state management — all mutable application state lives here:

```javascript
const STATE = {
    userHomeCoordinates: null,     // [lat, lng] from user data
    userHomeRadius: null,          // radius in meters
    userHomeRegion: null,          // region name string
    userCircle: null,              // ymaps.Circle instance
    userActiveArea: null,          // turf.js polygon (circle ∩ regions)
    userActiveAreaCoordinates: null, // coordinates for fog overlay
    regionsMultiPolygon: null,     // turf.js multipolygon from CSV
    records: [],                   // all search records from API
    markers: [],                   // ymaps.GeoObject markers on map
    routes: [],                    // active ymaps.multiRouter.MultiRoute instances
    routeTrafficButtons: [],       // traffic toggle buttons per route
    routeViaPointButtons: [],      // via-point toggle buttons per route
    BalloonContentLayout: null,    // custom balloon layout class
    currentZoom: null,             // current map zoom level
    currentCenter: null,           // current map center [lat, lng]
    map: null,                     // ymaps.Map instance
    fogPolygon: null,              // fog overlay GeoObject
    isFirstLoad: true,             // flag for initial bounds animation
    isFogRemoved: false,           // flag for fog removal
};
```

### 4.2 Key Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `addDarkTheme()` | 81–91 | Registers custom dark Yandes map style (`darkMap`) |
| `initMap()` | 93–102 | Creates `ymaps.Map` with restricted bounds |
| `addControls()` | 104–269 | Geolocation, traffic, info button, zoom, city listbox (Москва/Омск) |
| `addDropDownListOfSearchTypes()` | 271–289 | Filter dropdown: active searches / all searches |
| `addCurvedCircle()` | 291–307 | Draws the home radius circle on map |
| `defineGeodesicCirclePoints()` | 309–342 | Calculates geodesic circle points using Yandex geo.Wgs84Crs |
| `drawGeodesicCircle()` | 344–349 | Updates geodesic circle on zoom/center change |
| `defineRegionsMultiPolygon()` | 395–422 | Fetches CSV, parses region polygons into Turf multipolygon |
| `defineUserActiveArea()` | 448–469 | Intersects circle with regions to determine active search area |
| `addFogOnMap()` | 471–495 | Semi-transparent overlay with cutout for active area |
| `addHome()` | 497–507 | Places home marker |
| `findBounds()` | 509–586 | Calculates optimal map bounds to fit all markers |
| `setBounds()` | 588–592 | Animates map to calculated bounds |
| `sortMarkers()` | 594–620 | Sorts markers by priority (active+exact > active > old) then rotated coords |
| `composePopupContent()` | 622–686 | Generates balloon HTML with search details |
| `addMarker()` | 753–789 | Creates color-coded marker (green/orange/grey) |
| `addRoute()` | 814–882 | Creates Yandex MultiRoute with traffic & via-point controls |
| `removeAllRoutes()` | 884–889 | Clears all routes from map |
| `addScrollControl()` | 891–917 | Prevents touch scroll interference with Telegram |
| `determineStartingPoint()` | 919–930 | Chooses route start: user location > home > map center |

### 4.3 Marker Color Logic

Markers are color-coded based on search status and type:

| Color | Icon | Condition |
|-------|------|-----------|
| 🟢 Green | [`icon_marker_green.png`](src/images/icon_marker_green.png) | `status === 'active'` AND `type === 'exact'` |
| 🟠 Orange | [`icon_marker_orange.png`](src/images/icon_marker_orange.png) | `status === 'active'` (but not exact) |
| ⚫ Grey | [`icon_marker_grey.png`](src/images/icon_marker_grey.png) | All other statuses (old/archived) |

### 4.4 Route System

- Uses `ymaps.multiRouter.MultiRoute` with `viaPoints` for multi-stop routing
- Each route gets a **traffic toggle button** and a **via-point toggle button**
- Routes avoid traffic jams by default (`avoidTrafficJams: true`)
- Starting point determined by: user geolocation → home coordinates → map center

### 4.5 Geodesic Circle

The radius circle is drawn with geodesic accuracy:
- `defineGeodesicCirclePoints()` calculates 60 points along the circle perimeter using Yandex coordinate system
- `drawGeodesicCircle()` redraws on zoom/center change for visual accuracy
- The circle is stored in `STATE.userCircle`

### 4.6 Region System

- Region polygons loaded from [`src/data/regions_from_yandex.csv`](src/data/regions_from_yandex.csv)
- CSV format: `id` | `name` | `coordinates` (JSON array of rings) | `center` (JSON [lat, lng])
- Parsed into Turf.js `multiPolygon` for intersection with the user's radius circle
- The intersection (`defineUserActiveArea()`) determines the visible search area
- A "fog" overlay (`addFogOnMap()`) darkens everything outside the active area

---

## 5. Module: [`src/js/telegram.js`](src/js/telegram.js)

### 5.1 Key Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `updateLoaderColor()` | 47–53 | Sets CSS variable for loader color based on theme |
| `loadSingleScriptByName(src)` | 55–64 | Creates & appends `<script>` tag dynamically |
| `loadPrerequisiteMapScripts()` | 66–78 | Loads Yandex Maps API → rounded controls → map.js |
| `initiateMapCreation()` | 80–87 | Calls `ymaps.ready()` to start map.js |
| `createLoginPage()` | 89–97 | Shows Telegram login widget |
| `defineEntryPoint()` | 99–114 | Detects web_app / web_view / web_browser |
| `loadTelegramLoginScript()` | 116–152 | Loads Telegram Login widget script |
| `apiCall(userData)` | 154–195 | POST to Yandex Cloud Function, retries on failure |
| `onTelegramAuth(user)` | 197–214 | Handles Telegram auth callback → stores userData → loads map |

### 5.2 Theme Detection

- Checks `window.Telegram.WebApp.colorScheme` (dark/light)
- Falls back to `window.matchMedia('(prefers-color-scheme: dark)')`
- Sets CSS variables: `--tg-theme-bg-color`, `--tg-theme-text-color`, `--tg-theme-hint-color`, `--tg-theme-link-color`, `--tg-theme-button-color`, `--tg-theme-button-text-color`, `--tg-secondary-bg-color`
- Dark mode also applies `darkMap` Yandex style

---

## 6. Module: [`src/js/description_panel.js`](src/js/description_panel.js)

- Creates a full-screen modal overlay showing search details
- Function: `createDescriptionPanel(search)` — takes a search record object
- Renders: name, description, creation date, status, type, coordinates
- Close via cross icon or backdrop click
- Uses CSS class `.description-panel` (styled in [`src/css/styles.css`](src/css/styles.css))

---

## 7. Module: [`src/js/info_panel.js`](src/js/info_panel.js)

- Creates an "About the Map" help panel
- Function: `createInfoPanel()` — no arguments
- Shows legend with icon/description pairs via `createImageDescPair(src, desc)`
- Styled in [`src/css/info_panel.css`](src/css/info_panel.css) — backdrop blur, grid layout

---

## 8. Styling

| File | Purpose |
|------|---------|
| [`src/css/styles.css`](src/css/styles.css) | Main styles: map positioning, popups, buttons, traffic control |
| [`src/css/info_panel.css`](src/css/info_panel.css) | Info panel modal: backdrop blur, grid layout, responsive |
| [`src/css/loader.css`](src/css/loader.css) | CSS-only bouncing circle loader animation with theme variables |

### CSS Variables (set by telegram.js)

```css
--tg-theme-bg-color
--tg-theme-text-color
--tg-theme-hint-color
--tg-theme-link-color
--tg-theme-button-color
--tg-theme-button-text-color
--tg-secondary-bg-color
```

---

## 9. Dependencies

All loaded via `<script>` tags in [`src/index.html`](src/index.html) or dynamically in [`src/telegram.js`](src/telegram.js):

| Dependency | Version | Source | Loaded By |
|------------|---------|--------|-----------|
| Hawk.so (error tracking) | 3.0.9 | CDN (Apache-2.0) | `index.html` |
| eruda (mobile console) | latest | CDN | `index.html` |
| jQuery | 2.2.3 | CDN | `index.html` |
| Turf.js | latest | CDN | `index.html` |
| Yandex Maps API | 2.1 | `api-maps.yandex.ru` | `telegram.js` (dynamic) |
| Telegram WebApp | latest | Telegram SDK | `telegram.js` (dynamic) |
| Telegram Login Widget | latest | Telegram SDK | `telegram.js` (dynamic) |
| TypeScript (dev-only) | ^6.0.3 | npm | `tsconfig.json` |

---

## 10. Coding Conventions & Patterns

### 10.1 Naming
- **Functions:** `camelCase` — e.g., `addMarker()`, `findBounds()`, `defineGeodesicCirclePoints()`
- **Constants:** `UPPER_SNAKE_CASE` — e.g., `DEFAULT_CENTER_COORDINATES`
- **State:** `STATE` object with `camelCase` properties
- **CSS classes:** `kebab-case` — e.g., `.description-panel`, `.info-panel`

### 10.2 Patterns
- **No build tools** — all code is vanilla JS loaded via script tags
- **Global namespace** — functions and STATE are global (window-level)
- **Yandex Maps API** — uses `ymaps.*` namespace, templates via `ymaps.templateLayoutFactory.createClass()`
- **Async/await** — used for API calls and CSV fetching
- **Error handling** — try/catch blocks with `HawkCatcher.send()` for error reporting
- **DOM manipulation** — jQuery for selector/event helpers, vanilla JS for creation
- **JSDoc annotations** — all functions annotated with `@param`/`@returns` for TypeScript type checking
- **`@typedef` in types.js** — shared data structure definitions (SearchRecord, UserData, AppState)
- **Ambient declarations in globals.d.ts** — types for global-scope dependencies (ymaps, turf, jQuery, Telegram)
- **Runtime validation** — `validateApiResponse()` in telegram.js for lightweight Pydantic-style response checking

### 10.3 Yandex Maps Specifics
- Map type: `yandex#map` (default) or custom `darkMap` (dark theme)
- Projection: `ymaps.geo.Wgs84Crs` for geodesic calculations
- Controls: Custom `ListBox` with template layouts, custom `Button` controls
- Markers: `ymaps.GeoObject` with `geometry: { type: "Point" }` and preset icons
- Routes: `ymaps.multiRouter.MultiRoute` with `avoidTrafficJams: true`

### 10.4 Important Implementation Details

1. **Map bounds are restricted** — users cannot pan outside the defined boundary area
2. **Touch scroll prevention** — `addScrollControl()` prevents page scroll when interacting with map in Telegram
3. **First load animation** — `STATE.isFirstLoad` flag enables smooth bounds animation on initial render
4. **Fog overlay** — uses a polygon with a hole (the active area) to dim irrelevant map areas
5. **API retry** — `apiCall()` in telegram.js retries once on failure
6. **Marker sorting** — uses a rotated coordinate system to create a spiral-like ordering for visual clarity

---

## 11. Common Tasks

### Adding a new marker type
1. Add icon file to `src/images/`
2. Add condition in `addMarker()` ([`src/js/map.js:753`](src/js/map.js:753))
3. Add icon/description pair in `createInfoPanel()` ([`src/js/info_panel.js:21`](src/js/info_panel.js:21))

### Adding a new control to the map
1. Create control instance in `addControls()` ([`src/js/map.js:104`](src/js/map.js:104))
2. Add to `map.controls.add()`

### Modifying the API call
1. Edit `apiCall()` in [`src/js/telegram.js:154`](src/js/telegram.js:154)
2. Update the response handling in the fetch chain

### Adding a new region
1. Add row to [`src/data/regions_from_yandex.csv`](src/data/regions_from_yandex.csv)
2. Format: `id|name|coordinates|center`

### Adding a new data type (typedef)
1. Add `@typedef` to [`src/js/types.js`](src/js/types.js) — e.g., `@typedef {Object} MyNewType`
2. Use `@property` tags to define fields
3. Reference the type in function annotations: `@param {MyNewType} paramName`
4. Run `npm run typecheck` to verify

### Adding a new global dependency (script tag)
1. Add ambient declaration in [`src/js/globals.d.ts`](src/js/globals.d.ts)
2. Declare as `declare namespace` or `declare var`/`declare function`
3. Run `npm run typecheck` to verify

---

## 12. Gotchas & Warnings

- **No module system** — all files share the global scope. Be careful with variable name collisions.
- **Yandex Maps API loads async** — `map.js` code runs inside `ymaps.ready()` callback, not at script load time.
- **CSV parsing is custom** — `findRecordById()` uses simple text search, not a CSV parser.
- **Turf.js is used client-side** — polygon intersection happens in the browser, which may be slow for complex geometries.
- **Telegram WebApp restrictions** — certain features (like `expand()` and `ready()`) are Telegram-specific and may not work in regular browsers.
- **Dark theme registration** — `addDarkTheme()` must be called before `initMap()` to register the custom map type.
- **Loader CSS uses vendor prefixes** — `@-webkit-keyframes`, `@-moz-keyframes`, `@-o-keyframes`, `@-ms-keyframes` for compatibility.
- **TypeScript is dev-only** — `tsc --noEmit` only checks types, it does not transpile. Production output is still vanilla JS.
- **`@this` annotations required for template layouts** — methods passed to `ymaps.templateLayoutFactory.createClass()` need `/** @this {{ childContainerElement, events }} */` to access `this` in TypeScript.
- **`const`/`let` in eval** — test setup replaces `const`/`let` with `var` when loading source files via `(0, eval)(code)`. New source files must use `const`/`let` (not `var`) for proper scoping.

---

## 13. Testing Infrastructure

### 13.1 Test Framework

- **Jest** with `jest-environment-jsdom` — configured in [`tests/jest.config.js`](tests/jest.config.js)
- **5 test suites**, **89 tests total** — all pass
- Run with: `npm test`, `npm run test:watch`, or `npm run test:coverage`

### 13.2 Test Suites

| Suite | File | Tests | What it covers |
|-------|------|-------|----------------|
| Pure logic | [`tests/map.test.js`](tests/map.test.js) | 33 | `findRecordById()`, `convertCoordsStringToArray()`, `extractAllRings()`, `sortMarkers()`, `composePopupContent()`, `determineStartingPoint()`, `createPolygonForTurf()` |
| Integration | [`tests/map.integration.test.js`](tests/map.integration.test.js) | 27 | `defineRegionsMultiPolygon()`, `defineUserActiveArea()`, `findBounds()`, `addScrollControl()`, `defineGeodesicCirclePoints()`, `addCurvedCircle()`, `addHome()`, `addFogOnMap()`, `addMarker()` |
| Telegram | [`tests/telegram.test.js`](tests/telegram.test.js) | 10 | `defineEntryPoint()`, `updateLoaderColor()`, `loadSingleScriptByName()`, `apiCall()`, `onTelegramAuth()` |
| Info panel | [`tests/info_panel.test.js`](tests/info_panel.test.js) | 10 | `createImageDescPair()`, `createInfoPanel()` |
| Description panel | [`tests/description_panel.test.js`](tests/description_panel.test.js) | 9 | `createDescriptionPanel()` |

### 13.3 Global Setup ([`tests/setup.js`](tests/setup.js))

The setup file runs before all tests and provides:

- **`global.window = global`** — source files that reference `window` work in Node.js
- **DOM elements** — `<div id="map">` and `<div id="login_page">` created via `document.body.innerHTML`
- **Global mocks:**
  - `ymaps` — Map, Placemark, Circle, Polygon, GeoObject, controls (Button, ListBox, ListBoxItem, ZoomControl, GeolocationControl, TrafficControl), `templateLayoutFactory.createClass()`, `multiRouter.MultiRoute`, `coordSystem.geo.Wgs84Crs`, `geolocation`, `layer`, `mapType`
  - `turf` — `turf.polygon()`, `turf.multiPolygon()`, `turf.intersect()`, `turf.area()`, `turf.circle()`, `turf.booleanContains()`, `turf.booleanPointInPolygon()`
  - `$` (jQuery) — selector, event, CSS, DOM manipulation
  - `window.Telegram` — WebApp, WebView, Login widget
  - `fetch` — mocked via `jest.fn()`
- **Helper functions:**
  - `__loadSource(relativePath)` — loads a vanilla JS file into global scope via `(0, eval)(code)` with `const`/`let`→`var` replacement and file caching
  - `__resetState()` — resets `STATE` to defaults between tests
  - `__mockFetchResponse(body, status, headers)` — sets up a successful fetch mock
  - `__mockFetchError(msg)` — sets up a failed fetch mock
  - `__setTelegramEntryPoint(entryPoint)` — configures Telegram mock for `web_app`/`web_view`/`web_browser`
  - `__resetTurfCounters()` — resets Turf mock call counters

### 13.4 Fixtures

| File | Contents |
|------|----------|
| [`tests/__fixtures__/regions.csv`](tests/__fixtures__/regions.csv) | 4 sample regions with coordinates for CSV parsing tests |
| [`tests/__fixtures__/searchRecords.js`](tests/__fixtures__/searchRecords.js) | 6 search records: `allSearches`, `activeExactSearch`, `activeSearch`, `oldSearch`, `minimalSearch`, `searchWithMissingFields` |

### 13.5 Key Testing Patterns

1. **Loading vanilla JS files**: Source files use global scope (no modules). Tests load them via `__loadSource()` which uses `(0, eval)(code)` to execute in global scope. `const`/`let` are replaced with `var` so declarations are accessible from test files.

2. **File caching**: `__loadSource()` caches loaded files to prevent `const` redeclaration errors when the same file is loaded across multiple test suites.

3. **State isolation**: `__resetState()` is called in `beforeEach` to reset `STATE` between tests, preventing cross-test pollution.

4. **Mock isolation**: `jest.clearAllMocks()` is called in `beforeEach` to reset all mock call counts and implementations.

5. **Async testing**: Integration tests use `async/await` for functions that fetch data or use Promises.

---

## 14. Key External References

- [Yandex Maps API 2.1 Documentation](https://yandex.com/dev/maps/jsapi/doc/2.1/)
- [Turf.js Documentation](https://turfjs.org/docs/)
- [Telegram WebApp Documentation](https://core.telegram.org/bots/webapps)
- [Telegram Login Widget](https://core.telegram.org/widgets/login)
- [Hawk.so Error Tracking](https://docs.hawk.so/)
