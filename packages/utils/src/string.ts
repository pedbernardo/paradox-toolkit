export function snakeCaseToCamelCase(s: string): string {
  return s.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
