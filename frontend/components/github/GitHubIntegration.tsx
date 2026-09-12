"use client";

import { useState } from "react";
import api from "@/lib/api";

export function GitHubIntegration() {
  const [repo, setRepo] = useState("");

  const connectRepository = async () => {
    try {
      await api.post("/github/connect", { repo });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold">GitHub Integration</h2>
      <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Repository" className="px-3 py-2 border rounded" />
      <button onClick={connectRepository} className="px-4 py-2 ml-2 bg-gray-800 text-white rounded hover:bg-gray-900">
        Connect
      </button>
    </div>
  );
}
