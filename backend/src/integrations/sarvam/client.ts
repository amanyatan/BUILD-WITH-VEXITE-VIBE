import { config } from "../../config";

export const sarvamClient = {
  get apiKey(): string {
    if (!config.sarvamApiKey) throw new Error("SARVAM_API_KEY is not configured");
    return config.sarvamApiKey;
  },
};
