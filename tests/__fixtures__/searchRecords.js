/**
 * Test fixtures for search records.
 * Covers all marker types and edge cases.
 */

const activeExactSearch = {
  name: 'search_active_exact',
  display_name: 'Иванов Иван',
  coords: [55.75, 37.62],
  search_is_old: false,
  exact_coords: true,
  search_status: 'АКТИВЕН',
  search_type: 'Лес',
  freshness: '12 часов',
  link: 'https://example.com/search/1',
  content: 'Пропал в лесном массиве',
  created_at: '2024-01-15T10:00:00Z',
};

const activeSearch = {
  name: 'search_active',
  display_name: 'Петров Петр',
  coords: [55.76, 37.63],
  search_is_old: false,
  exact_coords: false,
  search_status: 'АКТИВЕН',
  search_type: 'Город',
  freshness: '6 часов',
  link: 'https://example.com/search/2',
  content: 'Пропал в городе',
  created_at: '2024-01-14T10:00:00Z',
};

const oldSearch = {
  name: 'search_old',
  display_name: 'Сидоров Сидор',
  coords: [55.77, 37.64],
  search_is_old: true,
  exact_coords: false,
  search_status: 'СТОП',
  search_type: 'Лес',
  freshness: '5 дней',
  link: 'https://example.com/search/3',
  content: 'Найден, жив',
  created_at: '2024-01-10T10:00:00Z',
};

const activeStopSearch = {
  name: 'search_active_stop',
  display_name: 'Алексеев Алексей',
  coords: [55.78, 37.65],
  search_is_old: false,
  exact_coords: true,
  search_status: 'СТОП',
  search_type: 'Водный',
  freshness: '2 дня',
  link: 'https://example.com/search/4',
  content: null,
  created_at: '2024-01-13T10:00:00Z',
};

const minimalSearch = {
  name: 'search_minimal',
  coords: [55.79, 37.66],
  search_is_old: false,
  exact_coords: false,
};

const searchWithMissingFields = {
  name: 'search_missing_fields',
  display_name: 'Тестовый',
  coords: [55.80, 37.67],
  search_is_old: false,
  exact_coords: true,
  // No search_type, freshness, search_status, link, content
};

const allSearches = [
  activeExactSearch,
  activeSearch,
  oldSearch,
  activeStopSearch,
  minimalSearch,
  searchWithMissingFields,
];

module.exports = {
  activeExactSearch,
  activeSearch,
  oldSearch,
  activeStopSearch,
  minimalSearch,
  searchWithMissingFields,
  allSearches,
};
