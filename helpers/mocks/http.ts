import type { Page, Route } from '@playwright/test';

/** Responde uma rota interceptada com um corpo JSON. */
export function responderJson(route: Route, corpo: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
}

/** Registra um mock que responde sempre o mesmo JSON para o padrão de URL informado. */
export async function mockJson(page: Page, url: string, corpo: unknown, status = 200): Promise<void> {
  await page.route(url, (route) => responderJson(route, corpo, status));
}
