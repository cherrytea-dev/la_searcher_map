/**
 * Tests for description_panel.js — DOM creation functions.
 *
 * Functions tested:
 * - createDescriptionPanel()
 */

beforeAll(() => {
  __loadSource('src/js/description_panel.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  // Clean up any panels left from previous tests
  const existing = document.getElementById('container_for_info_panel');
  if (existing) {
    existing.parentNode.removeChild(existing);
  }
});

/* ──────────────── createDescriptionPanel ──────────────── */

describe('createDescriptionPanel()', () => {
  const completeSearch = {
    display_name: 'Иванов Иван',
    content: 'Пропал в лесном массиве',
  };

  const searchWithoutContent = {
    display_name: 'Петров Петр',
    // no content field
  };

  test('creates panel with correct title from display_name', () => {
    createDescriptionPanel(completeSearch);
    const title = document.querySelector('.info-panel-title');
    expect(title).not.toBeNull();
    expect(title.textContent).toBe('Иванов Иван');
  });

  test('shows search content when available', () => {
    createDescriptionPanel(completeSearch);
    const content = document.querySelector('.info-panel-content');
    expect(content).not.toBeNull();
    expect(content.innerHTML).toContain('Пропал в лесном массиве');
  });

  test('shows fallback text when content is missing', () => {
    createDescriptionPanel(searchWithoutContent);
    const content = document.querySelector('.info-panel-content');
    expect(content).not.toBeNull();
    expect(content.innerHTML).toContain('Описание поиска: не определено');
  });

  test('click on backdrop removes the panel', () => {
    createDescriptionPanel(completeSearch);
    const container = document.getElementById('container_for_info_panel');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');

    container.click();

    expect(removeChildSpy).toHaveBeenCalledWith(container);
    removeChildSpy.mockRestore();
  });

  test('click on close button removes the panel', () => {
    createDescriptionPanel(completeSearch);
    const closeBtn = document.getElementById('info_panel_close_button');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');

    closeBtn.click();

    expect(removeChildSpy).toHaveBeenCalled();
    removeChildSpy.mockRestore();
  });

  test('click inside panel does not close it', () => {
    createDescriptionPanel(completeSearch);
    const infoPanel = document.getElementById('info_panel');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');

    // Click inside the info panel
    const clickEvent = new MouseEvent('click', { bubbles: true });
    const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');
    infoPanel.dispatchEvent(clickEvent);

    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(removeChildSpy).not.toHaveBeenCalled();

    removeChildSpy.mockRestore();
    stopPropagationSpy.mockRestore();
  });
});
