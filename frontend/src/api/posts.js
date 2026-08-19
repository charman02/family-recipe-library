import client from './client'

// The presence feed (social feed Phase 1). A post is a light "meal I made" —
// photo + dish name + optional line — not a recipe.
export const createPost = (payload) => client.post('/posts', payload)
// Friends' posts + your own, newest first. Keyset cursor on id: pass the last
// post's id to page backward. id DESC is reverse-chronological (ids are monotonic
// and posts aren't backdated), so this can't skip or repeat a post at a boundary.
export const getFeed = (beforeId) =>
  client.get('/posts/feed', {
    params: beforeId ? { before_id: beforeId } : {},
  })
export const getPost = (id) => client.get(`/posts/${id}`)
export const deletePost = (id) => client.delete(`/posts/${id}`)
export const getUserPosts = (userId) => client.get(`/posts/users/${userId}`)
