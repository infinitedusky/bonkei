// The one way part names are matched (BON-253): the stage's parts list, and anything that later refers to a part by name.
/** Case, runs of spaces, `_` and `-`, and the ends do not matter: "Prep Line", "prep_line" and "prep-line" all find "prep line". */
export const normaliseName = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, ' ').trim()
