/**
 * Loaded BEFORE any module imports in test files. Set env defaults so the
 * env() schema parses cleanly even without a real .env file.
 */
process.env.DATABASE_URL ??= 'postgres://x:y@localhost:5432/z';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.SESSION_SECRET ??= 'test-session-secret-must-be-at-least-32-chars';
process.env.TERMINAL_TOKEN_SECRET ??= 'test-terminal-secret-must-be-at-least-32-chars';
process.env.NODE_ENV = 'test';
