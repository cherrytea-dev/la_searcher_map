/**
 * Balloon / Popup module for LA Searcher Map.
 *
 * Handles the Yandex Maps balloon content composition, layout class creation,
 * and jQuery event binding for balloon buttons (forum link, route, duration,
 * description panel).
 *
 * This module is loaded as a separate file to keep map.js focused on
 * map logic (markers, routes, geocoding) rather than popup UI.
 *
 * Dependencies (global scope):
 *   - jQuery ($)
 *   - ymaps (Yandex Maps API)
 *   - STATE (from map.js)
 *   - createDescriptionPanel (from description_panel.js)
 *   - removeAllRoutes, addRoute, determineStartingPoint (from map.js)
 */

/* ──────────────── composePopupContent ──────────────── */

/**
 * Composes the HTML content for a search record's balloon popup.
 * @param {SearchRecord} search - A search record object.
 * @returns {string} HTML string for the balloon content.
 */
function composePopupContent(search) {
    return `<div class="popup">
        <span class="popup__text"><span class="popup__subtext">БВП:</span> <b>${search.display_name || 'неизвестный'}</b><br>
        <span class="popup__subtext">Тип поиска:</span> ${search.search_type || 'не определено'}<br>
        <span class="popup__subtext">Ищем:</span> ${search.freshness || 'неизвестно'}<br>
        <span class="popup__subtext">Статус поиска:</span> ${search.search_status || 'не определён'}<br>
        <span class="popup__subtext">Координаты:</span> ${search.exact_coords ? 'Точные' : 'ТРЕБУЮТ УТОЧНЕНИЯ'}<br>
        <span class="popup__subtext">Время в пути: </span>
            <span id="route-duration" style="display: none;"></span>
            <span id="route-duration-default" style="display: inline;">
                <button id="button_duration_calculate" class="button_forum">Определить</button>
            </span><br>
        </span>
        <span id="route-duration" style="display: none;"></span><br />
        <button id="button_show_description" class="button_forum">Показать описание поиска</button><br>
        <button id="button_forum" class="button_forum">Перейти на форум</button><br>
        <button id="button_route" class="button_forum">Построить маршрут</button>
    </div>`;
}

/* ──────────────── replaceButtonAndBindYandexLink ──────────────── */

/**
 * Replaces the route button with a "Go to Yandex Maps" button
 * and binds its click handler to open Yandex Maps with a route.
 * @param {SearchRecord} record - The search record.
 */
function replaceButtonAndBindYandexLink(record) {
    $('#button_route').replaceWith(
        '<button id="button_go_to_yandex" class="button_forum">ПЕРЕЙТИ В ЯНДЕКС</button>'
    );

    $('#button_go_to_yandex').on('click', function () {
        const yandexMapsURL = 'https://yandex.ru/maps/?rtext='
            + STATE.startingPoint.join(',')
            + '~'
            + record.coords.join(',')
            + '&rtn=0&rtt=auto&rtm=atm&origin=jsapi_2_1_79&from=api-maps';

        window.open(yandexMapsURL, '_blank');
    });
}

/* ──────────────── declareBalloonClass ──────────────── */

/**
 * Creates a Yandex Maps balloon layout class for a given search record.
 * Binds click handlers for all balloon buttons (forum, route, duration, description).
 *
 * The resulting class is stored in STATE.BalloonContentLayout and used
 * by addMarker() when creating markers.
 *
 * @param {SearchRecord} record - The search record to create a balloon for.
 */
function declareBalloonClass(record) {
    const composedContent = composePopupContent(record);

    STATE.BalloonContentLayout = ymaps.templateLayoutFactory.createClass(composedContent, {
        /** @this {{ events: { fire: Function } }} */
        build: function () {
            STATE.BalloonContentLayout.superclass.build.call(this);

            $('#button_forum').on('click', function () {
                if (record && record.link) {
                    window.open(record.link, '_blank');
                } else {
                    console.error('Invalid link:', record);
                }
            });

            $('#button_route').on('click', function () {
                removeAllRoutes();
                const markerName = record.name;
                STATE.startingPoint = determineStartingPoint();
                if (STATE.startingPoint) {
                    addRoute(record, STATE.markers[markerName], STATE.startingPoint);
                    replaceButtonAndBindYandexLink(record);
                }
            });

            $('#button_duration_calculate').on('click', function () {
                removeAllRoutes();
                const markerName = record.name;
                STATE.startingPoint = determineStartingPoint();
                if (STATE.startingPoint) {
                    addRoute(record, STATE.markers[markerName], STATE.startingPoint);
                    replaceButtonAndBindYandexLink(record);
                }
            });

            $('#button_show_description').on('click', function () {
                createDescriptionPanel(record);
            });
        },

        /** @this {{ events: { fire: Function } }} */
        clear: function () {
            $('#button_forum').off('click');
            $('#button_route').off('click');
            $('#button_duration_calculate').off('click');
            $('#button_show_description').off('click');
            STATE.BalloonContentLayout.superclass.clear.call(this);
        },
    });
}
