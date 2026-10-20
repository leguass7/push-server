/**
 * Status em código, não enum do Postgres — mesma decisão do bt-pro
 * (GOLDEN_RULES §6 lá) e pelo mesmo motivo: um status novo é mudança de
 * código, não migration.
 */
export const NotificationStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SENT: "SENT",
  PARTIALLY_SENT: "PARTIALLY_SENT",
  FAILED: "FAILED",
  CANCELED: "CANCELED",
} as const;

export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const DeliveryStatus = {
  SENT: "SENT",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
} as const;

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export type NotificationPayload = {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
};
