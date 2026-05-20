import { mockLists, mockClubs } from './mock';

export interface PinConfig {
  listIds: number[];
  clubListNames: string[];
  currentWatchingListId: number;
}

const LS_KEYS = {
  pinnedLists: 'palace_pinned_lists',
  pinnedClubs: 'palace_pinned_clubs',
  displayedList: 'palace_displayed_list',
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function load(): PinConfig {
  // Read what Settings page saves
  const pinnedListsMap = loadJson<Record<number, boolean>>(LS_KEYS.pinnedLists, {});
  const pinnedClubsMap = loadJson<Record<number, boolean>>(LS_KEYS.pinnedClubs, {});
  const displayedListName = loadJson<string>(LS_KEYS.displayedList, 'Currently Watching');

  // Convert pinned list IDs (only those with true values)
  const listIds = Object.entries(pinnedListsMap)
    .filter(([, v]) => v)
    .map(([k]) => Number(k));

  // If nothing pinned yet, default to all personal lists so Dashboard isn't empty
  const finalListIds = listIds.length > 0
    ? listIds
    : mockLists.filter(l => !l.club_id).map(l => l.id);

  // Convert pinned club IDs to club names
  const clubListNames = Object.entries(pinnedClubsMap)
    .filter(([, v]) => v)
    .map(([k]) => {
      const club = mockClubs.find(c => c.id === Number(k));
      return club?.name ?? '';
    })
    .filter(Boolean);

  // Default club lists if none pinned
  const finalClubNames = clubListNames.length > 0
    ? clubListNames
    : mockClubs.slice(0, 3).map(c => c.name);

  // Find the list that matches the displayed list name
  const displayedList = mockLists.find(l => l.name === displayedListName);
  const currentWatchingListId = displayedList?.id ?? mockLists[2]?.id ?? 1;

  return {
    listIds: finalListIds,
    clubListNames: finalClubNames,
    currentWatchingListId,
  };
}

// For backward compat, also expose a way to save in the old format
// (Settings page handles its own saving directly)
export const pinStore = {
  get: load,
  // Force reload from localStorage — call this after Settings changes
  refresh: load,
  // Keys for external use
  keys: LS_KEYS,
};
