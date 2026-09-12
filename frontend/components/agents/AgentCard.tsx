export function AgentCard({ name, type }: { name: string; type: string }) {
  return (
    <div className="p-4 border rounded-lg">
      <h4 className="font-semibold">{name}</h4>
      <p className="text-sm text-gray-500">{type}</p>
    </div>
  );
}
