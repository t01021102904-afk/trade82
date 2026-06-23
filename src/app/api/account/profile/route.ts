import { apiError } from "@/lib/api-response";
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    return Response.json(await requireCurrentAppUser());
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const body = (await request.json()) as Record<string, unknown>;
    const updated = await getDb().userProfile.update({
      where: { id: user.id },
      data: {
        displayName:
          typeof body.displayName === "string"
            ? body.displayName.trim()
            : undefined,
        avatarOriginalUrl:
          typeof body.avatarOriginalUrl === "string"
            ? body.avatarOriginalUrl || null
            : undefined,
        avatarUrl:
          typeof body.avatarUrl === "string"
            ? body.avatarUrl || null
            : undefined,
        companyAffiliation:
          typeof body.companyAffiliation === "string"
            ? body.companyAffiliation.trim().slice(0, 160)
            : undefined,
        jobTitle:
          typeof body.jobTitle === "string"
            ? body.jobTitle.trim().slice(0, 120)
            : undefined,
        department:
          typeof body.department === "string"
            ? body.department.trim().slice(0, 120)
            : undefined,
        bio:
          typeof body.bio === "string"
            ? body.bio.trim().slice(0, 1000)
            : undefined,
        phoneNumber:
          typeof body.phoneNumber === "string"
            ? body.phoneNumber.trim().slice(0, 50)
            : undefined,
        linkedinUrl:
          typeof body.linkedinUrl === "string"
            ? body.linkedinUrl.trim().slice(0, 500)
            : undefined,
        country:
          typeof body.country === "string"
            ? body.country.trim().slice(0, 100)
            : undefined,
        city:
          typeof body.city === "string"
            ? body.city.trim().slice(0, 100)
            : undefined,
        preferredLanguage: body.preferredLanguage === "ko" ? "ko" : "en",
      },
    });
    return Response.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
