import type { PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Validação — Zod é a fonte de verdade (GOLDEN_RULES §3): todo body/query de
 * rota passa por um schema Zod antes de chegar ao service. Instanciado por
 * valor (`new ZodValidationPipe(schema)`) em cada rota, não via DI — cada
 * uso leva um schema diferente, incompatível com um provider singleton.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
