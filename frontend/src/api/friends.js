import client from './client'

// The friend graph (social feed Phase 0). Symmetric friends, both-accept.
export const requestFriend = (toUserId) =>
  client.post('/friends/request', { to_user_id: toUserId })
export const acceptFriend = (friendshipId) =>
  client.post(`/friends/${friendshipId}/accept`)
export const removeFriend = (friendshipId) =>
  client.delete(`/friends/${friendshipId}`)
export const getFriends = () => client.get('/friends')
export const getFriendRequests = () => client.get('/friends/requests')
// Seeded from the handoff graph — people you've handed a recipe to or received one
// from, who aren't already friends. The cold-start seed for the coming feed.
export const getFriendSuggestions = () => client.get('/friends/suggestions')
export const getUserProfile = (userId) => client.get(`/friends/profile/${userId}`)
