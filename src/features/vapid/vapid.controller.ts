import { Controller, Get, Inject } from "@nestjs/common";

import { ENV } from "../../core/core.module";
import type { Env } from "../../env/env";

@Controller("vapid-public-key")
export class VapidController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get()
  getPublicKey() {
    return { publicKey: this.env.VAPID_PUBLIC_KEY };
  }
}
