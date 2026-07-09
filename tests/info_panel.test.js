/**
 * Tests for info_panel.js — DOM creation functions.
 *
 * Functions tested:
 * - createImageDescPair()
 * - createInfoPanel()
 */

beforeAll(() => {
  __loadSource('src/js/info_panel.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  // Clean up any panels left from previous tests
  const existing = document.getElementById('container_for_info_panel');
  if (existing) {
    existing.parentNode.removeChild(existing);
  }
});

/* ──────────────── createImageDescPair ──────────────── */

describe('createImageDescPair()', () => {
  test('creates a container with img-desc-container class', () => {
    const el = createImageDescPair('test.png', 'Test description');
    expect(el.className).toBe('img-desc-container');
  });

  test('creates an img element with correct src', () => {
    const el = createImageDescPair('images/icon_home.png', 'Home icon');
    const img = el.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.src).toContain('images/icon_home.png');
  });

  test('creates a span element with correct description text', () => {
    const el = createImageDescPair('test.png', 'Some description');
    const span = el.querySelector('.description');
    expect(span).not.toBeNull();
    expect(span.textContent).toBe('Some description');
  });

  test('handles empty description gracefully', () => {
    const el = createImageDescPair('test.png', '');
    const span = el.querySelector('.description');
    expect(span.textContent).toBe('');
  });
});

/* ──────────────── createInfoPanel ──────────────── */

describe('createInfoPanel()', () => {
  test('appends container div to document body', () => {
    createInfoPanel();
    const container = document.getElementById('container_for_info_panel');
    expect(container).not.toBeNull();
    expect(container.className).toBe('container-for-info-panel');
  });

  test('contains a close button with cross icon', () => {
    createInfoPanel();
    const closeBtn = document.getElementById('info_panel_close_button');
    expect(closeBtn).not.toBeNull();
    const img = closeBtn.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.src).toContain('images/icon_cross.jpg');
  });

  test('contains title with correct text', () => {
    createInfoPanel();
    const title = document.querySelector('.info-panel-title');
    expect(title).not.toBeNull();
    expect(title.textContent).toBe('Справка по Карте Поисковика');
  });

  test('contains 5 image-description pairs for legend', () => {
    createInfoPanel();
    const pairs = document.querySelectorAll('.img-desc-container');
    expect(pairs.length).toBe(5);
  });

  test('click on backdrop removes the panel', () => {
    createInfoPanel();
    const container = document.getElementById('container_for_info_panel');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');

    container.click();

    expect(removeChildSpy).toHaveBeenCalledWith(container);
    removeChildSpy.mockRestore();
  });

  test('click inside panel does not close it', () => {
    createInfoPanel();
    const container = document.getElementById('container_for_info_panel');
    const infoPanel = document.getElementById('info_panel');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');

    // Click inside the info panel — should NOT trigger removal
    const clickEvent = new MouseEvent('click', { bubbles: true });
    const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');
    infoPanel.dispatchEvent(clickEvent);

    // stopPropagation should have been called
    expect(stopPropagationSpy).toHaveBeenCalled();
    // removeChild should NOT have been called (because event didn't bubble to container)
    expect(removeChildSpy).not.toHaveBeenCalled();

    removeChildSpy.mockRestore();
    stopPropagationSpy.mockRestore();
  });
});
