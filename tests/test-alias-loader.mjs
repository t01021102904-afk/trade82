const sourceRoot = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return {
      url: new URL(`${specifier.slice(2)}.ts`, sourceRoot).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
