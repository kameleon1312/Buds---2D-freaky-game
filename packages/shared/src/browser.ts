import { z } from 'zod';

// In a browser zod would probe for `new Function` (its fast parser compiles code at run time); the website's
// Content Security Policy forbids eval, so the probe would be reported on every page. The browser gets the plain
// parser instead (the API keeps the fast one). Runs before any schema is made: index.ts exports it first.
if (typeof window !== 'undefined') z.config({ jitless: true });

export {};
