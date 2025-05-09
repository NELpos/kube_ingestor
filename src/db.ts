import { Pool, PoolConfig } from "pg";
import winston from "winston";
import { Event, EventTracker, DbConfig } from "./types";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export class Database {
  private pool: Pool;

  constructor(config: DbConfig) {
    const poolConfig: PoolConfig = {
      user: config.user,
      host: config.host,
      database: config.database,
      password: config.password,
      port: config.port,
    };
    this.pool = new Pool(poolConfig);
  }

  async getLastProcessedEventId(): Promise<string | null> {
    try {
      const result = await this.pool.query<EventTracker>(
        "SELECT last_event_id FROM event_tracker ORDER BY updated_at DESC LIMIT 1"
      );
      return result.rows[0]?.last_event_id || null;
    } catch (error) {
      logger.error("Error getting last processed event ID:", error);
      throw error;
    }
  }

  async updateLastProcessedEventId(eventId: string): Promise<void> {
    try {
      await this.pool.query(
        "INSERT INTO event_tracker (last_event_id, updated_at) VALUES ($1, NOW())",
        [eventId]
      );
    } catch (error) {
      logger.error("Error updating last processed event ID:", error);
      throw error;
    }
  }

  async isEventExists(eventId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "SELECT EXISTS(SELECT 1 FROM events WHERE event_id = $1)",
        [eventId]
      );
      return result.rows[0].exists;
    } catch (error) {
      logger.error("Error checking event existence:", error);
      throw error;
    }
  }

  async saveEvent(event: Event): Promise<void> {
    try {
      await this.pool.query(
        "INSERT INTO events (event_id, data, created_at) VALUES ($1, $2, $3)",
        [event.id, event.data, event.created_at]
      );
    } catch (error) {
      logger.error("Error saving event:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
