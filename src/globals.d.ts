/** Build-time constants, replaced by tsdown (see tsdown.config.ts). */

/** package.json version */
declare const __VERSION__: string;
/** true in the IIFE bundle (production, dev warnings compiled out), false in ESM/CJS */
declare const __NF_IIFE__: boolean;
/**
 * Replaced by the consumer's bundler (`process.env.NODE_ENV`); an unbundled
 * import has no `process`, so every read sits inside a try block (see `warn` in shared.ts).
 */
declare const process: { env: { NODE_ENV?: string } };
