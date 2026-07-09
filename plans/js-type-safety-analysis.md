# Type Safety & Data Structures in JavaScript — Analysis & Plan

> **Context:** You asked if Python-like typing (Pydantic, dataclass, `typing` module) can be applied to this vanilla JS project without build tools.

---

## 1. What's Already Here

The project already uses **JSDoc annotations sparingly**:

| Pattern | Example | Location |
|---------|---------|----------|
| `@param {type} name - desc` | `@param {Object} search - A search record object.` | [`balloon.js:23`](src/js/balloon.js:23) |
| `@returns {type}` | `@returns {string} HTML string for the balloon content.` | [`balloon.js:24`](src/js/balloon.js:24) |
| `@type {Object}` | `@type {Object}` on STATE | [`map.js:27`](src/js/map.js:27) |

**What's MISSING** compared to Python's ecosystem:

| Python concept | JS equivalent | Status in this project |
|----------------|---------------|-----------------------|
| `def foo(x: int) -> str:` | `@param {number} x` + `@returns {string}` | Used in ~30% of functions |
| `@dataclass` / Pydantic model | `@typedef` / class with validation | **Not used at all** |
| `from typing import Optional` | `@param {?type}` or `@param {type|null}` | **Not used at all** |
| Static checker (mypy, pyright) | tsc / TypeScript | **Not used** |
| Pydantic `.model_validate()` | Zod `.parse()` / Yup `.validate()` | **Not used** |
| `Union[str, int]` | `@param {string|number}` | **Not used** |
| `Literal['a', 'b']` | `@param {'a'|'b'}` | **Not used** |

---

## 2. Approach Comparison

### Approach A: JSDoc Deep Dive (lowest friction)

**What:** Expand the existing JSDoc annotations comprehensively — define `@typedef` for complex shapes, add `@param`/`@returns` to every function, use proper type unions.

**Example — before:**
```javascript
// Currently at map.js:304
function findRecordById(csvText, id) {
```

**Example — after:**
```javascript
/**
 * @typedef {Object} CsvRecord
 * @property {string} id
 * @property {string} region
 * @property {string} coords
 * @property {string} coords_type
 */

/**
 * @param {string} csvText — Raw CSV text (semicolon-delimited)
 * @param {string|number} id — The ID to search for
 * @returns {CsvRecord|null}
 */
function findRecordById(csvText, id) {
```

**Pros:**
- ✅ Zero new dependencies
- ✅ Zero build tools
- ✅ VS Code IntelliSense works immediately
- ✅ Already partially adopted
- ✅ No deployment changes

**Cons:**
- ❌ No **compile-time** checking — JSDoc is just documentation to the runtime
- ❌ Verbose — Python's `def foo(x: int) -> str:` is much more compact
- ❌ No **runtime validation** — malformed data won't be caught
- ❌ Mistakes in JSDoc types are not caught automatically

---

### Approach B: JSDoc + TypeScript `--noEmit --checkJs` (recommended ⭐)

**What:** Add TypeScript as a dev dependency, create a `tsconfig.json`, and run `tsc --noEmit --checkJs` to **type-check your JSDoc-annotated JS code**. The production output is still **exactly the same vanilla JS files**.

```bash
npm install --save-dev typescript
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": false,
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src/js/**/*.js"]
}
```

```json
// package.json — add script
"typecheck": "tsc --noEmit"
```

**Then run:** `npm run typecheck`

**Pros:**
- ✅ Full TypeScript error detection — catches `null` dereferences, wrong param types, missing properties
- ✅ **Same production output** — no build step, no bundler, no transpiler
- ✅ Gradual adoption — can add types file-by-file
- ✅ Catches real bugs: passing `string` where `number` expected, calling methods on `null`, etc.
- ✅ Works with VS Code's built-in TS checker for editor-time feedback
- ✅ TypeScript is already in your devDependencies pattern (Jest, AWS SDK are also dev deps)

**Cons:**
- ❌ JSDoc is still verbose compared to `.ts` syntax
- ❌ Global-scope pattern needs some `declare` statements for ambient declarations
- ❌ Some JS idioms may need minor adjustments

---

### Approach C: Runtime Data Validation (Pydantic-like)

**What:** Add a **schema validation library** via CDN to validate data at runtime — especially the API response (`userData`).

**Library options:**

| Library | Bundle (min+gz) | CDN | Notes |
|---------|----------------|-----|-------|
| **[Zod](https://zod.dev)** | ~10KB | `https://cdn.jsdelivr.net/npm/zod@3/dist/zod.min.js` | TypeScript-first, excellent error messages |
| **[Yup](https://github.com/jquense/yup)** | ~20KB | via npm CDN | More mature, better i18n |
| **[Joi](https://joi.dev)** | ~50KB | via npm CDN | Largest, most feature-rich |

**Example — Zod schema for API response:**
```javascript
// In telegram.js or a new validation.js
const SearchRecordSchema = {
    name: z.string(),
    display_name: z.string(),
    coords: z.array(z.array(z.number())),
    link: z.string().optional(),
    search_type: z.string().optional(),
    search_status: z.string().optional(),
    search_is_old: z.boolean().optional(),
    exact_coords: z.boolean().optional(),
    freshness: z.string().optional(),
    content: z.string().optional(),
};

// Validate API response
const result = SearchRecordSchema.parse(data);
```

**Pros:**
- ✅ Catches bad API data at runtime (like Pydantic)
- ✅ Clear error messages — "expected string at path `display_name`, got `undefined`"
- ✅ Works regardless of editor/IDE

**Cons:**
- ❌ Adds another CDN script tag and bundle size
- ❌ Only validates runtime data — doesn't help with function signatures
- ❌ Overlaps with TypeScript checking (both validate shapes, just at different times)
- ❌ Maintenance burden — schemas must be kept in sync with actual data

---

### Approach D: Full TypeScript Migration (NOT recommended for this project)

**What:** Rename `.js` → `.ts`, add a build step with `tsc` or a bundler.

**Pros:** Full TypeScript experience, best tooling support
**Cons:** ❌ Requires a build step (contradicts the "no build tools" project philosophy), ❌ Changes deployment pipeline, ❌ Major refactor

---

## 3. Recommended Hybrid Approach

**Use Approach B (JSDoc + `tsc --noEmit --checkJs`) as the primary mechanism, plus lightweight Approach C elements for the most critical data path only.**

### Why this combination

| Need | Solution |
|------|----------|
| **Static type checking** (like mypy) | `tsc --noEmit --checkJs` on JSDoc-annotated code |
| **Data shape documentation** (like `@dataclass`) | `@typedef` for search records, STATE, API response |
| **Function signature clarity** (like `typing` module) | `@param {type}` + `@returns {type}` on every function |
| **API response validation** (like Pydantic) | A small native `validateApiResponse()` function — no external lib |
| **Editor IntelliSense** | VS Code reads JSDoc natively |

---

## 4. Proposed Migration Plan

### Phase 1: Foundation (add TypeScript checking)

**Files to create/modify:**

| File | Action | Description |
|------|--------|-------------|
| [`tsconfig.json`](tsconfig.json) | **CREATE** | TypeScript config for `--noEmit --checkJs` |
| [`package.json`](package.json) | **MODIFY** | Add `typescript` devDependency + `typecheck` script |

### Phase 2: Define data shapes with `@typedef`

**Create a shared type definitions file [`src/js/types.js`](src/js/types.js)** — loaded first in [`index.html`](src/index.html), contains only JSDoc `@typedef` blocks (no runtime code):

```javascript
// src/js/types.js — pure JSDoc type definitions, zero runtime code

/**
 * @typedef {Object} SearchRecord
 * @property {string} name - Internal search ID
 * @property {string} display_name - Human-readable name (e.g., "Иванов Иван, 1978 г.р.")
 * @property {Array<number>} coords - [lat, lng] coordinates
 * @property {string} [link] - Forum link URL
 * @property {string} [search_type] - Type (e.g., "лес", "город")
 * @property {string} [search_status] - Status (e.g., "Активен", "СТОП")
 * @property {boolean} [search_is_old] - Whether search is older/archived
 * @property {boolean} [exact_coords] - Whether coordinates are exact
 * @property {string} [freshness] - Time since last update
 * @property {string} [content] - HTML description content
 */

/**
 * @typedef {Object} UserData
 * @property {Object} params
 * @property {number} params.home_lat
 * @property {number} params.home_lon
 * @property {number} params.radius
 * @property {Array<string|number>} params.regions
 * @property {Array<SearchRecord>} params.searches
 */

/**
 * @typedef {Object} AppState
 * @property {Array<number>|null} userHomeCoordinates
 * @property {number|null} userRadius
 * @property {Array<string|number>} userRegionIdsList
 * @property {Array<number>|null} currentUserLocation
 * @property {Array<number>|null} startingPoint
 * @property {Array<SearchRecord>} userSearchesList
 * ... (all STATE properties)
 */
```

### Phase 3: Annotate function signatures

Add `@param`/`@returns` to **every public function** across all modules. Priority order:

1. [`map.js`](src/js/map.js) (largest, most complex — 965 lines)
2. [`balloon.js`](src/js/balloon.js) (already partially done)
3. [`controls.js`](src/js/controls.js)
4. [`telegram.js`](src/js/telegram.js)
5. [`description_panel.js`](src/js/description_panel.js)
6. [`info_panel.js`](src/js/info_panel.js)

### Phase 4: Add native API response validation

Add a small **runtime validation function** in [`telegram.js`](src/js/telegram.js) (no external library):

```javascript
/**
 * Validates that an API response has the expected structure.
 * Pure-function alternative to Pydantic — catches malformed data early.
 * @param {any} data - Raw API response
 * @returns {boolean} True if data structure is valid
 */
function validateApiResponse(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.ok !== true) return false;
    if (!Array.isArray(data.params?.searches)) return false;
    return data.params.searches.every(function(s) {
        return typeof s.name === 'string' && Array.isArray(s.coords);
    });
}
```

### Phase 5: Run and fix

```bash
npm run typecheck
```

Fix all TypeScript-reported issues. This will catch:
- Functions called with wrong argument types
- Missing null-check before property access
- Mismatched return types
- Accessing undefined properties

---

## 5. Example Transformation

### Current code ([`map.js:629-668`](src/js/map.js:629))

```javascript
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
    // ...
}
```

### After annotations ([`map.js:629`](src/js/map.js:629))

```javascript
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
    // ...
}
```

### Current STATE ([`map.js:29`](src/js/map.js:29))

```javascript
const STATE = {
    userHomeCoordinates: null,
    userRadius: null,
    // ...
};
```

### After — with `@type` constraint ([`map.js:29`](src/js/map.js:29))

```javascript
/** @type {AppState} */
const STATE = {
    userHomeCoordinates: null,  // TS knows: Array<number>|null
    userRadius: null,            // TS knows: number|null
    userRegionIdsList: [],       // TS knows: Array<string|number>
    // ...
};
```

---

## 6. What You Get vs Python

| Python concept | JS equivalent with this plan | Benefit |
|----------------|------------------------------|---------|
| `x: int` in function def | `@param {number} x` above function | Editor hints, TS type check |
| `-> str` return type | `@returns {string}` | Editor hints, TS type check |
| `@dataclass class Point:` | `@typedef {Object} Point` with properties | TS type check, editor autocomplete |
| `Optional[str]` | `@param {string|null}` or `@param {?string}` | TS catches null dereferences |
| `Union[int, str]` | `@param {number\|string}` | TS validates both types |
| Pydantic `model_validate()` | Native `validateApiResponse()` | Runtime data integrity |
| `mypy` / `pyright` | `npm run typecheck` | Catches type errors before deploy |
| `Literal['a', 'b']` | `@param {'a'\|'b'}` | TS validates exact string values |

---

## 7. Summary & Decision

| Criterion | Current state | After plan |
|-----------|---------------|------------|
| Build tools needed | ❌ None | ❌ Still none (TS is dev-only, no transpile) |
| Runtime validation | ❌ None | ✅ Lightweight native validation for API |
| Static type checking | ❌ None | ✅ `npm run typecheck` catches errors |
| Editor IntelliSense | ⚠️ Partial | ✅ Full — types, autocomplete, docs |
| External dependencies added | — | 1 devDependency: `typescript` |
| Bundle size change | — | Zero (TS is dev-only) |
| Learning curve | — | Low (you already know JSDoc basics) |

---

## Todo List

- [ ] **Phase 1**: Install TypeScript as devDependency, create `tsconfig.json`, add `typecheck` script
- [ ] **Phase 2**: Create [`src/js/types.js`](src/js/types.js) with `@typedef` for SearchRecord, UserData, AppState
- [ ] **Phase 3**: Add `@param`/`@returns` to all functions in [`map.js`](src/js/map.js)
- [ ] **Phase 4**: Add `@param`/`@returns` to all functions in [`balloon.js`](src/js/balloon.js)
- [ ] **Phase 5**: Add `@param`/`@returns` to all functions in [`controls.js`](src/js/controls.js)
- [ ] **Phase 6**: Add `@param`/`@returns` to all functions in [`telegram.js`](src/js/telegram.js)
- [ ] **Phase 7**: Add `@param`/`@returns` to [`description_panel.js`](src/js/description_panel.js) and [`info_panel.js`](src/js/info_panel.js)
- [ ] **Phase 8**: Add native `validateApiResponse()` to [`telegram.js`](src/js/telegram.js)
- [ ] **Phase 9**: Run `npm run typecheck`, fix all TS-reported issues
- [ ] **Phase 10**: Run `npm test` to verify no regressions
