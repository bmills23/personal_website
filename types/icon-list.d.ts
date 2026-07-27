// Ambient declaration for the plain .mjs source-of-truth icon list. TypeScript
// has no declaration for plain .mjs files under allowJs: false, so a bare
// import of '@/scripts/icon-list.mjs' is TS7016 (implicit any) under strict
// mode even though it resolves and runs fine at build/test time.
//
// This declares only the one specifier actually imported (the "@/..." alias
// form, matched literally by TypeScript regardless of the "paths" mapping),
// rather than a wildcard `declare module '*.mjs'`, which would silently type
// every future .mjs import in the project as `any` instead of just this one.
declare module '@/scripts/icon-list.mjs' {
  export const ICONS: string[]
}
