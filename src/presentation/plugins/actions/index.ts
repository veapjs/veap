"use server";
import { AppError } from "../../../domain/errors/app-error";

import { getCurrentSession } from "../../../application/auth/facades/session";
import { SystemUserWidget } from "../../../infrastructure/plugins/models/SystemUserWidget";
import { pluginsContext } from "../../../application/plugins/context";

export async function getPluginExtensionsAction(
  target: string,
  point: string,
  includeDisabled: boolean = false,
) {
  const { user } = await getCurrentSession();
  const userRoles = user?.roles || [];
  const userPermissions = user?.permissions || [];

  return pluginsContext().registry.getExtensions(
    target,
    point,
    includeDisabled,
    {
      roles: userRoles,
      permissions: userPermissions,
    },
  );
}

export async function getPluginWidgetsAction(area: string) {
  const { user } = await getCurrentSession();
  const userRoles = user?.roles || [];
  const userPermissions = user?.permissions || [];

  return pluginsContext().registry.getWidgets(area, {
    roles: userRoles,
    permissions: userPermissions,
  });
}

export async function getUserWidgetsState(slot: string) {
  const { user } = await getCurrentSession();
  if (!user) {
    return null;
  }

  const widget = await SystemUserWidget.where({
    user_id: user.id,
    slot: slot,
  }).first();

  return widget?.state ?? null;
}

export async function saveUserWidgetsState(slot: string, state: any) {
  const { user } = await getCurrentSession();
  if (!user) {
    throw AppError.Unauthorized();
  }

  const existing = await SystemUserWidget.where({
    user_id: user.id,
    slot: slot,
  }).first();

  if (existing) {
    await SystemUserWidget.where({
      user_id: user.id,
      slot: slot,
    }).update({
      state: state,
    });
  } else {
    await SystemUserWidget.create({
      userId: user.id,
      slot: slot,
      state: state,
    });
  }

  return { success: true };
}
