/**
 * Custom Yandex Maps controls for LA Searcher Map.
 *
 * Provides a region selection ListBox populated from the user's assigned
 * regions (from userData.params.regions). Region names and coordinates
 * are looked up in the regions CSV cached in STATE.regionsCsvText.
 *
 * Dependencies (global scope):
 *   - ymaps (Yandex Maps API 2.1)
 *   - $ (jQuery 2.2.3)
 *   - map (global ymaps.Map instance, set by map.js)
 *   - STATE (global application state, from map.js)
 *   - findRecordById (from map.js)
 *   - convertCoordsStringToArray (from map.js)
 *   - turf (Turf.js for centroid calculation)
 */

/* ──────────────── Region ListBox ──────────────── */

/**
 * Computes the center point for a region record from the CSV.
 *
 * - If coords_type is 'ru_regions_points', the coords column contains
 *   a single [lat, lng] point — parsed directly.
 * - If coords_type is 'ru_regions_poly', the coords column contains
 *   a polygon ring array. The centroid is calculated via turf.centroid().
 *
 * @param {Object} regionRecord - A parsed CSV row object.
 * @returns {Array<number>|null} [lat, lng] center point, or null on failure.
 */
function getRegionCenter(regionRecord) {
    const coordsArray = convertCoordsStringToArray(regionRecord.coords);
    if (!coordsArray) return null;

    if (regionRecord.coords_type === 'ru_regions_points') {
        // coords is a flat [lat, lng] array
        return coordsArray;
    }

    // coords_type is 'ru_regions_poly' — coords is [[[lat, lng], ...]]
    // Take the first ring and compute centroid
    const firstRing = coordsArray[0];
    if (!firstRing || !Array.isArray(firstRing)) return null;

    try {
        // CSV stores coordinates as [lat, lng] (Yandex format).
        // Turf.js expects [lng, lat] (GeoJSON standard), so swap before passing.
        const geoJsonRing = firstRing.map(function (point) {
            return [point[1], point[0]]; // [lat, lng] → [lng, lat]
        });
        const polygon = turf.polygon([geoJsonRing]);
        const centroid = turf.centroid(polygon);
        // Turf returns [lng, lat], swap back to [lat, lng] for Yandex Maps
        return [centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]];
    } catch (e) {
        console.error('Error computing region centroid:', e);
        return null;
    }
}

/**
 * Counts the number of "effective" regions after merging:
 *   - Москва (id: 28) + Московская область (id: 29) → 1 region
 *   - Санкт-Петербург (id: 67) + Ленинградская область (id: 25) → 1 region
 *
 * @param {(string|number)[]} regionIds - List of region IDs from user data.
 * @returns {number} Number of distinct effective regions.
 */
function countEffectiveRegions(regionIds) {
    if (!regionIds || regionIds.length === 0) return 0;

    /** @type {Set<string>} */
    const effectiveRegions = new Set();

    for (const id of regionIds) {
        const idStr = String(id);
        if (idStr === '28' || idStr === '29') {
            effectiveRegions.add('moscow_group');
        } else if (idStr === '67' || idStr === '25') {
            effectiveRegions.add('spb_group');
        } else {
            effectiveRegions.add(idStr);
        }
    }

    return effectiveRegions.size;
}

/**
 * Creates and returns a region selection ListBox control.
 * Populated dynamically from the user's assigned regions in
 * STATE.userRegionIdsList, with data looked up in the CSV cached
 * in STATE.regionsCsvText.
 *
 * Returns null if there is only one effective region (after merging
 * Moscow + Moscow Oblast and St. Petersburg + Leningrad Oblast),
 * so the caller can skip adding the control to the map.
 *
 * @returns {ymaps.control.ListBox|null} The region listbox control, or null if not needed.
 */
function createCityListBox() {
    // Don't show the city selector if there's only one effective region
    if (countEffectiveRegions(STATE.userRegionIdsList) <= 1) {
        return null;
    }
    // Custom layout for the dropdown list header
    // See: https://yandex.ru/dev/maps/jsbox/2.1/list_box_layout
    const ListBoxLayout = ymaps.templateLayoutFactory.createClass(
        "<button id='my-listbox-header' class='btn btn-success dropdown-toggle' data-toggle='dropdown'>" +
        "{{data.title}} <span class='caret'></span>" +
        "</button>" +
        "<ul id='my-listbox'" +
        " class='dropdown-menu' role='menu' aria-labelledby='dropdownMenu'" +
        " style='display: {% if state.expanded %}block{% else %}none{% endif %};'></ul>",
        {
            /** @this {{ childContainerElement: (Element|null), events: { fire: Function } }} */
            build: function () {
                ListBoxLayout.superclass.build.call(this);
                this.childContainerElement = $('#my-listbox').get(0);
                this.events.fire('childcontainerchange', {
                    newChildContainerElement: this.childContainerElement,
                    oldChildContainerElement: null,
                });
            },

            /** @this {{ childContainerElement: (Element|null) }} */
            getChildContainerElement: function () {
                return this.childContainerElement;
            },

            /** @this {{ childContainerElement: (Element|null), events: { fire: Function } }} */
            clear: function () {
                this.events.fire('childcontainerchange', {
                    newChildContainerElement: null,
                    oldChildContainerElement: this.childContainerElement,
                });
                this.childContainerElement = null;
                ListBoxLayout.superclass.clear.call(this);
            },
        }
    );

    const ListBoxItemLayout = ymaps.templateLayoutFactory.createClass(
        "<li><a>{{data.content}}</a></li>"
    );

    // Build list items dynamically from the user's region IDs
    const csvText = STATE.regionsCsvText;
    const regionIds = STATE.userRegionIdsList || [];
    const listBoxItems = [];

    regionIds.forEach(function (regionId) {
        const record = findRecordById(csvText, regionId);
        if (!record) {
            console.warn('Region ID not found in CSV:', regionId);
            return;
        }

        const center = getRegionCenter(record);
        if (!center) {
            console.warn('Could not determine center for region:', record.region);
            return;
        }

        listBoxItems.push(
            new ymaps.control.ListBoxItem({
                data: {
                    content: record.region,
                    center: center,
                    zoom: 9,
                },
            })
        );
    });

    const listBox = new ymaps.control.ListBox({
        items: listBoxItems,
        data: {
            title: 'Выберите регион',
        },
        options: {
            layout: ListBoxLayout,
            itemLayout: ListBoxItemLayout,
        },
    });

    listBox.events.add('click', function (e) {
        const item = e.get('target');
        if (item !== listBox) {
            map.setCenter(item.data.get('center'), item.data.get('zoom'));
        }
    });

    return listBox;
}
