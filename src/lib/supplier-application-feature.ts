import "server-only";

export function supplierApplicationsEnabled(
  environment: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
) {
  return (
    environment.SUPPLIER_APPLICATIONS_ENABLED?.trim().toLowerCase() === "true"
  );
}

export function requireSupplierApplicationsEnabled() {
  if (!supplierApplicationsEnabled()) {
    throw new Response("Supplier applications are not enabled.", {
      status: 503,
    });
  }
}
