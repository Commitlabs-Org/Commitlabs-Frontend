import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/backend/withApiHandler";
import { ok } from "@/lib/backend/apiResponse";
import { validateCommitmentDraft } from "@/lib/backend/validation";

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();

  const result = validateCommitmentDraft(body);

  if (!result.valid) {
    return ok(
      {
        valid: false,
        errors: result.errors,
        warnings: [],
      },
      200
    );
  }

  return ok({
    valid: true,
    errors: [],
    warnings: result.warnings,
    data: result.data,
  });
});