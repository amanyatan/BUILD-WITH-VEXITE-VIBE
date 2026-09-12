export async function validateCode(code: string, language: string) {
  return {
    valid: true,
    errors: [],
    warnings: [],
  };
}
