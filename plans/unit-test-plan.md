# Unit Test Plan for LA Searcher Map

## Overview

This plan outlines the addition of unit tests to the [LA Searcher Map](src/) project — a vanilla JavaScript single-page application using Yandex Maps API, Telegram WebApp, Turf.js, and jQuery.

**Framework**: Jest with jsdom environment
**Location**: `tests/` directory at project root

---

## Phase 1: Project Setup

### 1.1 Install Dependencies

Add to [`package.json`](package.json) `devDependencies`:

| Package | Purpose |
|---------|---------|
| `jest` | Test runner & assertion library |
| `jest-environment-jsdom` | DOM simulation in Node.js |

### 1.2 Create Jest Configuration

**File**: [`tests/jest.config.js`](tests/jest.config.js)

```js
module.exports = {
  rootDir: '..',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  transform: {},
  clearMocks: true,
};
```

### 1.3 Add npm Scripts

Add to [`package.json`](package.json) `scripts`:

```json
{
  "test": "jest --config tests/jest.config.js",
  "test:watch": "jest --config tests/jest.config.js --watch",
  "test:coverage": "jest --config tests/jest.config.js --coverage"
}
```

---

## Phase 2: Mock Infrastructure

**File**: [`tests/setup.js`](tests/setup.js)

This file runs before every test suite and sets up all required global mocks.

### 2.1 DOM Setup

- Create a `<div id="map"></div>` element in the document body (required by [`map.js`](src/js/map.js))
- Set `document.documentElement` for CSS variable testing

### 2.2 Yandex Maps API Mock ([`ymaps`](src/js/map.js))

Mock the following `ymaps.*` namespace objects:

| Mock Target | Used In | Key Methods/Properties |
|-------------|---------|----------------------|
| `ymaps.Map` | [`initMap()`](src/js/map.js:93) | constructor, `setBounds()`, `setCenter()`, `geoObjects.add()`, `controls.add()` |
| `ymaps.Placemark` | [`addMarker()`](src/js/map.js:753), [`addHome()`](src/js/map.js:497) | constructor, `properties.set()` |
| `ymaps.Circle` | [`addCurvedCircle()`](src/js/map.js:291) | constructor |
| `ymaps.Polygon` | [`drawGeodesicCircle()`](src/js/map.js:344), [`addFogOnMap()`](src/js/map.js:471) | constructor |
| `ymaps.GeoObject` | [`addFogOnMap()`](src/js/map.js:477) | constructor |
| `ymaps.control.GeolocationControl` | [`addControls()`](src/js/map.js:105) | constructor, events |
| `ymaps.control.TrafficControl` | [`addControls()`](src/js/map.js:117) | constructor |
| `ymaps.control.Button` | [`addControls()`](src/js/map.js:125), [`addRoute()`](src/js/map.js:826) | constructor, events |
| `ymaps.control.ZoomControl` | [`addControls()`](src/js/map.js:148) | constructor |
| `ymaps.control.ListBox` | [`addControls()`](src/js/map.js:245), [`addDropDownListOfSearchTypes()`](src/js/map.js:271) | constructor, events |
| `ymaps.control.ListBoxItem` | [`addControls()`](src/js/map.js:228), [`addDropDownListOfSearchTypes()`](src/js/map.js:273) | constructor, `data.get()` |
| `ymaps.templateLayoutFactory.createClass` | [`declareBalloonClass()`](src/js/map.js:705), [`addControls()`](src/js/map.js:174) | returns layout class |
| `ymaps.multiRouter.MultiRoute` | [`addRoute()`](src/js/map.js:815) | constructor, events, `model.getReferencePoints()`, `model.setReferencePoints()` |
| `ymaps.coordSystem.geo.solveDirectProblem` | [`defineGeodesicCirclePoints()`](src/js/map.js:321) | returns `{ endPoint }` |
| `ymaps.geolocation` | [`addUserCurrentLocation()`](src/js/map.js:792) | `.get()` returns Promise |
| `ymaps.ready()` | [`map.js`](src/js/map.js:932) | calls callback immediately |
| `ymaps.layer.storage.add` | [`addDarkTheme()`](src/js/map.js:83) | — |
| `ymaps.mapType.storage.add` | [`addDarkTheme()`](src/js/map.js:89) | — |

**Implementation approach**: Create a factory function that returns a minimal mock with `jest.fn()` for each method. Store instances in an array to allow assertions like `expect(mockMap.setBounds).toHaveBeenCalledWith(...)`.

### 2.3 Turf.js Mock ([`turf`](src/js/map.js))

| Mock Target | Used In |
|-------------|---------|
| `turf.polygon()` | [`defineRegionsMultiPolygon()`](src/js/map.js:414), [`defineUserActiveArea()`](src/js/map.js:450) |
| `turf.multiPolygon()` | [`defineRegionsMultiPolygon()`](src/js/map.js:417) |
| `turf.booleanPointInPolygon()` | — (if used) |

Return identifiable objects so assertions can verify polygon creation.

### 2.4 jQuery Mock ([`$`](src/index.html:16))

| Mock Target | Used In |
|-------------|---------|
| `$(selector)` | [`declareBalloonClass()`](src/js/map.js) — for `$('#button_*')` |
| `$.bind()` | Event binding in balloon class |
| `$.unbind()` | Event cleanup in balloon class |
| `$.replaceWith()` | [`replaceButtonAndBindYandexLink()`](src/js/map.js:689) |
| `$.get(0)` | Accessing DOM element |

Simple mock: return `{ bind: jest.fn(), unbind: jest.fn(), replaceWith: jest.fn(), get: () => null }`.

### 2.5 Telegram WebApp Mock

| Mock Target | Used In |
|-------------|---------|
| `window.Telegram.WebApp` | [`telegram.js`](src/js/telegram.js) throughout |
| `window.Telegram.WebApp.initData` | Entry point detection |
| `window.Telegram.WebApp.initDataUnsafe` | Entry point detection |
| `window.Telegram.WebView.initParams` | Entry point detection |
| `window.Telegram.WebApp.colorScheme` | Theme detection |
| `window.Telegram.WebApp.expand()` | Initial call |
| Various button handlers | Settings, Back, Main buttons |

Mock with configurable properties to test different entry points.

### 2.6 `fetch` Mock

| Mock Target | Used In |
|-------------|---------|
| `window.fetch` | [`apiCall()`](src/js/telegram.js:154), [`defineRegionsMultiPolygon()`](src/js/map.js:398) |

Use `jest.spyOn(global, 'fetch')` with mock implementations returning appropriate Responses.

### 2.7 Test Data

Create reusable fixtures:

**File**: [`tests/__fixtures__/regions.csv`](tests/__fixtures__/regions.csv)

Sample CSV data matching the format of [`src/data/regions_from_yandex.csv`](src/data/regions_from_yandex.csv).

**File**: [`tests/__fixtures__/searchRecords.js`](tests/__fixtures__/searchRecords.js)

Sample search records covering all states:
- Active + exact match (green marker)
- Active only (orange marker)
- Old/archived (grey marker)
- Edge cases: missing fields, null coordinates, empty arrays

---

## Phase 3: Pure Logic Tests — [`map.js`](src/js/map.js)

### 3.1 `findRecordById(csvText, id)` — [Line 351](src/js/map.js:351)

| Test Case | Input | Expected |
|-----------|-------|----------|
| Find existing record | CSV with 3 rows, valid ID | Returns object with all CSV columns as keys |
| Find non-existent record | CSV, invalid ID | Returns `null` |
| Handle semicolon delimiter | CSV with `;` separator | Correctly splits headers and values |
| Handle empty CSV | Single header row only | Returns `null` |

### 3.2 `convertCoordsStringToArray(coordsString)` — [Line 368](src/js/map.js:368)

| Test Case | Input | Expected |
|-----------|-------|----------|
| Valid JSON coordinate string | `"[[55.7, 37.6]]"` | Returns parsed array |
| String with surrounding quotes | `"\"[[55.7, 37.6]]\""` | Trims quotes, parses correctly |
| String with escaped quotes | String containing `\"` | Replaces escaped quotes, parses |
| Invalid JSON string | `"not-json"` | Returns `null`, logs error |
| Empty string | `""` | Returns `null` |

### 3.3 `extractAllRings(coordsArray)` — [Line 384](src/js/map.js:384)

| Test Case | Input | Expected |
|-----------|-------|----------|
| Single polygon (one ring) | `[[[lat,lon], ...]]` | Returns `[[[lat,lon], ...]]` wrapped |
| Multi-polygon (multiple rings) | `[[[lat,lon],...], [[lat,lon],...]]` | Returns all rings as array |
| Single ring, nested array | `[[[1,2],[3,4],[5,6]]]` | Returns single ring in array |
| Empty array | `[]` | Returns `[undefined]` (edge case) |

### 3.4 `sortMarkers()` — [Line 594](src/js/map.js:594)

| Test Case | Input (`STATE.userSearchesList`) | Expected |
|-----------|-------|----------|
| Priority sort: active+exact first | Mix of all 3 priority levels | Green priority (3) sorted before orange (2) before grey (1) |
| Same priority, rotated coords | Multiple items with same priority | Sorted by rotated Y coordinate descending |
| Single marker | Array with 1 item | No change (stable) |
| Empty list | `[]` | No error |

### 3.5 `composePopupContent(search)` — [Line 622](src/js/map.js:622)

| Test Case | Input | Expected |
|-----------|-------|----------|
| Complete search object | Object with all fields | HTML string containing display_name, search_type, freshness, status, coords info, 4 buttons |
| Missing display_name | `search` without `display_name` | Shows "неизвестный" |
| Missing search_type | `search` without `search_type` | Shows "не определено" |
| Missing freshness | `search` without `freshness` | Shows "неизвестно" |
| Missing search_status | `search` without `search_status` | Shows "не определён" |
| Exact coordinates true | `{ exact_coords: true }` | Shows "Точные" |
| Exact coordinates false | `{ exact_coords: false }` | Shows "ТРЕБУЮТ УТОЧНЕНИЯ" |
| All 4 buttons present | Any valid search | HTML contains `button_route`, `button_forum`, `button_show_description`, `button_duration_calculate` |

### 3.6 `determineStartingPoint()` — [Line 919](src/js/map.js:919)

| Test Case | STATE Setup | Expected |
|-----------|-------------|----------|
| Home coordinates available | `STATE.userHomeCoordinates = [55, 37]` | Returns `[55, 37]` |
| User location available (no home) | `STATE.userHomeCoordinates = null`, `STATE.currentUserLocation = [56, 38]` | Returns `[56, 38]` |
| Neither available | Both null | Returns `null` (alert triggered) |

---

## Phase 4: DOM Tests — [`info_panel.js`](src/js/info_panel.js) & [`description_panel.js`](src/js/description_panel.js)

### 4.1 `createImageDescPair(src, desc)` — [info_panel.js:1](src/js/info_panel.js:1)

| Test Case | Input | Expected |
|-----------|-------|----------|
| Creates image-description container | `"img.png"`, "Some text" | Returns DOM element with class `img-desc-container`, child img with correct src, child span with text |
| Empty description | `"img.png"`, `""` | Span with empty textContent |

### 4.2 `createInfoPanel()` — [info_panel.js:21](src/js/info_panel.js:21)

| Test Case | Expected |
|-----------|----------|
| Creates container div with `container-for-info-panel` class | Container appended to `document.body` |
| Contains close button with cross icon | Close button with `<img src="images/icon_cross.jpg">` |
| Contains title text | Title with "Справка по Карте Поисковика" |
| Contains 5 image-description pairs | Legend icons for home, location, green, orange, grey markers |
| Click on backdrop removes panel | Click on `containerDiv` triggers `removeChild` |
| Click inside panel does NOT close | Click on `infoPanel` calls `stopPropagation` |

### 4.3 `createDescriptionPanel(search)` — [description_panel.js:1](src/js/description_panel.js:1)

| Test Case | Input | Expected |
|-----------|-------|----------|
| Complete search | Object with `display_name`, `content` | Panel with title = display_name, content = search.content |
| Missing content | Object with `display_name` only | Shows "Описание поиска: не определено" |
| Close via backdrop | — | Click on container removes panel |
| Close via cross button | — | Click on close button removes panel |
| Click inside does NOT close | — | `stopPropagation` prevents removal |

---

## Phase 5: Integration Tests — [`telegram.js`](src/js/telegram.js) & [`map.js`](src/js/map.js)

### 5.1 `defineEntryPoint()` — [telegram.js:99](src/js/telegram.js:99)

| Test Case | Mock Setup | Expected |
|-----------|------------|----------|
| Web App entry | `WebApp.initDataUnsafe = { user: { id: 1 } }`, `WebView = {}` | `entryPoint === 'web_app'` |
| Web View entry | `WebApp.initDataUnsafe = {}`, `WebView = { someKey: 'val' }` | `entryPoint === 'web_view'` |
| Browser entry | Both empty | `entryPoint === 'web_browser'` |

### 5.2 `updateLoaderColor()` — [telegram.js:47](src/js/telegram.js:47)

| Test Case | Theme | Expected CSS Variable |
|-----------|-------|---------------------|
| Dark theme | `userTheme = 'dark'` | `--circularG-bg-color` set to `rgb(200, 200, 200)` |
| Light theme | `userTheme = 'light'` | `--circularG-bg-color` set to `rgb(80, 80, 80)` |

### 5.3 `loadSingleScriptByName(src)` — [telegram.js:55](src/js/telegram.js:55)

| Test Case | Expected |
|-----------|----------|
| Creates script element | `<script>` with correct `src` appended to `document.head` |
| Resolves on load | Script `onload` handler resolves the promise |
| Rejects on error | Script `onerror` handler rejects the promise |

### 5.4 `apiCall(userData)` — [telegram.js:154](src/js/telegram.js:154)

| Test Case | Mock Setup | Expected |
|-----------|------------|----------|
| Successful API call | `fetch` returns `{ ok: true, searches: [...] }` | `window.userData` is set, `initiateMapCreation()` is called |
| API error response | `fetch` returns `{ ok: false }` | No further actions |
| Network failure | `fetch` rejects | Error paragraph appended to body |

### 5.5 `defineRegionsMultiPolygon()` — [map.js:395](src/js/map.js:395)

| Test Case | Mock Setup | Expected |
|-----------|------------|----------|
| Single region, single polygon | CSV with 1 region, 1 ring | `STATE.unitedUserRegionsMultiPolygon` is a `turf.polygon` |
| Multiple regions | CSV with 2 regions | `STATE.unitedUserRegionsMultiPolygon` is a `turf.multiPolygon` |
| CSV fetch error | `fetch` rejects | Error logged, no crash |

### 5.6 `defineUserActiveArea()` — [map.js:448](src/js/map.js:448)

| Test Case | STATE Setup | Expected |
|-----------|-------------|----------|
| Circle + regions both available | `geodesicCirclePoints` + `unitedUserRegionsMultiPolygon` set | `userActiveArea` is a turf polygon |
| Only circle available | Only `geodesicCirclePoints` | `userActiveArea` set from circle |
| Only regions available | Only `unitedUserRegionsMultiPolygon` | `userActiveArea` set from regions |
| Neither available | Both null | `userActiveArea` remains null |

### 5.7 `createPolygonForTurf()` — [map.js:425](src/js/map.js:425)

| Test Case | STATE Setup | Expected |
|-----------|-------------|----------|
| MultiPolygon geometry | `userActiveArea.geometry.type === 'MultiPolygon'` | Uses `coordinates[0][0]` |
| Polygon geometry | `userActiveArea.geometry.type === 'Polygon'` | Uses `coordinates[0]` |
| Null userActiveArea | `userActiveArea` is null | `polygonForTurf` stays null |
| Ring not closed | First and last point differ | Closing point is appended |

### 5.8 `findBounds()` — [map.js:509](src/js/map.js:509)

| Test Case | STATE Setup | Expected |
|-----------|-------------|----------|
| Home + markers + area | All three present | `STATE.boundaries.show === true`, bounds calculated correctly |
| Only home coordinates | Only `userHomeCoordinates` | Bounds from home only |
| No data | Nothing set | Boundaries not shown |

### 5.9 `addScrollControl()` — [map.js:891](src/js/map.js:891)

| Test Case | Simulated Event | Expected |
|-----------|-----------------|----------|
| Swipe down from top | `touchstart` at y=20, `touchmove` down | `preventDefault()` called |
| Swipe up from any position | `touchstart` at y=200, `touchmove` up | No prevention |
| Swipe down from bottom | `touchstart` at y=500, `touchmove` down | No prevention |

---

## Phase 6: Verify & Document

### 6.1 Run Tests

```bash
npm test                 # Initial run — all tests pass
npm test -- --coverage   # Coverage report
```

### 6.2 Update Project Files

- Add test-related scripts to [`package.json`](package.json)
- Update [`.gitignore`](.gitignore) if needed (coverage directory)
- Optionally add CI config for automated test runs

---

## File Structure Summary

```
la_searcher_map/
├── tests/
│   ├── jest.config.js              # Jest configuration
│   ├── setup.js                    # Global mocks & setup
│   ├── __fixtures__/
│   │   ├── regions.csv             # Sample CSV for region parsing tests
│   │   └── searchRecords.js        # Sample search records
│   ├── __mocks__/
│   │   ├── ymaps.js                # Yandex Maps API mock
│   │   ├── turf.js                 # Turf.js mock factory
│   │   └── telegramWebApp.js       # Telegram WebApp mock factory
│   ├── map.test.js                 # Tests for map.js (pure + integration)
│   ├── telegram.test.js            # Tests for telegram.js
│   ├── info_panel.test.js          # Tests for info_panel.js
│   └── description_panel.test.js   # Tests for description_panel.js
├── package.json                    # Updated with test scripts
└── .gitignore                      # Updated with coverage/ directory
```

---

## Test Count Estimate

| Module | Pure Logic Tests | DOM Tests | Integration Tests | Total |
|--------|-----------------|-----------|-------------------|-------|
| `map.js` | ~25 | 0 | ~12 | ~37 |
| `telegram.js` | ~4 | ~2 | ~6 | ~12 |
| `info_panel.js` | 0 | ~7 | 0 | ~7 |
| `description_panel.js` | 0 | ~5 | 0 | ~5 |
| **Total** | **~29** | **~14** | **~18** | **~61** |

---

## Key Technical Challenges

1. **Loading vanilla JS into Jest**: Since source files use global scope (no `import`/`export`), tests need to load them via `fs.readFileSync` + runtime evaluation in the correct global context after mocks are established. Use a helper function like:
   ```js
   function loadSource(filePath) {
     const code = fs.readFileSync(filePath, 'utf8');
     const fn = new Function('window', 'document', code);
     fn(window, document);
   }
   ```

2. **Yandex Maps async loading**: [`map.js`](src/js/map.js:932) runs inside `ymaps.ready()`, so tests for most map functions need to either call `ymaps.ready()` callbacks manually or mock `ymaps.ready` to invoke the callback synchronously.

3. **STATE dependency**: Many [`map.js`](src/js/map.js) functions depend on the global [`STATE`](src/js/map.js:8) object. Tests must reset `STATE` between tests (use `beforeEach` to reinitialize).

4. **Global namespace pollution**: Since all files execute in global scope, test files must be isolated. Each test suite should:
   - Set up mocks before loading source
   - Reset globals in `afterEach`
   - Use separate `describe` blocks for independent scenarios
