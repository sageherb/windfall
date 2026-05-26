// instrumentation-client.ts
// [demo-mock] MSW browser bootstrap + auth cookie injection + boundary scheduler
export async function register() {
  if (process.env.NEXT_PUBLIC_DEMO !== 'true') return;
  if (typeof window === 'undefined') return;

  // Inject auth cookies so useIsAuthenticated() (which reads `userId` cookie)
  // returns true and middleware-protected pages render without redirect.
  document.cookie = 'userId=1; path=/; SameSite=Lax';
  document.cookie = 'accessToken=demo-access-token; path=/; SameSite=Lax';
  document.cookie = 'refreshToken=demo-refresh-token; path=/; SameSite=Lax';

  const { worker } = await import('@/mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });

  const { startSseBoundaryScheduler } = await import('@/mocks/time/scheduler');
  startSseBoundaryScheduler();
}
