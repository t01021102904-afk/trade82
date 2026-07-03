import type { DocumentCategory } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  readJsonObject,
  rejectUnexpectedFields,
  requiredStringField,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const documentCategories: DocumentCategory[] = [
  "company",
  "product",
  "compliance",
  "shipping",
  "contracts",
  "shared_with_buyer",
];
const allowedFields = new Set(["name", "category"]);

function categoryField(value: unknown): DocumentCategory {
  if (typeof value !== "string" || !documentCategories.includes(value as DocumentCategory)) {
    throw validationError("category is invalid.");
  }
  return value as DocumentCategory;
}

export async function POST(request: Request) {
  try {
    const { user, company } = await requireSeller();
    if (!company) {
      return Response.json(
        { error: "Create a company profile before creating folders." },
        { status: 403 },
      );
    }

    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, allowedFields);
    const name = requiredStringField(body, "name", 80);
    const category = categoryField(body.category);

    const folder = await getDb().documentFolder.create({
      data: {
        companyId: company.id,
        createdByUserId: user.id,
        name,
        category,
      },
      select: {
        id: true,
        name: true,
        category: true,
        updatedAt: true,
      },
    });

    return Response.json(
      {
        folder: {
          id: folder.id,
          name: folder.name,
          category: folder.category,
          files: 0,
          updatedAt: folder.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
