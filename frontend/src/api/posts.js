import client from './client'

// The presence feed (social feed Phase 1). A post is a light "meal I made" —
// photo + dish name + optional line — not a recipe.
export const createPost = (payload) => client.post('/posts', payload)
// The presence feed, newest first. Keyset cursor on id: pass the last post's id to page
// backward. id DESC is reverse-chronological (ids are monotonic and posts aren't
// backdated), so this can't skip or repeat a post at a boundary.
// scope: 'friends' (default — your friends' + own posts) or 'everyone' (public posts from
// non-friends, #70). Omitted → the backend's 'friends' default.
export const getFeed = (beforeId, scope) =>
  client.get('/posts/feed', {
    params: {
      ...(beforeId ? { before_id: beforeId } : {}),
      ...(scope ? { scope } : {}),
    },
  })
export const getPost = (id) => client.get(`/posts/${id}`)
export const deletePost = (id) => client.delete(`/posts/${id}`)
export const getUserPosts = (userId) => client.get(`/posts/users/${userId}`)
