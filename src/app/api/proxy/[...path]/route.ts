import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { setAuthCookies, clearAuthCookies } from "@/shared/lib/utils/auth/cookie-options";
import { refreshCookie } from "@/shared/lib/utils/auth/refresh-cookie";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function getRequestBody(req: NextRequest): Promise<{
  body: string | ArrayBuffer | null;
  isFormData: boolean;
}> {
  const contentType = req.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    try {
      return { body: JSON.stringify(await req.json()), isFormData: false };
    } catch {
      return { body: null, isFormData: false };
    }
  }

  if (contentType?.includes("multipart/form-data")) {
    try {
      const arrayBuffer = await req.arrayBuffer();
      return { body: arrayBuffer, isFormData: true };
    } catch (error) {
      console.error("FormData 읽기 실패:", error);
      return { body: null, isFormData: false };
    }
  }

  const arrayBuffer = await req.arrayBuffer();
  return { body: arrayBuffer.byteLength > 0 ? arrayBuffer : null, isFormData: false };
}

async function proxyHandler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  // [demo-mock] demo 모드에서 이 route는 authoritative하다. 들어온 path를
  // `${API_BASE_URL}/${path}` 절대 URL로 변환해서 globalThis.fetch를 호출하면
  // instrumentation.ts에서 부팅된 msw/node가 그 fetch를 가로채서 mock 응답을
  // 돌려준다. 즉 browser Service Worker 활성화 race를 완전히 회피한다.
  const { IS_DEMO } = await import("@/mocks/demo-flag");
  if (IS_DEMO) {
    const { path } = await params;
    const { search } = req.nextUrl;
    const apiUrl = `${API_BASE_URL}/${path.join("/")}${search}`;

    const requestBody = await getRequestBody(req);
    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.delete("content-length");
    if (requestBody.isFormData && req.headers.get("content-type")) {
      headers.set("content-type", req.headers.get("content-type")!);
    }

    try {
      const apiResponse = await fetch(apiUrl, {
        method: req.method,
        headers,
        body: requestBody.body,
        cache: "no-store",
      });
      return new NextResponse(apiResponse.body, {
        status: apiResponse.status,
        headers: apiResponse.headers,
      });
    } catch (error) {
      console.error("[demo-mock] proxy dispatch failed:", error);
      return NextResponse.json(
        { code: 500, status: "ERROR", message: "demo mock dispatch failed", data: null },
        { status: 500 }
      );
    }
  }
  const { path } = await params;
  const pathString = path.join("/");
  const searchParams = req.nextUrl.search;
  const apiUrl = `${API_BASE_URL}/${pathString}${searchParams}`;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  const refreshToken = cookieStore.get("refreshToken")?.value;

  const requestBody = await getRequestBody(req);
  const headers = new Headers(req.headers);

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  headers.delete("host");
  headers.delete("cookie");

  // FormData의 경우 content-length와 content-type을 보존해야 함
  if (requestBody.isFormData) {
    if (req.headers.get("content-type")) {
      headers.set("content-type", req.headers.get("content-type")!);
    }
    if (req.headers.get("content-length")) {
      headers.set("content-length", req.headers.get("content-length")!);
    }
  } else {
    headers.delete("content-length");
  }

  const requestCookies = [];
  if (accessToken) requestCookies.push(`accessToken=${accessToken}`);
  if (refreshToken) requestCookies.push(`refreshToken=${refreshToken}`);
  if (requestCookies.length > 0) {
    headers.set("Cookie", requestCookies.join("; "));
  }

  let retryBody: string | ArrayBuffer | null = requestBody.body;

  if (requestBody.body instanceof ArrayBuffer) {
    retryBody = requestBody.body.slice(0);
  }

  try {
    let apiResponse = await fetch(apiUrl, {
      method: req.method,
      headers,
      body: requestBody.body,
      cache: "no-store",
    });

    if (apiResponse.status === 401 && refreshToken) {
      const newAuthData = await refreshCookie(refreshToken);

      if (!newAuthData) {
        const response = NextResponse.json(
          { error: "Session expired. Please login again." },
          { status: 401 }
        );
        clearAuthCookies(response);
        return response;
      }

      const {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        userId: newUserId,
      } = newAuthData;

      headers.set("Authorization", `Bearer ${newAccessToken}`);

      const retryCookies = [];
      if (newAccessToken) retryCookies.push(`accessToken=${newAccessToken}`);
      if (newRefreshToken) retryCookies.push(`refreshToken=${newRefreshToken}`);
      if (newUserId) retryCookies.push(`userId=${newUserId}`);

      if (retryCookies.length > 0) {
        headers.set("Cookie", retryCookies.join("; "));
      }

      apiResponse = await fetch(apiUrl, {
        method: req.method,
        headers,
        body: retryBody,
        cache: "no-store",
      });

      if (apiResponse.status === 401) {
        const response = NextResponse.json(
          { error: "Session expired even after refresh." },
          { status: 401 }
        );
        clearAuthCookies(response);
        return response;
      }

      const response = new NextResponse(apiResponse.body, {
        status: apiResponse.status,
        headers: apiResponse.headers,
      });

      setAuthCookies(response, newAuthData);

      return response;
    }

    return new NextResponse(apiResponse.body, {
      status: apiResponse.status,
      headers: apiResponse.headers,
    });
  } catch (error) {
    console.error("Proxy Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export {
  proxyHandler as GET,
  proxyHandler as POST,
  proxyHandler as PUT,
  proxyHandler as DELETE,
  proxyHandler as PATCH,
};
