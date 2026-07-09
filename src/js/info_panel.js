/**
 * Creates a DOM element containing an image and a description text,
 * used in the info panel legend to show marker icon meanings.
 *
 * @param {string} src - The image source URL/path.
 * @param {string} desc - The description text for the image.
 * @returns {HTMLDivElement} A div container with the image and description.
 */
function createImageDescPair(src, desc) {
    const imgDescContainer = document.createElement('div');
    imgDescContainer.className = 'img-desc-container';

    const imgContainer = document.createElement('div');
    imgContainer.className = 'img-container';
    imgDescContainer.appendChild(imgContainer);

    const img = document.createElement('img');
    img.src = src;
    imgContainer.appendChild(img);

    const text = document.createElement('span');
    text.className = 'description';
    text.textContent = desc;
    imgDescContainer.appendChild(text);

    return imgDescContainer;
}

/**
 * Creates and displays the "About the Map" help panel.
 * Shows a legend with marker icon descriptions and general information
 * about the Searcher Map service.
 * @returns {void}
 */
function createInfoPanel() {
    const containerDiv = document.createElement('div');
    containerDiv.id = 'container_for_info_panel';
    containerDiv.className = 'container-for-info-panel';

    containerDiv.addEventListener('click', function() {
        document.body.removeChild(containerDiv);
    });

    const infoPanel = document.createElement('div');
    infoPanel.id = 'info_panel';
    infoPanel.className = 'info-panel';

    infoPanel.addEventListener('click', function(event) {
        event.stopPropagation();
    });

    const closeButton = document.createElement('div');
    closeButton.id = 'info_panel_close_button';
    closeButton.className = 'info-panel-close-button';
    closeButton.innerHTML = '<img src="images/icon_cross.jpg" alt="Close" style="width: 36px; height: 36px;">';

    closeButton.addEventListener('click', function(event) {
        event.stopPropagation();
        document.body.removeChild(containerDiv);
    });

    const title = document.createElement('h2');
    title.className = 'info-panel-title';
    title.textContent = 'Справка по Карте Поисковика';

    const content = document.createElement('div');
    content.className = 'info-panel-content';

    const para1 = document.createElement('p');
    para1.textContent = 'Карта Поисковика – это дополнительный функционал Бота Поисковика и основана на ваших персональных настройках, указанных в боте: список регионов, домашние координаты и максимальный радиус до поисков.';
    content.appendChild(para1);

    const para3 = document.createElement('p');
    para3.textContent = 'Условные обозначения:';
    content.appendChild(para3);

    content.appendChild(createImageDescPair('images/icon_home.png', 'Ваши "Домашние координты", если вы ранее указывали их в боте'));
    content.appendChild(createImageDescPair('images/icon_curr_loc.png', 'Ваше текушее положение, если вы разрешили его определение'));
    content.appendChild(createImageDescPair('images/icon_marker_green.png', 'Активный Поиск, имеет штаб c точными координатами, к тому же по поиску были изменения за последние трое суток'));
    content.appendChild(createImageDescPair('images/icon_marker_orange.png', 'Поиск без штаба, по которому были изменения в последние трое суток'));
    content.appendChild(createImageDescPair('images/icon_marker_grey.png', 'Поиски без изменений в последние трое суток (на карте отображается не более 30 поисков всех типов)'));

    const para5 = document.createElement('p');
    para5.innerHTML = 'Карта находится на стадии тестирования. Если что-то работает не корректно, пожалуйста, ' +
        'напишите об этом разработчикам в <a href="https://t.me/c/1546571473/4909">чате</a>';
    content.appendChild(para5);

    infoPanel.appendChild(closeButton);
    infoPanel.appendChild(title);
    infoPanel.appendChild(content);
    containerDiv.appendChild(infoPanel);
    document.body.appendChild(containerDiv);
}