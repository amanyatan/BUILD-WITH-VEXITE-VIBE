export function CodeActions() {
  return (
    <div className="flex gap-2 p-2 border-b">
      <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded">Generate</button>
      <button className="px-3 py-1 text-sm border rounded">Validate</button>
      <button className="px-3 py-1 text-sm border rounded">Optimize</button>
    </div>
  );
}
