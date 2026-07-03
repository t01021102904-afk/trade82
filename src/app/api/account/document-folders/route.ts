import { Prisma, type DocumentCategory } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idField,
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
const createFields = new Set(["name", "category"]);
const renameFields = new Set(["folderId", "name"]);
const deleteFields = new Set(["folderId"]);

function categoryField(value: unknown): DocumentCategory {
  if (typeof value !== "string" || !documentCategories.includes(value as DocumentCategory)) {
    throw validationError("category is invalid.");
  }
  return value as DocumentCategory;
}

function requiredFolderId(body: Record<string, unknown>) {
  const folderId = idField(body, "folderId", { required: true });
  if (!folderId) throw validationError("folderId is required.");
  return folderId;
}

function folderPayload(folder: {
  id: string;
  name: string;
  category: DocumentCategory;
  updatedAt: Date;
  _count: { documents: number };
}) {
  return {
    id: folder.id,
    name: folder.name,
    category: folder.category,
    files: folder._count.documents,
    updatedAt: folder.updatedAt.toISOString(),
  };
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
    rejectUnexpectedFields(body, createFields);
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

export async function PATCH(request: Request) {
  try {
    const { company } = await requireSeller();
    if (!company) {
      return Response.json(
        { error: "Create a company profile before managing folders." },
        { status: 403 },
      );
    }

    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, renameFields);
    const folderId = requiredFolderId(body);
    const name = requiredStringField(body, "name", 80);

    const existing = await getDb().documentFolder.findFirst({
      where: { id: folderId, companyId: company.id },
      select: { id: true },
    });
    if (!existing) {
      return Response.json({ error: "Folder not found." }, { status: 404 });
    }

    const folder = await getDb().documentFolder.update({
      where: { id: existing.id },
      data: { name },
      select: {
        id: true,
        name: true,
        category: true,
        updatedAt: true,
        _count: { select: { documents: true } },
      },
    });

    return Response.json({ folder: folderPayload(folder) });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        { error: "A folder with that name already exists in this category." },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { company } = await requireSeller();
    if (!company) {
      return Response.json(
        { error: "Create a company profile before managing folders." },
        { status: 403 },
      );
    }

    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, deleteFields);
    const folderId = requiredFolderId(body);

    const folder = await getDb().documentFolder.findFirst({
      where: { id: folderId, companyId: company.id },
      select: {
        id: true,
        _count: { select: { documents: true } },
      },
    });
    if (!folder) {
      return Response.json({ error: "Folder not found." }, { status: 404 });
    }
    if (folder._count.documents > 0) {
      return Response.json(
        { error: "Move or delete documents before deleting this folder." },
        { status: 409 },
      );
    }

    await getDb().documentFolder.delete({ where: { id: folder.id } });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
