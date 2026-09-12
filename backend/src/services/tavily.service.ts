import { config } from "../config";

export async function searchWeb(query: string): Promise<string> {
  if (!config.tavilyApiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: config.tavilyApiKey,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  });
  const data = (await response.json()) as {
    results?: Array<{ title: string; content: string; url: string }>;
    message?: string;
  };
  if (!response.ok) throw new Error(data.message || `Web search failed with status ${response.status}`);
  return (data.results || []).map((result) => `${result.title}: ${result.content} (${result.url})`).join("\n");
}
