import { Prisma } from "@/generated/prisma/client";

const statusMessages: Record<number, string> = {
  400: "Invalid request.",
  401: "Authentication required.",
  403: "You do not have permission to perform this action.",
  404: "Not found.",
  409: "This request conflicts with existing data.",
  429: "Too many requests. Please try again shortly.",
};

export function logSafeApiError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("API error", { name: error.name, code: error.code });
    return;
  }
  if (error instanceof Error) {
    console.error("API error", { name: error.name });
    return;
  }
  console.error("API error", { name: typeof error });
}

export function apiError(error: unknown) {
  if (error instanceof Response) {
    return Response.json(
      { error: statusMessages[error.status] ?? "Request failed." },
      { status: error.status },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return Response.json(
        { error: statusMessages[409] },
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return Response.json({ error: statusMessages[404] }, { status: 404 });
    }
  }

  logSafeApiError(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
