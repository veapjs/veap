"use client";
import { AppError } from "../../../domain/errors/app-error";
import { useContext } from "react";
import { AuthContext } from "../providers/auth-provider";

/**
 * Hook for user management.
 * @returns Returns an object with user data and functions for managing it.
 */
export const useUser = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw AppError.Internal("useUser must be used within AuthProvider");
  }
  return { ...context };
};
