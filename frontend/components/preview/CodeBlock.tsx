export function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <pre className="p-4 bg-gray-900 text-white rounded-lg overflow-x-auto">
      <code>{code}</code>
    </pre>
  );
}
