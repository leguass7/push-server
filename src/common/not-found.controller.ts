import { All, Controller } from '@nestjs/common';

import { HttpError } from './http-error';

/**
 * Equivalente ao `notFoundHandler` do Express: qualquer rota não registrada
 * pelos controllers das features cai aqui. Registrado como controller
 * próprio de `AppModule` (não dentro de um módulo importado) para ser
 * resolvido depois das rotas das features — Nest inicializa os módulos
 * importados antes dos próprios providers/controllers do módulo que os
 * importa.
 *
 * `{*splat}` (não `*`) porque o Express 5 (usado pelo
 * `@nestjs/platform-express` 12) trocou a sintaxe de wildcard do
 * `path-to-regexp` — path curinga sem nome não é mais aceito, e `*splat`
 * sozinho (sem chaves/sem a barra na frente) não casa com a raiz `/`
 * (confirmado empiricamente: a raiz caía no 404 interno do Nest, não aqui).
 * `/{*splat}` casa com `/` e com qualquer sub-rota.
 */
@Controller()
export class NotFoundController {
  @All('/{*splat}')
  notFound(): never {
    throw new HttpError(404, 'not_found');
  }
}
