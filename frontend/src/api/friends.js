import client from './client'

// The friend graph (social feed Phase 0). Symmetric friends, both-accept.
export const requestFriend = (toUserId) =>
  client.post('/friends/request', { to_user_id: toUserId })
export const acceptFriend = (friendshipId) =>
  client.post(`/friends/${friendshipId}/accept`)
export const removeFriend = (friendshipId) =>
  client.delete(`/friends/${friendshipId}`)
// order: 'recent' (default — newest friendship first, the Friends page) or 'active'
// (friends who posted most recently first — the Feed's presence strip, #75).
export const getFriends = (order) =>
  client.get('/friends', { params: order ? { order } : {} })
export const getFriendRequests = () => client.get('/friends/requests')
// Seeded from the handoff graph — people you've handed a recipe to or received one
// from, who aren't already friends. The cold-start seed for the coming feed.
export const getFriendSuggestions = () => client.get('/friends/suggestions')
// Everyone else on the app, so a new user can actually find someone (#80). Optional name
// search. Excludes you, your friends, and anyone with a pending request either way — all
// cases where "Add" would be wrong. Distinct from getFriendSuggestions, which is the
// handoff graph (a much stronger signal, so it stays pinned above this).
export const discoverPeople = (q) =>
  client.get('/friends/discover', { params: q ? { q } : {} })
export const getUserProfile = (userId) => client.get(`/friends/profile/${userId}`)
