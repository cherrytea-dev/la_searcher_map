/* ──────────────── Theme Configuration ──────────────── */

/** @type {{ dark: { bg: string|null, loaderColor: string }, light: { bg: string|null, loaderColor: string } }} */
const THEME = {
    dark: {
        bg: 'black',
        loaderColor: 'rgb(200, 200, 200)',
    },
    light: {
        bg: null,
        loaderColor: 'rgb(80, 80, 80)',
    },
};

/* ──────────────── Telegram WebApp Initialization ──────────────── */

/**
 * Initializes the Telegram WebApp: expands to full screen and configures
 * Settings, Main, and Back buttons (all hidden by default).
 * @returns {void}
 */
function initTelegramWebApp() {
    const tg = window.Telegram.WebApp;
    tg.expand();

    tg.SettingsButton.onClick(function onSettingsClicked() {
        alert('Settings button clicked!');
    });
    tg.SettingsButton.hide();

    tg.MainButton.setText('Главна кнопа');
    tg.MainButton.onClick(function onSettingsClicked() {
        alert('Settings button clicked!');
    });
    tg.MainButton.hide();

    tg.BackButton.onClick(function onSettingsClicked() {
        alert('Settings button clicked!');
    });
    tg.BackButton.hide();
}

initTelegramWebApp();

/* ──────────────── Entry Point Detection ──────────────── */

let entryPoint = null;

/**
 * Detects the application entry mode based on the runtime environment.
 * Sets the global `entryPoint` variable to one of:
 * - 'web_app' — Telegram WebApp (window.Telegram.WebApp.initData exists)
 * - 'web_view' — Telegram in-app browser (TelegramWebviewProxy exists)
 * - 'web_browser' — Standalone browser (fallback)
 * @returns {void}
 */
function defineEntryPoint() {
    const tgData = window.Telegram;
    const tgWebview = tgData.WebView.initParams;
    const tgWebapp = tgData.WebApp.initDataUnsafe;

    if (Object.keys(tgWebapp).length !== 0) {
        entryPoint = 'web_app';
    } else if (Object.keys(tgWebview).length !== 0) {
        entryPoint = 'web_view';
    } else {
        entryPoint = 'web_browser';
    }
    console.log('entry point is ' + entryPoint);
}

defineEntryPoint();

/* ──────────────── Theme Detection ──────────────── */

/** @type {string|undefined} */
const colorScheme = Telegram.WebApp.colorScheme;
console.log('color scheme is defined by Telegram as ', colorScheme);

let userTheme = 'light';
if (colorScheme) {
    userTheme = colorScheme;
}
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    userTheme = 'dark';
}

/* ──────────────── Constants ──────────────── */

const yandexApiUrl = 'https://api-maps.yandex.ru/2.1/?apikey=e4cd343a-3c64-40e4-8c01-12dafeb612b5&lang=ru_RU';
const yandexRoundedControls = 'js/yandex_rounded_controls.js';
const mapScript = 'js/map.js';

/* ──────────────── Loader ──────────────── */

const loaderCSSCode = `
    <div id="circularG_1" class="circularG"></div>
    <div id="circularG_2" class="circularG"></div>
    <div id="circularG_3" class="circularG"></div>
    <div id="circularG_4" class="circularG"></div>
    <div id="circularG_5" class="circularG"></div>
    <div id="circularG_6" class="circularG"></div>
    <div id="circularG_7" class="circularG"></div>
    <div id="circularG_8" class="circularG"></div>
`;

const loaderCSS = document.createElement('div');
loaderCSS.id = 'circularG';
loaderCSS.className = 'centered_loader';
loaderCSS.innerHTML = loaderCSSCode;

/* ──────────────── DOM Helpers ──────────────── */

/**
 * Appends a DOM element to the login page container.
 * @param {Node} element - The DOM element to append.
 * @returns {void}
 */
function appendToLoginPage(element) {
    document.getElementById('login_page').appendChild(element);
}

/* ──────────────── Loader Color ──────────────── */

/**
 * Updates the CSS custom property for the loader animation color
 * based on the current theme (dark/light).
 * @returns {void}
 */
function updateLoaderColor() {
    const color = THEME[userTheme]?.loaderColor || THEME.light.loaderColor;
    document.documentElement.style.setProperty('--circularG-bg-color', color);
}

/* ──────────────── Script Loading ──────────────── */

/**
 * Dynamically loads a JavaScript file by creating a <script> tag
 * and appending it to <head>. Returns a Promise that resolves on load
 * or rejects on error.
 * @param {string} src - The URL or path of the script to load.
 * @returns {Promise<Event>} A promise that resolves with the load event when the script loads.
 */
function loadSingleScriptByName(src) {
    return new Promise(function (resolve, reject) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Loads the Yandex Maps API script and the rounded controls script
 * sequentially (Yandex API first, then rounded controls).
 * @returns {Promise<void>} A promise that resolves when both scripts are loaded.
 */
async function loadPrerequisiteMapScripts() {
    await loadSingleScriptByName(yandexApiUrl);
    console.log('Yandex Maps API loaded');

    await loadSingleScriptByName(yandexRoundedControls);
    console.log('Yandex rounded controls loaded');
}

/**
 * Loads prerequisite map scripts (Yandex API + rounded controls),
 * then dynamically loads map.js to initialize the map.
 * @returns {Promise<void>} A promise that resolves when map.js is loaded.
 */
async function initiateMapCreation() {
    try {
        await loadPrerequisiteMapScripts();
    } catch (error) {
        console.error('Failed to load Yandex Maps API — map cannot be initialized:', error);
        return;
    }

    const script = document.createElement('script');
    document.getElementById('map').style.display = 'initial';
    script.src = mapScript;
    document.head.appendChild(script);
}

/* ──────────────── Login Page ──────────────── */

/**
 * Creates the login page DOM structure: a centered container with
 * the loader animation. Applies dark background if the theme is dark.
 * @returns {void}
 */
function createLoginPage() {
    const loaderDiv = document.createElement('div');
    loaderDiv.id = 'login_page';
    loaderDiv.className = 'login_page';
    document.body.appendChild(loaderDiv);

    if (userTheme === 'dark') {
        document.body.style.background = THEME.dark.bg;
    }
}

/**
 * Loads the Telegram Login Widget script and creates the login UI
 * (description text + Telegram login button).
 * Only used in web_view and web_browser entry modes.
 * @returns {void}
 */
function loadTelegramLoginScript() {
    document.addEventListener('DOMContentLoaded', function () {
        if (!document.body) {
            console.error('document.body is null or undefined.');
            return;
        }

        const tgLoginText = document.createElement('div');
        tgLoginText.id = 'tg_login_text';
        tgLoginText.className = 'tg_login_text centered';
        tgLoginText.innerHTML =
            'Сервис "Карта Поисковика ЛизаАлерт" работает при аутентификации через Telegram. ' +
            'Если вы являетесь пользователем <a href="https://t.me/LizaAlert_Searcher_Bot">Бота Поисковика ЛА</a>' +
            ', Карта будет отображать поиски в соответствии с вашими настройками бота. Если нет – карта покажет ' +
            'текущие поиски в Московском регионе.<br><br>';
        if (userTheme === 'dark') {
            tgLoginText.style.background = THEME.dark.bg;
        }
        appendToLoginPage(tgLoginText);

        const scriptContainer = document.createElement('div');
        scriptContainer.id = 'script_container';
        scriptContainer.className = 'script_container';
        if (userTheme === 'dark') {
            scriptContainer.style.background = THEME.dark.bg;
        }
        appendToLoginPage(scriptContainer);

        const script = document.createElement('script');
        script.async = true;
        script.id = 'login_script';
        script.className = 'login_script centered';
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', 'LizaAlert_Searcher_Bot');
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        document.getElementById('script_container').appendChild(script);
    });
}

/* ──────────────── Response Validation ──────────────── */

/**
 * Validates the API response structure to ensure it contains
 * the expected fields before passing data to the map module.
 *
 * This is a lightweight runtime validation — the JS equivalent
 * of Pydantic's model validation in Python.
 *
 * @param {Object} data - The parsed JSON response from the API.
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
function validateApiResponse(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
        errors.push('Response is not an object');
        return { valid: false, errors };
    }

    if (data.ok !== true) {
        errors.push('Response ok flag is not true');
    }

    // Searches are nested under data.params.searches (see UserData typedef)
    const searches = data.params && data.params.searches;

    if (!Array.isArray(searches)) {
        errors.push('Response.params.searches is not an array');
    }

    return { valid: errors.length === 0, errors: errors };
}

/* ──────────────── API Call ──────────────── */

/**
 * Makes an API call to the Yandex Cloud Function to fetch search data.
 * Sends a POST request with user authentication data.
 * On success, validates the response and initiates map creation.
 * @param {Object|string} userData - User data object or Telegram init data string.
 * @returns {Promise<void>}
 */
async function apiCall(userData) {
    const apiUrl = 'https://functions.yandexcloud.net/d4edj61cbrdfi15mvvaq';

    try {
        const preflightResponse = await fetch(apiUrl, {
            method: 'OPTIONS',
            headers: { 'Content-Type': 'application/json' },
        });

        const accessControlHeader = preflightResponse.headers.get('Access-Control-Request-Headers');

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(accessControlHeader ? { 'Access-Control-Request-Headers': accessControlHeader } : {}),
            },
            body: JSON.stringify(userData),
        });

        const data = await response.json();
        console.log('Main Request Response:', data);

        // Runtime validation — like Pydantic's model_validate()
        const validation = validateApiResponse(data);
        if (!validation.valid) {
            console.error('API response validation failed:', validation.errors.join('; '));
            const apiReply = document.createElement('p');
            apiReply.innerText = 'Ошибка валидации ответа API: ' + validation.errors.join('; ');
            document.body.appendChild(apiReply);
            return;
        }

        if (data.ok === true) {
            window.userData = data;
            initiateMapCreation();
            console.log('end of file');
        }
    } catch (err) {
        const apiReply = document.createElement('p');
        apiReply.innerText = 'Error in getting API reply: ' + (err ? err : 'N/A');
        document.body.appendChild(apiReply);
        console.log('Main Request Response error:', err);
    }
}

/* ──────────────── Telegram Auth Callback ──────────────── */

/**
 * Callback function for the Telegram Login Widget.
 * Receives the authenticated user object, removes the login UI,
 * shows the loader, and initiates the API call.
 * @param {Object} user - The authenticated Telegram user object (from widget callback).
 * @returns {void}
 */
function onTelegramAuth(user) {
    console.log('User JSON:', JSON.stringify(user, null, 2));
    console.log('Hash: ' + user.hash);

    if (Object.keys(user).length === 0) {
        return;
    }

    const iframe = document.querySelector('iframe');

    if (!iframe) {
        console.log('No iframe element found.');
        return;
    }

    iframe.parentNode.removeChild(iframe);
    document.getElementById('tg_login_text').remove();
    document.getElementById('script_container').remove();
    appendToLoginPage(loaderCSS);

    apiCall(user);
}

/* ──────────────── Application Bootstrap ──────────────── */

document.addEventListener('DOMContentLoaded', function () {
    updateLoaderColor();
    createLoginPage();
});

if (entryPoint === 'web_app') {
    document.addEventListener('DOMContentLoaded', function () {
        createLoginPage();
        appendToLoginPage(loaderCSS);
    });

    apiCall(window.Telegram.WebApp.initData);
} else {
    document.addEventListener('DOMContentLoaded', function () {
        // loadTelegramLoginScript() — deactivated
    });
    loadTelegramLoginScript();
}
