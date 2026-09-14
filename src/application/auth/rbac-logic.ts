import { authContext } from "./context";
import type { User } from "../../domain/auth/types";

/**
 * Podstawowy moduł rozszerzający tożsamość dla ról i uprawnień.
 * Wykorzystuje role i uprawnienia użytkownika wczytane przez repozytorium.
 */
export async function coreRbacAugmenter(
  user: User,
): Promise<Record<string, any>> {
  return authContext().rbac.coreRbacAugmenter(user);
}
