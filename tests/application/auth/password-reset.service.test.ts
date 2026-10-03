import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordResetService } from "../../../src/application/auth/services/password-reset.service";
import type { ITokenGenerator } from "../../../src/domain/auth/ports/token-generator";
import type { IPasswordResetRepository } from "../../../src/domain/auth/repositories/password-reset.repository";
import type { ICookieStore } from "../../../src/domain/contracts/http-transport";

describe("PasswordResetService Security", () => {
  let service: PasswordResetService;
  let mockRepo: IPasswordResetRepository;
  let mockTokens: ITokenGenerator;
  let mockCookieStore: ICookieStore;

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(async (record) => ({ ...record, emailVerified: false })),
      findWithUser: vi.fn(),
      setEmailVerified: vi.fn(),
      remove: vi.fn(),
      removeByUserId: vi.fn(),
    };

    mockTokens = {
      hashToken: vi.fn((t) => `hashed_${t}`),
      generateOtp: vi.fn(() => "ABCDEF"),
      generateSessionToken: vi.fn(() => "test-token"),
    };

    mockCookieStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    service = new PasswordResetService(mockRepo, mockTokens, mockCookieStore);
  });

  it("creates password reset session with 15-minute TTL", async () => {
    const before = Date.now();
    await service.createPasswordResetSession(
      "raw-token",
      "user-1",
      "user@example.com",
    );
    const after = Date.now();

    expect(mockRepo.create).toHaveBeenCalled();
    const createdRecord = (mockRepo.create as any).mock.calls[0][0];
    const expiresAtMs = createdRecord.expiresAt.getTime();

    // 15 minutes = 15 * 60 * 1000 = 900,000 ms
    expect(expiresAtMs - before).toBeGreaterThanOrEqual(900000 - 1000);
    expect(expiresAtMs - after).toBeLessThanOrEqual(900000 + 1000);
  });

  it("handles dummy sessions to prevent user enumeration", async () => {
    const dummy = await service.createDummyPasswordResetSession(
      "dummy-token",
      "notfound@example.com",
    );
    expect(dummy.userId).toBe("dummy");
    expect(dummy.email).toBe("notfound@example.com");

    const validated =
      await service.validatePasswordResetSessionToken("dummy-token");
    expect(validated.session).not.toBeNull();
    expect(validated.user).not.toBeNull();
    expect(validated.user?.email).toBe("notfound@example.com");

    // Any code verification against dummy session fails
    const result = await service.verifyResetCode(dummy.id, "123456");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Incorrect code");
  });

  it("limits failed OTP verification attempts to 5 and cancels session", async () => {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    (mockRepo.findWithUser as any).mockResolvedValue({
      session: {
        id: "session-123",
        email: "user@example.com",
        code: "CORRECT",
        expiresAt,
        userId: "user-1",
      },
      user: { id: "user-1", email: "user@example.com" },
    });

    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      const res = await service.verifyResetCode("session-123", "WRONG");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Incorrect code");
    }

    // 5th failed attempt terminates session
    const res5 = await service.verifyResetCode("session-123", "WRONG");
    expect(res5.valid).toBe(false);
    expect(res5.error).toMatch(/too many failed attempts/i);
    expect(mockRepo.remove).toHaveBeenCalledWith("session-123");
    expect(mockCookieStore.delete).toHaveBeenCalledWith(
      "password_reset_session",
    );
  });

  it("verifies code successfully when correct and resets attempts", async () => {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    (mockRepo.findWithUser as any).mockResolvedValue({
      session: {
        id: "session-valid",
        email: "user@example.com",
        code: "SECRET",
        expiresAt,
        userId: "user-1",
      },
      user: { id: "user-1", email: "user@example.com" },
    });

    const res = await service.verifyResetCode("session-valid", "SECRET");
    expect(res.valid).toBe(true);
    expect(mockRepo.setEmailVerified).toHaveBeenCalledWith("session-valid");
  });
});
