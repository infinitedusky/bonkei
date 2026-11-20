// One way to match names across stages (BON-253): glTF part names here, block-diagram stations in BON-254.
/** Case, runs of spaces, `_` and `-`, and the ends do not matter: "Prep Line", "prep_line" and "prep-line" all find "prep line". */
export const normaliseName = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, ' ')
