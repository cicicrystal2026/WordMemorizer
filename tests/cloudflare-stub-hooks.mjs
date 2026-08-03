const STUB = "data:text/javascript,export const env = {};export default {};";

export function resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") {
    return { url: STUB, shortCircuit: true };
  }
  return next(specifier, context);
}
