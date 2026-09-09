import * as initial from "./0001_initial";
import * as Plugins from "./0002_plugins";

import * as UserWidgets from "./0005_user_widgets";
import * as FixEmailVerified from "./0006_fix_email_verified";

export const coreMigrations = [initial, Plugins, UserWidgets, FixEmailVerified];
