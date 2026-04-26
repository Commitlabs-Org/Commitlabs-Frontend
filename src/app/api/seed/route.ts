import { withApiHandler } from "@/lib/backend/withApiHandler";
import { ok } from "@/lib/backend/apiResponse";
import { seedMockData, isSeedAllowed } from "@/lib/backend/seed";
import type { NextRequest } from "next/server";

export const POST = withApiHandler(async (req: NextRequest) => {
  // Hard guard: reject immediately outside development/test + flag check
  if (!isSeedAllowed()) {
    return ok({ message: "Not Found" }, 404);
  }

  const secret = req.headers.get("x-seed-secret");
  const result = await seedMockData(secret);

  if (!result.seeded) {
    // Distinguish auth failure from other errors
    if (result.message === "Invalid seed secret.") {
      return ok({ message: result.message }, 403);
    }
    return ok({ message: result.message }, 500);
  }

  return ok({ message: result.message }, 200);
});

const _405 = methodNotAllowed(['POST']);
export { _405 as GET, _405 as PUT, _405 as PATCH, _405 as DELETE };
