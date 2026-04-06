import type { z } from "zod";

export function validateResponse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    console.error("[API Response Validation Error]", result.error.flatten());
    throw new Error("API 응답 데이터가 예상 형식과 일치하지 않습니다.");
  }

  return result.data;
}
