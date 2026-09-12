import { config } from "../config";

interface AIProvider {
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
}

type JsonRecord = Record<string, unknown>;

class GroqProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    const data = (await response.json()) as JsonRecord & {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(data.error?.message || `Groq request failed with status ${response.status}`);
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq returned no message content");
    return content;
  }
}

class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      }
    );

    const data = (await response.json()) as JsonRecord & {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(data.error?.message || `Gemini request failed with status ${response.status}`);
    }
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("Gemini returned no text content");
    return content;
  }
}

let provider: AIProvider | null = null;

function getProvider(): AIProvider {
  if (provider) return provider;

  const aiProvider = config.aiProvider || "groq";

  if (aiProvider === "gemini" && config.geminiApiKey) {
    provider = new GeminiProvider(config.geminiApiKey, config.geminiModel || "gemini-3.6-flash");
  } else if (config.groqApiKey) {
    provider = new GroqProvider(config.groqApiKey, config.groqModel || "llama-3.3-70b-versatile");
  } else if (config.aiApiKey) {
    provider = new GroqProvider(config.aiApiKey, config.aiModel || "llama-3.3-70b-versatile");
  } else {
    throw new Error("No AI provider configured. Set GROQ_API_KEY or GEMINI_API_KEY.");
  }

  return provider;
}

export async function generateJSON(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const p = getProvider();
  const raw = await p.generate(systemPrompt, userPrompt);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");

  return JSON.parse(jsonMatch[0]);
}

export async function generateText(systemPrompt: string, userPrompt: string): Promise<string> {
  const p = getProvider();
  return p.generate(systemPrompt, userPrompt);
}
