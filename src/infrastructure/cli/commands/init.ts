import { initProject as createAppInit } from "create-veap";

export async function initProject(
  name?: string,
  options?: {
    docker?: boolean;
    skipInstall?: boolean;
    pm?: string;
  },
) {
  return createAppInit(name, options);
}
