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

export const getSharedWithMe = () => client.get('/recipes/shared')
export const getInvitePreview = (token) =>
  client.get(`/recipes/invite/${token}`)
export const claimInvite = (token) =>
  client.post(`/recipes/invite/${token}/claim`)
