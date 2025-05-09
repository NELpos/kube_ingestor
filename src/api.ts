import axios, { AxiosInstance } from "axios";
import winston from "winston";
import { Event, ApiConfig } from "./types";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export class EventApiClient {
  private client: AxiosInstance;

  constructor(config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  async fetchEvents(lastEventId: string | null = null): Promise<Event[]> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const params: Record<string, string> = {
        startTime: oneHourAgo.toISOString(),
        limit: "100",
      };

      if (lastEventId) {
        params.after = lastEventId;
      }

      const response = await this.client.get<Event[]>("/events", { params });
      return response.data;
    } catch (error) {
      logger.error("Error fetching events:", error);
      throw error;
    }
  }
}
