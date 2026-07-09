# Map.js Readability Improvements — Implementation Plan

## Status

Improvement #1 from the original proposal (extract balloon/popup to `balloon.js`) is **already done**:
- [`src/js/balloon.js`](src/js/balloon.js) exists and is loaded in [`src/index.html:20`](src/index.html:20)
- Functions `composePopupContent()`, `replaceButtonAndBindYandexLink()`, `declareBalloonClass()` already moved there
- [`map.js`](src/js/map.js:689) calls `declareBalloonClass(record)` in `addMarker()`

The remaining improvements are:

---

## Improvement A: Extract `ListBoxLayout` + city listbox → `src/js/controls.js`

### What

Move the 70-line custom ListBox layout definition, `ListBoxItemLayout`, city listbox items (`Москва`/`Омск`), and the listbox creation logic from inside [`addControls()`](src/js/map.js:118) into a new file `src/js/controls.js`.

### Why

- [`addControls()`](src/js/map.js:118) is 138 lines; ~70 of them are a self-contained Yandex Maps template layout class
- The ListBox layout has nothing to do with map logic — it's pure UI component code
- Makes `addControls()` ~68 lines, focused only on creating and adding controls

### What to extract

1. **`createCityListBox()`** — a new global function that encapsulates all ListBox creation:
   ```javascript
   function createCityListBox() {
       const ListBoxLayout = ymaps.templateLayoutFactory.createClass(/*...*/);
       const ListBoxItemLayout = ymaps.templateLayoutFactory.createClass(/*...*/);
       const listBoxItems = [ /* Москва, Омск */ ];
       const listBox = new ymaps.control.ListBox({/*...*/});
       listBox.events.add('click', function (e) { /*...*/ });
       return listBox;
   }
   ```

2. The `FIXME` block (lines 170–181) about Yandex Maps link — this is also control-related, keep it in `addControls()` since it interacts with the DOM element created by Yandex controls.

### Files changed

| File | Change |
|------|--------|
| **NEW** `src/js/controls.js` | Contains `createCityListBox()` global function |
| [`src/js/map.js`](src/js/map.js:118) | Replace 70-line ListBox block with `map.controls.add(createCityListBox())` |
| [`src/index.html`](src/index.html:20) | Add `<script src="js/controls.js"></script>` before `telegram.js` |

### No test changes needed

- Tests don't call `addControls()` directly (integration tests test individual functions)
- The `ListBox`/`ListBoxItem` mocks in [`tests/setup.js:228-239`](tests/setup.js:228) remain unchanged

---

## Improvement B: Named constants + `closePolygonRing()` helper

### What

1. Replace magic numbers with named constants at the top of `map.js`
2. Extract the repeated "close polygon ring" pattern into a reusable pure function

### Magic numbers to replace

| Current value | Proposed constant | Location |
|---------------|-------------------|----------|
| `72` | `GEODESIC_CIRCLE_SEGMENTS = 72` | [`defineGeodesicCirclePoints()`](src/js/map.js:311) |
| `2000` | `MAX_RADIUS_KM = 2000` | [`addCurvedCircle()`](src/js/map.js:286) |
| `15` | `MARKER_SORT_ROTATION_DEG = 15` | [`sortMarkers()`](src/js/map.js:648) |
| `100` | `SCROLL_THRESHOLD_PX = 100` | [`addScrollControl()`](src/js/map.js:861) |

### `closePolygonRing()` helper

The same "close polygon ring" check appears in 2 places:

**Location 1** — [`defineGeodesicCirclePoints()`](src/js/map.js:330-333):
```javascript
if (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1]) {
    points.push(points[0]);
}
```

**Location 2** — [`createPolygonForTurf()`](src/js/map.js:459-466):
```javascript
if (
    STATE.polygonForTurf[0][0] !== STATE.polygonForTurf[STATE.polygonForTurf.length - 1][0] ||
    STATE.polygonForTurf[0][1] !== STATE.polygonForTurf[STATE.polygonForTurf.length - 1][1]
) {
    STATE.polygonForTurf.push(STATE.polygonForTurf[0]);
}
```

**Proposed helper:**
```javascript
/**
 * Ensures a polygon ring is closed (first point === last point).
 * Mutates the array in place if needed.
 * @param {Array<[number, number]>} ring - Array of [lat, lng] points.
 * @returns {Array<[number, number]>} The same ring, now closed.
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
```

### Files changed

| File | Change |
|------|--------|
| [`src/js/map.js`](src/js/map.js:52) | Add 4 new constants after existing constants |
| [`src/js/map.js`](src/js/map.js:308) | Add `closePolygonRing()` function (before `defineGeodesicCirclePoints`) |
| [`src/js/map.js`](src/js/map.js:330) | Replace inline ring-close with `closePolygonRing(points)` |
| [`src/js/map.js`](src/js/map.js:459) | Replace inline ring-close with `closePolygonRing(STATE.polygonForTurf)` |
| [`src/js/map.js`](src/js/map.js:285) | Replace `2000` with `MAX_RADIUS_KM` |
| [`src/js/map.js`](src/js/map.js:311) | Replace `72` with `GEODESIC_CIRCLE_SEGMENTS` |
| [`src/js/map.js`](src/js/map.js:648) | Replace `15` with `MARKER_SORT_ROTATION_DEG` |
| [`src/js/map.js`](src/js/map.js:861) | Replace `100` with `SCROLL_THRESHOLD_PX` and rename `someThresholdValue` |
| [`tests/map.test.js`](tests/map.test.js) | Add 2–3 tests for `closePolygonRing()` |

### Test impact

- `closePolygonRing()` is a pure function → easy to unit test
- Magic number changes are mechanical — no test changes needed (tests don't reference these numbers)

---

## Improvement C: Split `initApp()` into phase functions with error handling

### What

Break the 38-line [`initApp()`](src/js/map.js:961) into smaller, semantically-named async functions, each with a single responsibility, and add centralized error handling.

### Current `initApp()` (lines 961–999)

```javascript
async function initApp() {
    parseUserData(userData);
    applyTheme();
    addDarkTheme();
    initMap();
    addCurvedCircle();
    defineGeodesicCirclePoints();
    await defineRegionsMultiPolygon();
    await defineUserActiveArea();
    addFogOnMap();
    addHome();
    findBounds();
    setBounds();
    sortMarkers();
    STATE.userSearchesList.forEach((marker) => { addMarker(marker); });
    addControls();
    document.getElementById('login_page').style.display = 'none';
}
```

### Proposed structure

```javascript
/* ──────────────── Initialization Phases ──────────────── */

async function drawHomeArea() {
    addCurvedCircle();
    defineGeodesicCirclePoints();
}

async function computeActiveArea() {
    await defineRegionsMultiPolygon();
    await defineUserActiveArea();
}

function renderOverlays() {
    addFogOnMap();
    addHome();
}

function fitMapToBounds() {
    findBounds();
    setBounds();
}

function renderMarkers() {
    sortMarkers();
    STATE.userSearchesList.forEach(addMarker);
}

/* ──────────────── Application Bootstrap ──────────────── */

async function initApp() {
    try {
        parseUserData(userData);
        applyTheme();
        addDarkTheme();
        initMap();

        await drawHomeArea();
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

ymaps.ready(initApp);
```

### Why

1. **Readability** — `initApp()` becomes a high-level summary of the initialization sequence
2. **Testability** — each phase can be tested independently
3. **Error handling** — one `try/catch` catches all initialization failures
4. **Maintainability** — adding/removing a phase is a one-line change

### Files changed

| File | Change |
|------|--------|
| [`src/js/map.js`](src/js/map.js:961) | Replace single `initApp()` with phase functions + new `initApp()` |

### Test impact

- Tests currently call individual functions directly (e.g., `defineRegionsMultiPolygon()`) — unchanged
- No test calls `initApp()` directly (it's triggered by `ymaps.ready()`)
- The `ymaps.ready(initApp)` at line 1002 stays the same
- **No test changes needed**

---

## Summary of all changes

| # | Change | Lines affected in map.js | New files | index.html change | Test change |
|---|--------|-------------------------|-----------|-------------------|-------------|
| A | Extract ListBox to `controls.js` | -70 (`addControls`) | `src/js/controls.js` | +1 script tag | None |
| B | Constants + `closePolygonRing()` | +10 (new helper + constants), -6 (replaced code) | None | None | +2–3 tests |
| C | Phase functions + error handling | -10 (flattened `initApp`) | None | None | None |

**Net effect on `map.js`**: ~1003 → ~**930 lines** (modest reduction, but each function is dramatically more focused).

**Net effect on readability**: High — `addControls()` goes from 138→68 lines, magic numbers are documented, ring-closing logic is unified, `initApp()` reads as a clear 10-step sequence.

---

## Implementation order

1. **First:** Improvement B (constants + helper) — purely additive, lowest risk, no new files
2. **Second:** Improvement A (extract controls.js) — new file, requires index.html change
3. **Third:** Improvement C (phase functions) — restructures `initApp()` only
4. **Final:** Run `npm test` to verify all 89 tests pass
