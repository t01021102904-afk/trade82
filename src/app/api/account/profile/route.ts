import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  linkedinUrlField,
  rateLimitOrResponse,
  readJsonObject,
  stringField,
  urlField,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-profile-read",
      userId: user.id,
      limit: 120,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;

    return Response.json(user);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-profile-write",
      userId: user.id,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const updated = await getDb().userProfile.update({
      where: { id: user.id },
      data: {
        displayName:
          stringField(body, "displayName", { max: 120, fallback: undefined }) ??
          undefined,
        avatarOriginalUrl:
          urlField(body, "avatarOriginalUrl", { max: 1_000, fallback: undefined }) ??
          undefined,
        avatarUrl:
          urlField(body, "avatarUrl", { max: 1_000, fallback: undefined }) ??
          undefined,
        companyAffiliation:
          stringField(body, "companyAffiliation", { max: 160, fallback: undefined }) ??
          undefined,
        jobTitle:
          stringField(body, "jobTitle", { max: 120, fallback: undefined }) ??
          undefined,
        department:
          stringField(body, "department", { max: 120, fallback: undefined }) ??
          undefined,
        bio:
          stringField(body, "bio", { max: 1_000, fallback: undefined }) ??
          undefined,
        phoneNumber:
          stringField(body, "phoneNumber", { max: 50, fallback: undefined }) ??
          undefined,
        linkedinUrl:
          linkedinUrlField(body, "linkedinUrl", { max: 500, fallback: undefined }) ??
          undefined,
        country:
          stringField(body, "country", { max: 100, fallback: undefined }) ??
          undefined,
        city:
          stringField(body, "city", { max: 100, fallback: undefined }) ??
          undefined,
        preferredLanguage: body.preferredLanguage === "ko" ? "ko" : "en",
      },
    });
    return Response.json(updated);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
