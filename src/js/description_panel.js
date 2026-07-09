/**
 * Creates a full-screen modal overlay showing detailed information
 * about a search record. Includes name, description, and a close button.
 * Clicking the backdrop closes the panel.
 *
 * @param {SearchRecord} search - The search record to display.
 * @returns {void}
 */
function createDescriptionPanel(search) {
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
    title.textContent = search.display_name;

    const content = document.createElement('div');
    content.className = 'info-panel-content';
    content.innerHTML = search.content
        ? search.content + '<br>'
        : 'Описание поиска: не определено<br>';

    infoPanel.appendChild(closeButton);
    infoPanel.appendChild(title);
    infoPanel.appendChild(content);
    containerDiv.appendChild(infoPanel);
    document.body.appendChild(containerDiv);
}