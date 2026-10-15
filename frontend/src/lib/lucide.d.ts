// lucide-react ships typed icons via its barrel, but the individual
// `dist/esm/icons/*.js` subpath files have no .d.ts. Declare the subpath
// module so `@/lib/icons` can import icons directly (avoiding the barrel that
// Turbopack chokes on) without type errors.
declare module 'lucide-react/dist/esm/icons/*';
