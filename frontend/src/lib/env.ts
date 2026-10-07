/**
 * Demo mode serves built-in sample data from src/lib/mocks so the app works with no backend.
 * It is ON by default while developing, OFF in production builds, and switched off explicitly
 * with NEXT_PUBLIC_DEMO_MODE=false when you connect a real backend.
 */
export const MOCKS_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
