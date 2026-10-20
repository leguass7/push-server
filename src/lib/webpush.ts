import webpush from "web-push";

import type { Env } from "../env/env.js";

export function configureWebPush(env: Pick<Env, "VAPID_SUBJECT" | "VAPID_PUBLIC_KEY" | "VAPID_PRIVATE_KEY">) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  return webpush;
}

export type WebPush = typeof webpush;
