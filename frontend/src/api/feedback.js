import client from './client'

// Send a note about the app. `path` and `appVersion` are the context that makes a
// report actionable without a follow-up conversation — which screen the sender was
// on, and which build they were running. Both are stated in the form's own copy,
// so nothing goes up that the sender wasn't told about.
export const sendFeedback = ({ body, path, appVersion }) =>
  client.post('/feedback', {
    body,
    path: path || null,
    // Unset in local dev, and that must arrive as null rather than the string
    // "undefined" — an invented version is worse than an absent one.
    app_version: appVersion || null,
  })
