import { http, HttpResponse } from "msw";

import type { ApiResponse } from "../types";

function ok<T>(data: T, message = "정보를 불러왔습니다."): ApiResponse<T> {
  return { code: 200, status: "OK", message, data };
}

const TAG_POOL = [
  { tagId: 1, name: "맥북" },
  { tagId: 2, name: "아이폰" },
  { tagId: 3, name: "노트북" },
  { tagId: 4, name: "카메라" },
  { tagId: 5, name: "의류" },
  { tagId: 6, name: "신발" },
  { tagId: 7, name: "가구" },
  { tagId: 8, name: "도서" },
  { tagId: 9, name: "게임" },
  { tagId: 10, name: "시계" },
];

const RECENT_SEARCHES = [
  { searchId: 1, keyword: "맥북" },
  { searchId: 2, keyword: "아이폰" },
  { searchId: 3, keyword: "닌텐도" },
];

export const miscHandlers = [
  http.get("*/api/v1/tags/search", ({ request }) => {
    const q = new URL(request.url).searchParams.get("query") ?? "";
    const filtered = q ? TAG_POOL.filter((t) => t.name.includes(q)) : TAG_POOL;
    return HttpResponse.json(ok(filtered));
  }),

  http.get("*/api/v1/searches", () => HttpResponse.json(ok(RECENT_SEARCHES))),
  http.post("*/api/v1/searches", () => HttpResponse.json(ok(null))),
  http.delete("*/api/v1/searches/:id", () => HttpResponse.json(ok(null))),
  http.delete("*/api/v1/searches", () => HttpResponse.json(ok(null))),
];
