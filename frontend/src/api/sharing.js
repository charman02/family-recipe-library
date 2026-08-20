import client from './client'

// Recipe writes plus the sharing surface — the handoff and the invite a recipient
// claims. Was api/lineage.js: the tree it was named for is gone, but these calls
// are the app's actual signature (one recipe, handed to one person), so they were
// renamed rather than removed.
export const plantRecipe = (payload) => client.post('/recipes', payload)
export const deleteRecipe = (id) => client.delete(`/recipes/${id}`)
export const cookRecipe = (id, body = {}) =>
  client.post(`/recipes/${id}/cook`, body)
export const handoffRecipe = (id, body) =>
  client.post(`/recipes/${id}/handoff`, body)
export const setVisibility = (id, visibility) =>
  client.patch(`/recipes/${id}`, { visibility })
// Structure whatever someone said about a recipe into fields. Saves nothing; the
// response carries `ai: false` when the model was unavailable, which is the caller's
// signal to fall back to the local line-based parser rather than trust an empty result.
export const parseRecipeWithAI = (text) => client.post('/recipes/parse', { text })

// Rescale a recipe to a target serving count. Returns the full recipe with its
// ingredient amounts scaled — precise ones by arithmetic, folk/imprecise ones only
// when the result is still a whole vessel, and non-linear ones kept verbatim with a
// `scale_note` (×N) for the cook to apply by feel. Saves nothing; the recipe's own
// stored amounts are never touched.
export const scaleRecipe = (id, servings) =>
  client.get(`/recipes/${id}/scale`, { params: { servings } })

export const getSharedWithMe = () => client.get('/recipes/shared')
// A user's recipes for their profile grid (#69). Visibility-gated server-side by
// can_view: own → all; friend → public + friends; stranger → public only. Never a
// private or individually-handed-off recipe. Pairs with getUserPosts in api/posts.js.
export const getUserRecipes = (userId) => client.get(`/recipes/users/${userId}`)
export const getInvitePreview = (token) =>
  client.get(`/recipes/invite/${token}`)
export const claimInvite = (token) =>
  client.post(`/recipes/invite/${token}/claim`)
