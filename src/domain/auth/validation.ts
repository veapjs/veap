import { z } from "zod";

// Auth validation schemas - CLEAN (No DB dependencies for client-side)
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8),
  remember: z.boolean().optional(),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  terms: z.boolean().refine((val) => val === true, "You must accept the terms"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export const verifyEmailSchema = z.object({
  code: z.string().min(6).max(6),
});

// mfa validation schemas
export const totpSetupSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const totpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const passkeysSetupSchema = z.object({
  name: z.string().min(1, "Passkey name is required"),
});

export const recoveryCodeVerifySchema = z.object({
  code: z.string().min(16, "Recovery code is required").max(16),
});

// Type exports for use in components
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type TOTPSetupInput = z.infer<typeof totpSetupSchema>;
export type TOTPVerifyInput = z.infer<typeof totpVerifySchema>;
export type PasskeysSetupInput = z.infer<typeof passkeysSetupSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type RecoveryVerifyInput = z.infer<typeof recoveryCodeVerifySchema>;
