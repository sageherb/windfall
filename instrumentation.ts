// instrumentation.ts
// [demo-mock] MSW server bootstrap for SSR fetch interception
export async function register() {
  if (process.env.NEXT_PUBLIC_DEMO !== 'true') return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { server } = await import('@/mocks/node');
    server.listen({ onUnhandledRequest: 'bypass' });
  }
}
