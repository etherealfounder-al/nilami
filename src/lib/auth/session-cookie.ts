/**
 * The session cookie's name, alone in its own module.
 *
 * session.ts imports the API client and the API client needs this name, so
 * holding it there would be a cycle. It is also the same reason view-as-cookie
 * exists beside view-as.
 */
export const SESSION_COOKIE = "nilami_session";
