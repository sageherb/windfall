# Demo Mode — MSW Mock Backend Design

**Author**: Sage
**Date**: 2026-05-27
**Status**: Draft — awaiting review

---

## 1. Goal

원래 백엔드 서버(`windfall-be`, Spring Boot)가 해체되어 운영이 중단된 상태에서, 포트폴리오 데모용으로 이 Next.js 프론트엔드를 **순수 클라이언트/SSR로 자족하는 데모 사이트**로 만든다. 면접관이 호스팅된 URL에 접속하면 **이미 로그인된 사용자처럼** 메인·경매 목록을 둘러볼 수 있고, 접속 5초 후 시드된 알림 1개가 SSE로 도달한다. 그 후 5분/10분/15분 정각 boundary마다 가격이 자동으로 떨어진다.

## 2. Constraints (절대 원칙)

1. **기존 클라이언트 코드(UI, hooks, fetchers, providers, components) 0줄 수정**. demo 모드는 모두 서버 응답 흉내내기로 해결한다.
2. **별도 `demo` 브랜치**에서만 작업한다. `dev`/`main`은 손대지 않는다.
3. **서버 코드 수정은 최소 1줄씩 패치만** 허용하되, 그 자리에 `// [demo-mock] ...` 주석 의무.
4. **새로 추가되는 데모용 파일은 모두 `src/mocks/` 또는 프로젝트 루트의 instrumentation 파일에 격리**한다.
5. **IndexedDB는 사용하지 않는다**. 매 세션마다 깨끗한 시드로 리셋된다.
6. **서버는 Vercel SSR 그대로** 호스팅한다. 정적 export 아님.

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                      │
│  ─────────                                                    │
│  React App (UI/hooks/fetchers 0줄 수정)                       │
│    ├─ fetch("/api/proxy/api/v1/...")                         │
│    ├─ new EventSource("/api/proxy/api/v1/notifications/sub..")│
│    └─ new SockJS(`${API_URL}/ws-stomp...`)  ← mock 안 함      │
│             ▼                                                 │
│  MSW Service Worker (msw/browser)                             │
│    intercepts HTTP + SSE on `/api/proxy/*`                    │
│             ▼                                                 │
│  Mock handlers ──→ In-memory store (per tab)                  │
│                    + Seed JSON (initial)                      │
└──────────────────────────────────────────────────────────────┘
                       ▲ hydrate (React Query dehydrate)
                       │
┌──────────────────────────────────────────────────────────────┐
│  Server (Vercel SSR)                                          │
│  ─────────                                                    │
│  Next.js Server Components                                    │
│    Auctions() → prefetchQuery(auctionsQuery)                  │
│      → fetch("/api/proxy/api/v1/auctions") (Node fetch)       │
│             ▼                                                 │
│  MSW Node (msw/node, started in instrumentation.ts)           │
│    intercepts Node fetch                                      │
│             ▼                                                 │
│  Same handler modules ──→ In-memory store (server, read-only) │
└──────────────────────────────────────────────────────────────┘
```

- **브라우저용 MSW**(`setupWorker`)와 **서버용 MSW**(`setupServer`)가 같은 `handlers/` 모듈을 import하여 핸들러 일관성 보장.
- 서버용 store는 SSR 직렬화용으로만 사용하므로 사실상 read-only. mutation(좋아요, 알림 읽음, 채팅 보내기, 새 경매 생성)은 모두 클라이언트 store에서만 일어남.
- 브라우저 store는 매 worker boot(=새 탭/reload)마다 fresh seed.

## 4. 기존 파일 수정 (정확히 3곳)

| 파일 | 변경 | 주석 |
|---|---|---|
| `src/proxy.ts` (middleware) | function 본문 첫 줄에 `if (process.env.NEXT_PUBLIC_DEMO === 'true') return NextResponse.next();` 추가 | `// [demo-mock] demo 빌드에서는 cookie 검사 없이 통과` |
| `src/app/api/proxy/[...path]/route.ts` | `proxyHandler` 본문 첫 줄에 `if (process.env.NEXT_PUBLIC_DEMO === 'true') return NextResponse.json({error:"demo: no backend"}, {status:503});` | `// [demo-mock] MSW가 가로채지 못한 요청 안전 차단` |

**그 외 어떤 클라이언트/서버 파일도 수정하지 않는다.** `next.config.ts`는 Next.js 16이 instrumentation을 기본 지원하므로 옵션 추가 불필요.

## 5. 신규 파일 구조

```
instrumentation.ts                 ← 서버용 MSW 부팅 (Node runtime)
instrumentation-client.ts          ← 클라이언트용 MSW 부팅 (Next.js 16)

public/
└── mockServiceWorker.js           ← `npx msw init public/ --save` 산출물

src/mocks/
├── browser.ts                     ← setupWorker(handlers)
├── node.ts                        ← setupServer(handlers)
├── store.ts                       ← In-memory store + seed loader + mutators
├── handlers/
│   ├── index.ts                   ← 모든 핸들러 합치기
│   ├── auctions.ts                ← /api/v1/auctions, /search, /:id, /:id/history, /:id/like, /:id/notification-settings, POST 생성
│   ├── notifications.ts           ← 목록 + read + readAll + SSE subscribe
│   ├── auth.ts                    ← /api/v1/auth/* + /api/auth/callback/*
│   ├── chat.ts                    ← /api/v1/chat-rooms[/:id/messages] (REST만, WS는 mock 안 함)
│   ├── users.ts                   ← /api/v1/users/:id + /api/v1/me/*
│   ├── purchases.ts               ← /api/v1/me/purchases + /api/v1/trades/:id/confirm
│   ├── reviews.ts                 ← /api/v1/reviews
│   ├── images.ts                  ← 이미지 업로드 (placeholder URL 반환)
│   └── misc.ts                    ← tags, search history, recent view
├── seed/
│   ├── current-user.json          ← Sage(나) 정보 (자동 로그인 사용자)
│   ├── users.json                 ← 다른 유저 3~5명
│   ├── auctions.json              ← 인기/진행/예정/검색풀 (분량은 §8)
│   ├── notifications.json         ← 초기 알림 6~8개 (읽음/안 읽음 섞임)
│   ├── chat-rooms.json            ← 2~3개
│   ├── chat-messages.json         ← room별 5~10개
│   ├── purchases.json             ← 구매 내역 몇 건
│   └── reviews.json               ← 리뷰 몇 건
└── time/
    ├── price.ts                   ← wall-clock 기반 currentPrice/discountRate 계산
    └── scheduler.ts               ← SSE 발사용 boundary 스케줄러
                                     - notificationSubs[0]에 priceAlert 알림 push + SSE broadcast
                                     - 가격은 mutate하지 않음 (price.ts가 응답 시점에 계산)
                                     - (브라우저 worker에서만 실행, 서버는 비활성)
```

## 6. In-Memory Store

```typescript
// src/mocks/store.ts

import type {
  Auction, AuctionStatus, User, NotificationItem,
  ChatRoom, ChatMessage, Purchase, Review,
} from './types';

type DemoStore = {
  currentUser: User;
  users: Map<number, User>;

  auctions: Map<number, Auction>;
  popularIds: number[];
  processIds: number[];
  scheduledIds: number[];
  endedIds: number[];

  notifications: NotificationItem[];      // 최신순
  nextNotificationId: number;

  likes: Set<number>;                     // 좋아요 누른 auctionId
  notificationSubs: Set<number>;          // 알림 등록한 auctionId (시드에 ≥1 포함)
  recentViews: number[];                  // 최근 본 auctionId
  purchases: Purchase[];
  reviews: Review[];

  chatRooms: Map<number, ChatRoom>;
  chatMessages: Map<number, ChatMessage[]>;

  bootAt: number;                         // worker 부팅 시각 (T+5s 첫 알림 기준)
  firstDemoAlertSent: boolean;            // T+5s 알림 중복 방지
};

let store: DemoStore | null = null;

export function getStore(): DemoStore {
  if (!store) store = buildSeedStore();
  return store;
}

export function nextNotificationId(): number {
  return ++getStore().nextNotificationId;
}
```

- handler closure 안에서 직접 mutate.
- 매 worker boot(=새 탭/reload)마다 새로 빌드되어 fresh seed.
- 서버 store는 한 번 빌드 후 read-only — server-side route handler에서 mutation 응답은 새 seed에서 즉시 새 데이터 반환하되 store에는 적지 않음 (SSR은 후속 mutation을 안 보니 무방).

## 7. 핸들러 매핑 (백엔드 API → mock)

응답 envelope은 백엔드 `ApiResponse<T>` 그대로 유지:
```json
{ "success": true, "code": 200, "message": "OK", "data": { ... } }
```
`SliceResponse<T>`는 `{ slice: T[], hasNext, page, size, timeStamp }`.

| Endpoint | Method | 응답 source | 비고 |
|---|---|---|---|
| `/api/v1/auctions` | GET | store.popularIds/processIds/scheduledIds | `serverAt` = `new Date().toISOString()` |
| `/api/v1/auctions/search` | GET | store.auctions 전체 + 필터 + 페이징 | 무한 스크롤 100개 풀 |
| `/api/v1/auctions/:id` | GET | store.auctions.get(id) | 404 처리 |
| `/api/v1/auctions/:id/history` | GET | 시드 + boundary마다 push된 row | slice 응답 |
| `/api/v1/auctions/:id/like` | POST/DELETE | store.likes toggle | |
| `/api/v1/auctions/:id/notification-settings` | GET/POST | 정적 + store.notificationSubs | |
| `/api/v1/auctions/:id/notification-settings/start` | POST | store.notificationSubs.add | |
| `/api/v1/auctions/:id/seller` | GET | store.users | |
| `/api/v1/auctions` | POST | store에 새 auction push (브라우저에서만) | placeholder image URL 사용 |
| `/api/v1/auctions/:id` | DELETE | store에서 제거 | |
| `/api/v1/notifications` | GET | store.notifications (paginated) | |
| `/api/v1/notifications` | PATCH | 모두 readStatus=true | |
| `/api/v1/notifications/:id` | PATCH | 해당 알림 readStatus=true | |
| `/api/v1/notifications/subscribe` | GET (SSE) | ReadableStream — §9 참조 | |
| `/api/v1/users/:id` | GET | store.users.get(id) ?? currentUser | |
| `/api/v1/users/names` | PUT | currentUser.name 업데이트 | |
| `/api/v1/users/images` | PUT | placeholder URL 응답 | |
| `/api/v1/me/purchases` | GET | store.purchases | |
| `/api/v1/me/likes` | GET | store.likes → auctions | |
| `/api/v1/me/notifications` | GET | 알림 설정 정적 | |
| `/api/v1/me/recentviews` | GET | store.recentViews → auctions | |
| `/api/v1/recentview/:id` | POST/DELETE | store.recentViews | |
| `/api/v1/trades/:id/confirm` | POST | purchases 상태 업데이트 | |
| `/api/v1/reviews` | POST/GET | store.reviews | |
| `/api/v1/reviews/:id` | GET/PUT/DELETE | store.reviews | |
| `/api/v1/users/:id/sales` | GET | currentUser의 판매 목록 | |
| `/api/v1/users/:id/reviews` | GET | store.reviews 필터 | |
| `/api/v1/tags/search` | GET | 정적 tag 풀 | |
| `/api/v1/searches` | GET/POST/DELETE | 정적 검색어 풀 | |
| `/api/v1/chat-rooms` | GET/POST | store.chatRooms | |
| `/api/v1/chat-rooms/:id` | GET | store.chatRooms.get(id) | |
| `/api/v1/chat-rooms/:id/messages` | GET | store.chatMessages.get(id), cursor 페이징 | |
| `/api/v1/chat-rooms/:id/messages/read` | PATCH | no-op success | |
| `/api/v1/chat-images`, `/api/v1/auction-images` | POST | placeholder URL 응답 | |
| `/api/v1/auth/validate-tokens` | GET | 항상 success | |
| `/api/v1/auth/basic` | GET | currentUser 응답 | |
| `/api/v1/auth/callback/*` | GET | success + auth cookie set | |

핸들러 와일드카드 매칭은 `*/api/v1/...` 형태로 절대/상대 URL 모두 커버.

## 8. 시드 데이터 분량

| Category | 개수 |
|---|---|
| 인기 (popularIds) | 15 |
| 진행 중 (processIds) | 15 |
| 예정 (scheduledIds) | 15 |
| 검색·종료 풀 (endedIds + 추가) | 약 55 (인기/진행/예정과 합쳐 총 ≈ 100) |
| **auctions 총합** | **약 100** (무한 스크롤 충분) |
| 알림 초기 (notifications) | 6~8 (읽음/안 읽음 섞임) |
| 사용자 (current + others) | 1 + 4 = 5 |
| 채팅방 | 3 |
| 채팅방당 메시지 | 7~10 |
| 구매 내역 | 3 |
| 리뷰 | 5 |
| 알림 등록 (notificationSubs 초기) | 1개 — T+5s 첫 알림 대상 |

이미지는 모두 **Unsplash URL**(`https://images.unsplash.com/photo-xxx?w=600`) 사용.

## 9. SSE Mock + Notification Timing

### Handler 구조

```typescript
const subscribers = new Set<ReadableStreamDefaultController>();

http.get('*/api/v1/notifications/subscribe', () => {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      subscribers.add(controller);

      // 연결 즉시 keepalive comment
      controller.enqueue(encoder.encode(': ping\n\n'));

      // T+5s — 첫 데모 알림 1회 (중복 방지)
      const s = getStore();
      if (!s.firstDemoAlertSent) {
        s.firstDemoAlertSent = true;
        setTimeout(() => emitFirstDemoAlert(controller), 5_000);
      }
    },
    cancel() {
      if (controllerRef) subscribers.delete(controllerRef);
    },
  });

  return new HttpResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});
```

### 가격 계산: wall-clock 기반 on-demand

**boundary scheduler로 store를 mutate하지 않는다.** 매 mock 응답이 응답 시점의 wall clock을 보고 그때그때 `currentPrice`를 계산한다. 이렇게 하면 boundary 시점과 throttledInvalidate 발사 시점 사이의 millisecond race가 원천 봉쇄된다.

```typescript
// src/mocks/time/price.ts
export function computeCurrentPrice(
  auction: { startPrice: number; dropAmount: number; startedAt: string; stopLoss: number },
  now: number = Date.now()
): number {
  const startMs = Date.parse(auction.startedAt);
  if (!Number.isFinite(startMs) || now < startMs) return auction.startPrice;
  const steps = Math.floor((now - startMs) / (5 * 60_000));
  const raw = auction.startPrice - steps * auction.dropAmount;
  return Math.max(auction.stopLoss, raw);
}

export function computeDiscountRate(startPrice: number, currentPrice: number): number {
  if (startPrice <= 0) return 0;
  return Math.floor(((startPrice - currentPrice) / startPrice) * 100);
}
```

store에는 `startPrice`/`dropAmount`/`startedAt`/`stopLoss`만 저장. mock handler는 응답을 만들 때마다 위 함수로 `currentPrice`/`discountRate`를 계산해서 body에 채워 넣는다.

```typescript
// 예: GET /api/v1/auctions handler
http.get('*/api/v1/auctions', () => {
  const s = getStore();
  const now = Date.now();
  const project = (id: number) => {
    const a = s.auctions.get(id)!;
    return {
      ...a,
      currentPrice: computeCurrentPrice(a, now),
      discountRate: computeDiscountRate(a.startPrice, computeCurrentPrice(a, now)),
    };
  };
  return HttpResponse.json({
    success: true, code: 200, message: 'OK',
    data: {
      serverAt: new Date(now).toISOString(),
      popularList: s.popularIds.map(project),
      processList: s.processIds.map(project),
      scheduledList: s.scheduledIds.map(project),
    },
  });
});
```

### SSE 발사 스케줄러 (가격 mutate와 분리)

알림 발사용 setTimeout 체인은 별도로 유지:

```typescript
// src/mocks/time/scheduler.ts
function msUntilNextBoundary() {
  return (5 * 60_000) - (Date.now() % (5 * 60_000));
}

export function startSseBoundaryScheduler() {
  const fire = () => {
    emitBoundaryNotification();   // notificationSubs[0]에 priceAlert 알림 broadcast
    setTimeout(fire, msUntilNextBoundary());
  };
  setTimeout(fire, msUntilNextBoundary());
}
```

`emitBoundaryNotification`은 store.notifications에 알림 unshift + SSE broadcast만 담당. **가격은 건드리지 않음** — 가격은 매 응답마다 wall-clock으로 자동 계산되므로.

### 가격 visible drop 메커니즘 (기존 클라 코드가 자체 처리)

mock 측에서는 store에 가격을 차감하기만 하면 된다. 클라이언트가 알아서 5분 정각 boundary에 refetch를 발사한다.

**기존 메커니즘 (수정 없음)**:

- `useServerTimeSync({ serverTime, queryKey })` 훅이 두 곳에서 호출된다:
  - `src/screens/main/ui/auctions-client.tsx` — `queryKey: ["auctions"]`
  - `src/screens/auction/auction-list/ui/auction-list.tsx` — 검색/필터 쿼리 키
- 응답에 포함된 `serverAt`/`serverTime`이 `useServerTimeStore`에 저장된다 (server-client time offset 계산).
- `useServerTimeTicker`가 1초마다 `serverNowMs`를 update.
- `calculateNextPriceDropSeconds(serverNowMs, 5*60*1000)`로 다음 5분 정각 boundary까지 남은 초 계산.
- boundary 직전 1초(prevSeconds === 1 → currentSeconds === 0) 시점에 `useThrottledInvalidate(queryKey)`가 발사 → React Query가 해당 queryKey의 active queries를 refetch.

**mock 측 책임**:

1. 모든 list 응답에 `serverAt`/`serverTime` 필드를 현재 wall clock(ISO string)으로 포함.
2. store의 boundary scheduler가 5분 정각마다 진행 중 경매의 `currentPrice`를 차감.
3. 차감 직후 클라이언트가 throttledInvalidate로 refetch → MSW가 store의 새 가격을 응답 → 화면 자동 갱신.

**즉 클라 코드 수정 없이 메인·`/auctions` 양쪽에서 가격 visible drop이 자동 작동.** 경매 상세 페이지는 별도로 `AuctionTickerProvider`(Web Worker)가 동일 boundary에 자체 가격 차감을 처리한다.

### Reconnection 안전성

`NotificationSseProvider`의 exponential backoff와 호환. 매 새 연결마다 새 controller 등록.

### Broadcast

```typescript
function broadcast(eventName: string, payload: NotificationItem) {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  const bytes = new TextEncoder().encode(data);
  for (const c of subscribers) {
    try { c.enqueue(bytes); } catch {}
  }
}
```

이벤트 이름은 `notification-sse-provider.tsx`의 `SSE_EVENT_TYPES`(`priceAlert`, `auctionStartAlert`, `auctionFailedSeller` 등)에 맞춤.

### 첫 데모 알림 (T+5s)

```typescript
function emitFirstDemoAlert(controller: ReadableStreamDefaultController) {
  const s = getStore();
  const subId = [...s.notificationSubs][0];
  if (!subId) return;
  const auction = s.auctions.get(subId)!;

  const item: NotificationItem = {
    notificationId: nextNotificationId(),
    type: 'AUCTION_START_WISHLIST',
    title: '관심 경매가 시작됐어요',
    message: `${auction.title} 경매가 시작됐습니다.`,
    readStatus: false,
    target: 'auction',
    targetId: subId,
    notificationAt: new Date().toISOString(),
  };

  s.notifications.unshift(item);
  emitSseEvent(controller, 'auctionStartAlert', item);
}
```

## 10. WebSocket (STOMP/SockJS) 정책

`useAuctionSocket`(경매 상세)과 `useChatRoomSocket`(채팅)에서 SockJS로 `${API_URL}/ws-stomp*` 연결을 시도한다.

- **MSW로 mock 안 함**. SockJS+STOMP는 별도 프로토콜이고 mock 비용이 크다.
- 연결 시도 → 실패 → 무한 reconnect → 콘솔 에러. **UI는 안 깨짐**:
  - 경매 상세 페이지: 가격은 `AuctionTickerProvider`(Web Worker)가 자체 처리. status 변경 안 일어남(데모). emoji 미동작.
  - 채팅 페이지: 정적 메시지 기록은 보임. 메시지 보내기는 작동 안 함 (사용자 의사 결정).
- `NEXT_PUBLIC_API_URL`은 dummy URL(예: `https://demo-disabled.local`)로 설정해 실제 외부로 새 나가지 않도록.

## 11. 자동 로그인 / Middleware

### 진입 흐름

- 첫 진입 URL이 `/`, `/auctions`, `/(public)/*`이면 middleware matcher 미해당 → 통과.
- 첫 진입 URL이 `/payments/*`, `/notifications/*`, `/users/*`, `/dm/*`, `/auctions/create` 등이면 middleware matcher 해당. 원래 로직은 cookie 검사 후 `/auth/login` 리다이렉트. 데모에서는 **§4의 한 줄 패치**로 항상 `NextResponse.next()` 반환.

### user 정보 mock

- `useUserBasic()`이 호출하는 `/api/v1/auth/basic` 또는 `/api/v1/users/:id` 핸들러가 `currentUser` 시드를 즉시 응답.
- `isAuthenticated = Boolean(user)` → true → `NotificationSseProvider`가 SSE 자동 연결.

### Cookie 측면

- mock 응답에 Set-Cookie를 굳이 발급하지 않아도 middleware는 이미 통과 (§4 패치).
- 새로고침/페이지 이동 시 마찬가지로 통과.

## 12. Bootstrap (instrumentation 파일)

### `instrumentation.ts` (서버용)

```typescript
// instrumentation.ts (project root)
export async function register() {
  if (process.env.NEXT_PUBLIC_DEMO !== 'true') return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { server } = await import('@/mocks/node');
    server.listen({ onUnhandledRequest: 'bypass' });
  }
}
```

### `instrumentation-client.ts` (Next.js 16)

```typescript
// instrumentation-client.ts (project root)
export async function register() {
  if (process.env.NEXT_PUBLIC_DEMO !== 'true') return;
  if (typeof window === 'undefined') return;
  const { worker } = await import('@/mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });

  const { startSseBoundaryScheduler } = await import('@/mocks/time/scheduler');
  startSseBoundaryScheduler();
}
```

> Next.js 16에서 `instrumentation-client.ts`가 표준 client bootstrap entry. `register()`는 첫 client navigation 이전에 호출되므로 worker가 시작된 뒤에야 fetch가 발생함이 보장된다.

### `src/mocks/browser.ts`

```typescript
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

### `src/mocks/node.ts`

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 환경 변수 (`demo` 브랜치)

`.env.demo` (또는 Vercel project env):
```
NEXT_PUBLIC_DEMO=true
NEXT_PUBLIC_API_URL=https://demo-disabled.local
```

## 13. 의존성

- `msw@^2`
- (이미 설치됨) `@stomp/stompjs`, `sockjs-client`, `@tanstack/react-query`, `zustand`

**IndexedDB(idb) 사용 안 함.**

## 14. 비범위 (out of scope)

- 채팅 실시간 메시지 송수신 (정적 기록만)
- 경매 상세의 STOMP 기반 viewer count / 이모지 broadcast
- 결제 SDK (`@tosspayments/tosspayments-sdk`) 실제 결제 — mock으로 success 처리
- 가격 변동 history의 실제 백엔드 algorithm 재현 (5% drop으로 단순화)
- SEO/오픈 그래프

## 15. 검증 전략 (테스트는 minimal)

- 자동화 테스트는 deferred. 다음 수동 시나리오를 demo 브랜치 빌드 후 확인:
  1. `/` 진입 시 시드된 인기·진행·예정 카드가 보임
  2. 5분 boundary가 페이지 보는 동안 발생 시 가격 차감 + Toast/알림 도착
  3. 접속 T+5초 시점에 토스트 + 알림 리스트 prepend
  4. `/auctions` 무한 스크롤 작동 + 검색/필터 동작
  5. `/auctions/:id` 진입 시 가격 ticker 카운트다운 + Web Worker가 가격 차감
  6. `/notifications` 페이지에서 알림 읽음 처리 → store 반영 → 새로고침 후 다시 안 읽음 상태(매 세션 리셋 확인)
  7. `/users/me` 마이페이지 정적 데이터 표시
  8. `/dm` 채팅방 진입 시 정적 메시지 보이고, 보내기 시도 시 콘솔 에러 (의도된 동작)
  9. 콘솔에서 SSE 연결·재연결 정상 동작 확인
  10. demo 모드 끄고 `dev` 브랜치 build → 기존 동작 회귀 없음 확인 (단, 백엔드 없으니 fetch 실패 상태)

## 16. 알려진 한계 / 트레이드오프

- **첫 페인트**: SSR prefetch가 msw/node를 통하므로 SSR HTML에 시드 데이터 포함. 빠른 first paint 유지.
- **SSR과 client store 분기**: 서버 store와 클라이언트 store가 분리되어 있어 SSR 시점에는 항상 fresh seed 응답. 첫 hydrate는 SSR과 client가 같은 시드라 차이 없음. 이후 client store에서 mutation(좋아요, 알림 읽음, 가격 drop 등)이 발생한 뒤 **page navigation으로 SSR이 재발동되면 그 SSR 응답은 fresh seed로 돌아옴**. 단, React Query의 `staleTime`/`HydrationBoundary`가 기존 client cache를 우선시하므로 사용자가 실제로 보는 화면에는 mutation이 유지된다. (Hard reload만이 client store까지 리셋시킴 — 정책상 의도된 동작)
- **콘솔 에러**: SockJS 연결 실패로 인한 console.error 스팸. 데모 정책상 수용.
- **5분 boundary 가격 drop**: 면접관이 5분 이내에 떠나면 visible drop을 못 봄. T+5s 알림이 데모 포인트의 일차 hook.

## 17. Open Questions

- 없음 (모든 디자인 결정이 사용자와 합의됨).

---

이 spec은 implementation plan의 기반이 된다. plan은 별도 작성될 예정.
