// [demo-mock] Hardcoded flag for the demo branch.
// Replaces process.env.NEXT_PUBLIC_DEMO so we don't depend on Vercel env
// vars or next.config env inlining (Turbopack does not always honor it).
export const IS_DEMO = true;
