import client from './client'

// The inbox (#79). issei had no notification surface at all before this; the request loop
// needs one on both ends — the cook learns someone asked, the requester learns it arrived.
// One generic feed rather than a counter per feature, so friend requests and accepts land
// here too and there is a single place a person looks.

// Newest first, keyset-paginated on id (ids are monotonic; rows are never backdated).
// Returns { notifications, unread_count } — the badge and the list are always wanted
// together, and the count is derived server-side so it can't drift from the rows.
export const getNotifications = (beforeId) =>
  client.get('/notifications', { params: beforeId ? { before_id: beforeId } : {} })

// Mark read — all of the caller's unread ones, or just the ids given. Always scoped to the
// caller server-side. Returns the refreshed list, so no second call to update the badge.
export const markNotificationsRead = (ids) =>
  client.post('/notifications/read', ids ? { ids } : {})
