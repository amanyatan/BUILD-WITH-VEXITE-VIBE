export function parseCode(code: string, language: string) {
  return {
    language,
    lines: code.split("\n").length,
    characters: code.length,
  };
}
