/**
 * Global test setup for LA Searcher Map.
 * Sets up all required global mocks before any test file runs.
 *
 * Order matters:
 * 1. DOM setup (jsdom)
 * 2. Global mocks (ymaps, turf, jQuery, Telegram, fetch)
 * 3. Helper to load vanilla JS source files
 */

/* ──────────────── 0. Global window alias ──────────────── */

// jsdom provides `window` but Node's vm.runInThisContext doesn't see it.
// Set global.window = global so source code can reference `window` directly.
global.window = global;

/* ──────────────── 1. DOM Setup ──────────────── */

// Create the map container that map.js expects
const mapDiv = document.createElement('div');
mapDiv.id = 'map';
document.body.appendChild(mapDiv);

// Create login_page element that map.js's ymaps.ready() callback hides
const loginPage = document.createElement('div');
loginPage.id = 'login_page';
document.body.appendChild(loginPage);

// Ensure documentElement exists for CSS variable tests
if (!document.documentElement) {
  const html = document.createElement('html');
  document.appendChild(html);
}

/* ──────────────── 2. Global Mocks ──────────────── */

// ── 2a. Yandex Maps (ymaps) Mock ──

/**
 * Creates a mock ymaps.Map instance.
 */
function createMockMap() {
  const mockMap = {
    setBounds: jest.fn(),
    setCenter: jest.fn(),
    geoObjects: {
      add: jest.fn(),
      remove: jest.fn(),
    },
    controls: {
      add: jest.fn(),
    },
    container: {
      getSize: jest.fn().mockReturnValue([400, 600]),
    },
    events: {
      add: jest.fn(),
      once: jest.fn(),
      remove: jest.fn(),
    },
    options: {
      set: jest.fn(),
    },
  };
  return mockMap;
}

/**
 * Creates a mock Yandex Maps control instance.
 */
function createMockControl() {
  return {
    events: {
      add: jest.fn(),
      remove: jest.fn(),
    },
    state: {
      set: jest.fn(),
      get: jest.fn(),
    },
    data: {
      get: jest.fn(),
      set: jest.fn(),
    },
    options: {
      set: jest.fn(),
    },
  };
}

/**
 * Creates a mock ymaps.GeoObject / Placemark / Circle / Polygon.
 */
function createMockGeoObject() {
  return {
    properties: {
      set: jest.fn(),
      get: jest.fn(),
    },
    events: {
      add: jest.fn(),
      remove: jest.fn(),
    },
    options: {
      set: jest.fn(),
    },
    geometry: {
      set: jest.fn(),
    },
  };
}

/**
 * Creates a mock multiRouter.MultiRoute.
 */
function createMockMultiRoute() {
  return {
    model: {
      setParams: jest.fn(),
      getReferencePoints: jest.fn().mockReturnValue(['start', 'end']),
      setReferencePoints: jest.fn(),
    },
    events: {
      add: jest.fn(),
      remove: jest.fn(),
    },
    getActiveRoute: jest.fn().mockReturnValue(null),
  };
}

// Build the full ymaps mock namespace
const mockMapInstance = createMockMap();
const mockGeoObject = createMockGeoObject();
const mockMultiRoute = createMockMultiRoute();

// Track created ymaps.Map instances for assertions
const ymapsMapInstances = [];

global.ymaps = {
  ready: jest.fn((callback) => {
    // Execute synchronously for tests
    if (typeof callback === 'function') {
      callback();
    }
  }),
  Map: jest.fn(function (...args) {
    const instance = createMockMap();
    // Store reference for assertions
    ymapsMapInstances.push(instance);
    Object.assign(this, instance);
    return this;
  }),
  Placemark: jest.fn(function () {
    return createMockGeoObject();
  }),
  Circle: jest.fn(function () {
    return createMockGeoObject();
  }),
  Polygon: jest.fn(function () {
    return createMockGeoObject();
  }),
  GeoObject: jest.fn(function () {
    return createMockGeoObject();
  }),
  templateLayoutFactory: {
    createClass: jest.fn(function (template, methods) {
      // Return a mock layout class constructor
      const LayoutClass = jest.fn(function () {
        this.build = methods?.build || jest.fn();
        this.clear = methods?.clear || jest.fn();
        this.getParentElement = jest.fn().mockReturnValue(document.createElement('div'));
        this.getData = jest.fn().mockReturnValue({
          state: { get: jest.fn(), add: jest.fn(), removeAll: jest.fn() },
          data: { get: jest.fn() },
          options: { get: jest.fn() },
          control: {
            getMap: jest.fn().mockReturnValue(mockMapInstance),
          },
        });
        this.getElement = jest.fn().mockReturnValue(document.createElement('div'));
        this.getShape = jest.fn().mockReturnValue(null);
        this.events = {
          fire: jest.fn(),
          add: jest.fn(),
          remove: jest.fn(),
        };
        this.childContainerElement = null;
      });
      // Add superclass reference
      LayoutClass.superclass = {
        build: jest.fn(),
        clear: jest.fn(),
      };
      return LayoutClass;
    }),
  },
  control: {
    GeolocationControl: jest.fn(function () {
      const ctrl = createMockControl();
      ctrl.events.add.mockImplementation(function (event, handler) {
        if (event === 'locationchange') {
          // Store handler for manual triggering in tests
          ctrl._locationChangeHandler = handler;
        }
      });
      return ctrl;
    }),
    TrafficControl: jest.fn(function () {
      return createMockControl();
    }),
    Button: jest.fn(function () {
      const ctrl = createMockControl();
      ctrl.events.add.mockImplementation(function (event, handler) {
        if (event === 'click') {
          ctrl._clickHandler = handler;
        }
        if (event === 'select') {
          ctrl._selectHandler = handler;
        }
        if (event === 'deselect') {
          ctrl._deselectHandler = handler;
        }
      });
      return ctrl;
    }),
    ZoomControl: jest.fn(function () {
      return createMockControl();
    }),
    ListBox: jest.fn(function () {
      const ctrl = createMockControl();
      ctrl.events.add.mockImplementation(function (event, handler) {
        if (event === 'click') {
          ctrl._clickHandler = handler;
        }
      });
      return ctrl;
    }),
    ListBoxItem: jest.fn(function (data) {
      const item = createMockControl();
      item.data.get.mockImplementation(function (key) {
        if (typeof data === 'object' && data !== null) {
          return data[key];
        }
        return undefined;
      });
      return item;
    }),
  },
  multiRouter: {
    MultiRoute: jest.fn(function () {
      return createMockMultiRoute();
    }),
  },
  coordSystem: {
    geo: {
      solveDirectProblem: jest.fn(function (startPoint, direction, radius) {
        // Return a predictable end point for testing
        return {
          endPoint: [
            startPoint[0] + direction[0] * radius * 0.00001,
            startPoint[1] + direction[1] * radius * 0.00001,
          ],
        };
      }),
    },
  },
  geolocation: {
    get: jest.fn(function () {
      return Promise.resolve({
        geoObjects: {
          options: {
            set: jest.fn(),
          },
          get: jest.fn().mockReturnValue({
            properties: {
              set: jest.fn(),
            },
          }),
        },
      });
    }),
  },
  layer: {
    storage: {
      add: jest.fn(),
    },
  },
  mapType: {
    storage: {
      add: jest.fn(),
    },
  },
  MapType: jest.fn(),
  Layer: jest.fn(),
};

// Expose mock instances for test assertions
global.__ymapsMockMap = mockMapInstance;
global.__ymapsMapInstances = ymapsMapInstances;

// ── 2b. Turf.js Mock ──

let turfPolygonCounter = 0;
let turfMultiPolygonCounter = 0;

global.turf = {
  polygon: jest.fn(function (coords) {
    turfPolygonCounter++;
    return {
      _mockType: 'polygon',
      _mockId: turfPolygonCounter,
      geometry: {
        type: 'Polygon',
        coordinates: coords,
      },
      properties: {},
    };
  }),
  multiPolygon: jest.fn(function (coords) {
    turfMultiPolygonCounter++;
    return {
      _mockType: 'multiPolygon',
      _mockId: turfMultiPolygonCounter,
      geometry: {
        type: 'MultiPolygon',
        coordinates: coords,
      },
      properties: {},
    };
  }),
  booleanPointInPolygon: jest.fn(function () {
    return false;
  }),
};

// Helpers to reset turf counters
global.__resetTurfCounters = function () {
  turfPolygonCounter = 0;
  turfMultiPolygonCounter = 0;
};

// ── 2c. jQuery Mock ──

function createJqueryMock() {
  const jqMock = jest.fn(function (selector) {
    // Return a jQuery-like object
    return {
      bind: jest.fn(function (event, handler) {
        // Store handler for potential manual trigger
        this._boundHanders = this._boundHanders || {};
        this._boundHanders[event] = handler;
        return this;
      }),
      unbind: jest.fn(function () {
        return this;
      }),
      replaceWith: jest.fn(function () {
        return this;
      }),
      get: jest.fn(function (index) {
        if (index === 0) {
          return document.createElement('div');
        }
        return null;
      }),
      on: jest.fn(function () {
        return this;
      }),
      off: jest.fn(function () {
        return this;
      }),
      css: jest.fn(function () {
        return this;
      }),
      text: jest.fn(function () {
        return this;
      }),
      html: jest.fn(function () {
        return this;
      }),
      append: jest.fn(function () {
        return this;
      }),
      remove: jest.fn(function () {
        return this;
      }),
      addClass: jest.fn(function () {
        return this;
      }),
      removeClass: jest.fn(function () {
        return this;
      }),
      toggleClass: jest.fn(function () {
        return this;
      }),
      attr: jest.fn(function () {
        return this;
      }),
      data: jest.fn(function () {
        return this;
      }),
      val: jest.fn(function () {
        return '';
      }),
      each: jest.fn(function () {
        return this;
      }),
      find: jest.fn(function () {
        return this;
      }),
      parent: jest.fn(function () {
        return this;
      }),
      children: jest.fn(function () {
        return this;
      }),
      show: jest.fn(function () {
        return this;
      }),
      hide: jest.fn(function () {
        return this;
      }),
      fadeIn: jest.fn(function () {
        return this;
      }),
      fadeOut: jest.fn(function () {
        return this;
      }),
      animate: jest.fn(function () {
        return this;
      }),
      length: 0,
      selector: selector || '',
    };
  });

  // Add static jQuery methods
  jqMock.each = jest.fn();
  jqMock.extend = jest.fn();
  jqMock.trim = jest.fn(function (str) { return str ? str.trim() : ''; });
  jqMock.inArray = jest.fn(function () { return -1; });

  return jqMock;
}

global.$ = createJqueryMock();
global.jQuery = global.$;

// ── 2d. Telegram WebApp Mock ──

function createTelegramMock(overrides = {}) {
  const defaults = {
    WebApp: {
      initData: '',
      initDataUnsafe: {},
      colorScheme: 'light',
      expand: jest.fn(),
      ready: jest.fn(),
      MainButton: {
        setText: jest.fn(),
        onClick: jest.fn(),
        hide: jest.fn(),
        show: jest.fn(),
      },
      BackButton: {
        onClick: jest.fn(),
        hide: jest.fn(),
        show: jest.fn(),
      },
      SettingsButton: {
        onClick: jest.fn(),
        hide: jest.fn(),
        show: jest.fn(),
      },
      HapticFeedback: {
        impactOccurred: jest.fn(),
        notificationOccurred: jest.fn(),
        selectionChanged: jest.fn(),
      },
      themeParams: {},
      isExpanded: true,
      viewportHeight: 600,
      viewportStableHeight: 600,
      headerColor: '',
      backgroundColor: '',
      bottomBarColor: '',
      sendData: jest.fn(),
      close: jest.fn(),
      platform: 'web',
    },
    WebView: {
      initParams: {},
    },
  };

  // Deep merge overrides
  const merged = JSON.parse(JSON.stringify(defaults));
  if (overrides.WebApp) {
    Object.assign(merged.WebApp, overrides.WebApp);
  }
  if (overrides.WebView) {
    Object.assign(merged.WebView, overrides.WebView);
  }

  return merged;
}

global.Telegram = createTelegramMock();

// Helper to reconfigure Telegram mock for different entry points
global.__setTelegramEntryPoint = function (entryPoint) {
  switch (entryPoint) {
    case 'web_app':
      global.Telegram.WebApp.initDataUnsafe = { user: { id: 123, first_name: 'Test' } };
      global.Telegram.WebView.initParams = {};
      break;
    case 'web_view':
      global.Telegram.WebApp.initDataUnsafe = {};
      global.Telegram.WebView.initParams = { tgWebAppData: 'test' };
      break;
    case 'web_browser':
    default:
      global.Telegram.WebApp.initDataUnsafe = {};
      global.Telegram.WebView.initParams = {};
      break;
  }
};

// ── 2e. Fetch Mock ──

global.fetch = jest.fn();

// Helper to mock a successful fetch response
global.__mockFetchResponse = function (body, status = 200, headers = {}) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  global.fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: jest.fn(function (name) {
        return headers[name] || null;
      }),
      forEach: jest.fn(),
    },
    text: jest.fn().mockResolvedValueOnce(bodyStr),
    json: jest.fn().mockRejectedValueOnce(new Error('Not JSON — use .text() instead')),
  });
};

// Helper to mock a failed fetch
global.__mockFetchError = function (errorMessage) {
  global.fetch.mockRejectedValueOnce(new Error(errorMessage));
};

// ── 2f. Other Globals ──

// window.open
global.open = jest.fn();

// window.alert
global.alert = jest.fn();

// console — keep real console but allow spying
const originalConsole = { ...console };
global.console = {
  ...originalConsole,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// matchMedia
Object.defineProperty(global, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(function (query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  }),
});

// ── 2g. Global variables expected by source files ──

// userTheme is declared in telegram.js (always loaded before map.js).
// Set a default so map.js doesn't crash when loaded independently.
global.userTheme = 'light';

// ── 2h. Helper to load vanilla JS source files ──

const fs = require('fs');
const path = require('path');

/**
 * Cache of already-loaded source files to avoid `const` redeclaration errors.
 * @type {Set<string>}
 */
const loadedFiles = new Set();

/**
 * Loads a vanilla JS source file into the global scope.
 *
 * Uses indirect eval via `(0, eval)(code)` which runs in the global scope,
 * so function declarations (e.g. `function foo(){}`) become properties of
 * the global object — just like a <script> tag in a browser.
 *
 * However, `const` and `let` declarations in eval create a new lexical scope
 * that is NOT accessible from outside the eval. To work around this, we
 * replace top-level `const` and `let` with `var` (which does become a
 * property of the global object when used in eval in non-strict mode).
 *
 * To avoid `const`/`let` redeclaration errors when the same file is loaded
 * in multiple test suites, we cache loaded files and skip re-execution.
 *
 * @param {string} relativePath - Path relative to project root
 */
global.__loadSource = function (relativePath) {
  const fullPath = path.resolve(__dirname, '..', relativePath);

  if (loadedFiles.has(fullPath)) {
    return; // Already loaded — skip to avoid const redeclaration
  }
  loadedFiles.add(fullPath);

  let code = fs.readFileSync(fullPath, 'utf8');

  // Replace top-level `const` and `let` with `var` so they become
  // properties of the global object when evaluated via indirect eval.
  // Only replace at the top level (not inside functions/blocks).
  // We use a simple heuristic: replace `const ` and `let ` only when
  // they appear at the start of a line (with optional whitespace).
  code = code.replace(/^(\s*)(const|let)\s+/gm, '$1var ');

  // Use indirect eval to run in the global scope.
  (0, eval)(code);
};

/**
 * Resets STATE object between tests (for map.js tests).
 * Must be called after loading map.js source.
 */
global.__resetState = function () {
  if (typeof STATE !== 'undefined') {
    STATE.userHomeCoordinates = null;
    STATE.userRadius = null;
    STATE.userRegionIdsList = [];
    STATE.currentUserLocation = null;
    STATE.startingPoint = null;
    STATE.userSearchesList = [];
    STATE.userCircle = null;
    STATE.turfCircle = null;
    STATE.unitedUserRegionsMultiPolygon = null;
    STATE.listOfRegionObjects = [];
    STATE.userActiveArea = null;
    STATE.boundaries = { show: false };
    STATE.geodesicCirclePoints = null;
    STATE.BalloonContentLayout = null;
    STATE.allRoutes = [];
    STATE.markers = {};
    STATE.balloonMaxWidth = null;
    STATE.polygonForTurf = null;
  }
};
