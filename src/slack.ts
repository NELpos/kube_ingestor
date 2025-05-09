import { WebClient } from "@slack/web-api";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export class SlackNotifier {
  private client: WebClient;
  private channel: string;

  constructor(token: string, channel: string) {
    this.client = new WebClient(token);
    this.channel = channel;
  }

  async sendErrorNotification(
    error: Error,
    context: string
  ): Promise<{ ts: string } | undefined> {
    try {
      const message = {
        channel: this.channel,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🚨 Error Alert",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Context:*\n${context}`,
              },
              {
                type: "mrkdwn",
                text: `*Time:*\n${new Date().toISOString()}`,
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Error Message:*\n\`\`\`${error.message}\`\`\``,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Stack Trace:*\n\`\`\`${error.stack}\`\`\``,
            },
          },
        ],
      };

      const result = await this.client.chat.postMessage(message);
      return { ts: result.ts as string };
    } catch (err) {
      logger.error("Failed to send Slack notification:", err);
      return undefined;
    }
  }

  async sendSuccessNotification(
    message: string
  ): Promise<{ ts: string } | undefined> {
    try {
      const notification = {
        channel: this.channel,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "✅ Success",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: message,
            },
          },
        ],
      };

      const result = await this.client.chat.postMessage(notification);
      return { ts: result.ts as string };
    } catch (err) {
      logger.error("Failed to send Slack notification:", err);
      return undefined;
    }
  }

  // 추가 기능: 스레드로 상세 정보 전송
  async sendDetailedInfo(parentTs: string, details: any): Promise<void> {
    try {
      const message = {
        channel: this.channel,
        thread_ts: parentTs,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Detailed Information:*\n\`\`\`${JSON.stringify(
                details,
                null,
                2
              )}\`\`\``,
            },
          },
        ],
      };

      await this.client.chat.postMessage(message);
    } catch (err) {
      logger.error("Failed to send detailed information:", err);
    }
  }

  // 추가 기능: 이모지로 메시지 상태 표시
  async addReaction(timestamp: string, emoji: string): Promise<void> {
    try {
      await this.client.reactions.add({
        channel: this.channel,
        timestamp: timestamp,
        name: emoji,
      });
    } catch (err) {
      logger.error("Failed to add reaction:", err);
    }
  }
}
