import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/backend/withApiHandler";
import { ok } from "@/lib/backend/apiResponse";
import { validateCommitmentDraft } from "@/lib/backend/validation";
import { ValidationError } from "@/lib/backend/errors";

export const POST = withApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    throw new ValidationError('Invalid JSON in request body');
  }

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