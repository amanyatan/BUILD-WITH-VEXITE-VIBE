import { useEffect, useState } from "react";
import api from "@/lib/api";

export function RepoList() {
  const [repos, setRepos] = useState<Array<{ id: number; name: string; fullName: string }>>([]);

  useEffect(() => {
    api.get("/github/repos").then(({ data }) => setRepos(data.repos)).catch(console.error);
  }, []);

  return (
    <div>
      <h3 className="font-semibold">Repositories</h3>
      {repos.map((repo) => (
        <div key={repo.id} className="p-2 border-b">{repo.fullName}</div>
      ))}
    </div>
  );
}
