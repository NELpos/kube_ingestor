import dotenv from "dotenv";
import winston from "winston";
import { Database } from "./db";
import { EventApiClient } from "./api";
import { SlackNotifier } from "./slack";
import { Event } from "./types";

dotenv.config();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

async function processEvents() {
  const db = new Database({
    user: process.env.DB_USER!,
    host: process.env.DB_HOST!,
    database: process.env.DB_NAME!,
    password: process.env.DB_PASSWORD!,
    port: parseInt(process.env.DB_PORT || "5432"),
  });

  const apiClient = new EventApiClient({
    baseUrl: process.env.API_BASE_URL!,
    apiKey: process.env.API_KEY!,
  });

  const slackNotifier = new SlackNotifier(
    process.env.SLACK_BOT_TOKEN!,
    process.env.SLACK_CHANNEL!
  );

  try {
    // 마지막으로 처리된 이벤트 ID 가져오기
    const lastEventId = await db.getLastProcessedEventId();
    logger.info("Last processed event ID:", lastEventId);

    // 이벤트 가져오기
    const events = await apiClient.fetchEvents(lastEventId);
    logger.info(`Fetched ${events.length} events`);

    // 이벤트 처리
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let lastMessageTs: string | undefined;

    for (const event of events) {
      try {
        const exists = await db.isEventExists(event.id);
        if (!exists) {
          await db.saveEvent(event);
          processedCount++;
          logger.info(`Saved event: ${event.id}`);
        } else {
          skippedCount++;
          logger.info(`Skipped existing event: ${event.id}`);
        }
      } catch (error) {
        errorCount++;
        const errorMessage = await slackNotifier.sendErrorNotification(
          error as Error,
          `Failed to process event ${event.id}`
        );
        if (errorMessage && !lastMessageTs) {
          lastMessageTs = errorMessage.ts;
        }
        // 에러 발생 시 상세 정보를 스레드로 전송
        if (lastMessageTs) {
          await slackNotifier.sendDetailedInfo(lastMessageTs, {
            eventId: event.id,
            timestamp: new Date().toISOString(),
            error: (error as Error).message,
          });
        }
      }
    }

    // 마지막 이벤트 ID 업데이트
    if (events.length > 0) {
      const lastEvent = events[events.length - 1];
      await db.updateLastProcessedEventId(lastEvent.id);
      logger.info(`Updated last processed event ID to: ${lastEvent.id}`);
    }

    // 성공 알림 전송
    const successMessage = await slackNotifier.sendSuccessNotification(
      `Event processing completed:\n` +
        `- Total events: ${events.length}\n` +
        `- Processed: ${processedCount}\n` +
        `- Skipped: ${skippedCount}\n` +
        `- Errors: ${errorCount}\n` +
        `- Last event ID: ${
          events.length > 0 ? events[events.length - 1].id : "N/A"
        }`
    );

    // 성공 메시지에 이모지 추가
    if (successMessage) {
      await slackNotifier.addReaction(successMessage.ts, "white_check_mark");
    }
  } catch (error) {
    logger.error("Error processing events:", error);
    const errorMessage = await slackNotifier.sendErrorNotification(
      error as Error,
      "Failed to process events batch"
    );
    if (errorMessage) {
      await slackNotifier.addReaction(errorMessage.ts, "x");
    }
    throw error;
  } finally {
    await db.close();
  }
}

// 애플리케이션 실행
processEvents().catch((error) => {
  logger.error("Application error:", error);
  process.exit(1);
});
