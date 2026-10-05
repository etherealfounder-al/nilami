/**
 * The view-as cookie's name and lifetime, alone in their own module.
 *
 * The API client needs the name to relay the cookie, and the view-as helpers
 * need the API client; putting the constants here keeps those two from
 * importing each other.
 */

/** Holds the profile id a platform admin is proxying into. */
export const VIEW_AS_COOKIE = "nilami_view_as";

/** A support session should not outlive the reason it was started. */
export const VIEW_AS_MAX_AGE = 60 * 60;
