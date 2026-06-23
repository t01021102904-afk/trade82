export function apiError(error: unknown) {
  if (error instanceof Response) {
    return Response.json(
      { error: error.statusText || "Request failed" },
      { status: error.status },
    );
  }

  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
