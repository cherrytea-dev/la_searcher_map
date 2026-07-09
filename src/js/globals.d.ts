/**
 * Ambient type declarations for global-scope dependencies.
 *
 * This file tells TypeScript about variables that exist in the global scope
 * because they are loaded via <script> tags (ymaps, turf, jQuery, etc.)
 * or are declared in other JS files without JSDoc types.
 *
 * No runtime code — declarations only.
 */

/* ──────────────── Yandex Maps (ymaps) ──────────────── */

declare namespace ymaps {
    function ready(callback: () => void): void;

    class Map {
        constructor(id: string, state: object, options?: object);
        setBounds(bounds: any, options?: object): void;
        setCenter(center: number[], zoom?: number, options?: object): void;
        geoObjects: {
            add(obj: any): void;
            remove(obj: any): void;
        };
        controls: {
            add(control: any): void;
        };
        container: {
            getSize(): number[];
        };
        events: {
            add(event: string, handler: Function): void;
            once(event: string, handler: Function): void;
            remove(event: string, handler: Function): void;
        };
        options: {
            set(key: string, value: any): void;
        };
    }

    class Placemark {
        constructor(geometry: number[] | object, properties?: object, options?: object);
    }

    class Circle {
        constructor(geometry: [number[], number], properties?: object, options?: object);
    }

    class Polygon {
        constructor(coordinates: number[][][], properties?: object, options?: object);
    }

    class GeoObject {
        constructor(geometry?: object, options?: object);
    }

    class Layer {
        constructor(urlTemplate: string);
    }

    class MapType {
        constructor(name: string, layers: string[]);
    }

    namespace templateLayoutFactory {
        function createClass(template: string, methods?: object): any;
    }

    namespace control {
        class BaseControl {
            events: {
                add(event: string, handler: Function): void;
                remove(event: string, handler: Function): void;
            };
            state: {
                set(key: string, value: any): void;
                get(key: string): any;
            };
            data: {
                get(key: string): any;
                set(key: string, value: any): void;
            };
            options: {
                set(key: string, value: any): void;
            };
        }

        interface GeolocationControl extends BaseControl {}
        var GeolocationControl: {
            new (options?: object): GeolocationControl;
        };

        interface TrafficControl extends BaseControl {}
        var TrafficControl: {
            new (options?: object): TrafficControl;
        };

        interface Button extends BaseControl {}
        var Button: {
            new (options?: object): Button;
        };

        interface ZoomControl extends BaseControl {}
        var ZoomControl: {
            new (options?: object): ZoomControl;
        };

        interface ListBox extends BaseControl {}
        var ListBox: {
            new (options?: object): ListBox;
        };

        interface ListBoxItem extends BaseControl {}
        var ListBoxItem: {
            new (data: string | object): ListBoxItem;
        };
    }

    namespace multiRouter {
        class MultiRoute {
            constructor(referencePoints: object, options?: object);
            model: {
                setParams(params: object, flag: boolean): void;
                getReferencePoints(): any[];
                setReferencePoints(points: any[], indices: number[]): void;
            };
            events: {
                add(event: string, handler: Function): void;
                remove(event: string, handler: Function): void;
            };
            getActiveRoute(): any | null;
        }
    }

    namespace coordSystem {
        namespace geo {
            function solveDirectProblem(
                startPoint: number[],
                direction: number[],
                distance: number
            ): { endPoint: number[] };
        }
    }

    namespace geolocation {
        function get(options?: object): Promise<{
            geoObjects: {
                options: { set(key: string, value: any): void };
                get(index: number): { properties: { set(props: object): void } };
            };
        }>;
    }

    namespace layer {
        namespace storage {
            function add(key: string, factory: Function): void;
        }
    }

    namespace mapType {
        namespace storage {
            function add(key: string, mapType: MapType): void;
        }
    }
}

/* ──────────────── Turf.js ──────────────── */

declare namespace turf {
    function polygon(coordinates: number[][][]): any;
    function multiPolygon(coordinates: number[][][][]): any;
    function intersect(poly1: any, poly2: any): any | null;
    function area(polygon: any): number;
    function circle(center: number[], radius: number, options?: object): any;
    function booleanContains(feature1: any, feature2: any): boolean;
    function booleanPointInPolygon(point: number[], polygon: any): boolean;
    function centroid(polygon: any): any;
}

/* ──────────────── jQuery ──────────────── */

interface JQueryStatic {
    (selector: string | Element | Document | Window): JQuery;
    each(collection: any, callback: Function): any;
    extend(target: any, ...sources: any[]): any;
    trim(str: string): string;
    inArray(value: any, array: any[]): number;
}

interface JQuery {
    bind(event: string, handler: Function): JQuery;
    unbind(event?: string): JQuery;
    replaceWith(content: string): JQuery;
    get(index: number): Element;
    on(events: string, handler: Function): JQuery;
    off(events?: string): JQuery;
    css(property: string, value?: any): JQuery;
    text(content?: string): JQuery;
    html(content?: string): JQuery;
    append(content: any): JQuery;
    remove(): JQuery;
    addClass(className: string): JQuery;
    removeClass(className: string): JQuery;
    toggleClass(className: string): JQuery;
    attr(name: string, value?: any): JQuery;
    data(key: string, value?: any): JQuery;
    val(value?: any): JQuery;
    each(callback: Function): JQuery;
    find(selector: string): JQuery;
    parent(): JQuery;
    children(): JQuery;
    show(): JQuery;
    hide(): JQuery;
    fadeIn(duration?: number): JQuery;
    fadeOut(duration?: number): JQuery;
    animate(props: object, duration?: number): JQuery;
    length: number;
    selector: string;
}

declare var $: JQueryStatic;
declare var jQuery: JQueryStatic;

/* ──────────────── Telegram ──────────────── */

interface TelegramWebApp {
    initData: string;
    initDataUnsafe: Record<string, any>;
    colorScheme: string;
    expand(): void;
    ready(): void;
    MainButton: TelegramButton;
    BackButton: TelegramButton;
    SettingsButton: TelegramButton;
    HapticFeedback: {
        impactOccurred(style: string): void;
        notificationOccurred(type: string): void;
        selectionChanged(): void;
    };
    themeParams: Record<string, string>;
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
    headerColor: string;
    backgroundColor: string;
    bottomBarColor: string;
    sendData(data: string): void;
    close(): void;
    platform: string;
}

interface TelegramButton {
    setText(text: string): void;
    onClick(callback: Function): void;
    hide(): void;
    show(): void;
}

interface TelegramNamespace {
    WebApp: TelegramWebApp;
    WebView: {
        initParams: Record<string, string>;
    };
}

declare var Telegram: TelegramNamespace;

/* ──────────────── Application Globals ──────────────── */

// userData is set by telegram.js after API call
declare var userData: any;
// userTheme is declared in telegram.js as `let userTheme`
// map is declared in map.js as `map = new ymaps.Map(...)`
declare var map: ymaps.Map;

/* ──────────────── Functions from other modules ──────────────── */

declare function createInfoPanel(): void;
declare function createDescriptionPanel(search: any): void;
declare function declareBalloonClass(record: any): void;
declare function createCityListBox(): any;
declare function removeAllRoutes(): void;
declare function addRoute(record: any, marker: any, startingPoint: number[]): void;
declare function determineStartingPoint(): number[] | null;

/* ──────────────── STATE (declared in map.js with @type {AppState}) ──────────────── */
// STATE is declared in map.js with JSDoc @type {AppState}.
// The AppState typedef is in types.js.
// No declare needed here — map.js has the actual const declaration.
