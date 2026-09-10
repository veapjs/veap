import { ServiceProvider } from "../../infrastructure/providers/service-provider";
import { IntlService } from "../../application/intl/intl.service";

export class IntlServiceProvider extends ServiceProvider {
  register(): void {
    this.container.register({
      token: IntlService,
      useClass: IntlService,
      singleton: true,
    });
  }
}
