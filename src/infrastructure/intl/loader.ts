import { container } from "../ioc/container";
import { IntlService } from "../../application/intl/intl.service";
import type { AbstractIntlMessages } from "../../domain/intl/types";

async function getService() {
  return container.resolve(IntlService);
}

export async function registerMessages(locale: string, messages: any) {
  const service = await getService();
  service.registerMessages(locale, messages);
}

export async function getMessages(
  locale: string,
  searchDirectories?: string[],
): Promise<AbstractIntlMessages> {
  const service = await getService();
  return await service.getMessages(locale, searchDirectories);
}
