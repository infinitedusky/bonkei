// Bundled fonts a theme can name (theme.label.font). Zen Old Mincho Bold, SIL OFL 1.1 (fonts/OFL-ZenOldMincho.txt),
// subset to Latin (31 KB) because troika loads the whole file. drei's <Text> takes a url.
export const FONTS: Record<string, string> = {
  mincho: new URL('./fonts/ZenOldMincho-Bold-latin.ttf', import.meta.url).href,
}
