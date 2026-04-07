// @vitest-environment node
import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";

import { server } from "../../../mocks/node";
import { ApiError, apiClient } from "../api-client";

const BASE = "http://localhost:3000";

describe("apiClient", () => {
  it("GET 요청에 query 파라미터를 직렬화한다 (배열은 다중 키)", async () => {
    let receivedUrl = "";
    server.use(
      http.get(`${BASE}/api/echo`, ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiClient.get("/api/echo", {
      query: {
        startDate: "2026-04-01",
        status: ["active", "paused"],
        skip: undefined,
        empty: null,
      },
    });

    const url = new URL(receivedUrl);
    expect(url.searchParams.get("startDate")).toBe("2026-04-01");
    expect(url.searchParams.getAll("status")).toEqual(["active", "paused"]);
    expect(url.searchParams.has("skip")).toBe(false);
    expect(url.searchParams.has("empty")).toBe(false);
  });

  it("POST 요청은 body 를 JSON 직렬화하고 Content-Type 을 부여한다", async () => {
    let receivedBody: unknown = null;
    let receivedContentType: string | null = null;
    server.use(
      http.post(`${BASE}/api/echo`, async ({ request }) => {
        receivedContentType = request.headers.get("Content-Type");
        receivedBody = await request.json();
        return HttpResponse.json({ ok: true }, { status: 201 });
      }),
    );

    await apiClient.post("/api/echo", { name: "테스트", count: 3 });

    expect(receivedContentType).toBe("application/json");
    expect(receivedBody).toEqual({ name: "테스트", count: 3 });
  });

  it("204 No Content 응답을 안전하게 처리한다", async () => {
    server.use(
      http.delete(
        `${BASE}/api/echo`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(apiClient.delete("/api/echo")).resolves.toBeNull();
  });

  it("실패 응답은 ApiError(status, body) 로 throw 한다", async () => {
    server.use(
      http.get(`${BASE}/api/fail`, () =>
        HttpResponse.json({ message: "권한이 없습니다." }, { status: 403 }),
      ),
    );

    const error = await apiClient.get("/api/fail").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).message).toBe("권한이 없습니다.");
    expect((error as ApiError).body).toEqual({ message: "권한이 없습니다." });
  });
});
