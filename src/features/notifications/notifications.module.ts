import { Module } from "@nestjs/common";

import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { DispatchService } from "./dispatch.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [SubscriptionsModule],
  controllers: [NotificationsController],
  providers: [DispatchService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
