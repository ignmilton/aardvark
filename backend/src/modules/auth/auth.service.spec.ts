import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { User } from "@/database/entities";
import { UserRole, AccountStatus } from "@aardvark/shared";
import { MailService } from "@/common/mail/mail.service";
import { TokenBlacklistService } from "./token-blacklist.service";

describe("AuthService", () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let mailService: jest.Mocked<MailService>;

  const mockUser: Partial<User> = {
    id: "test-user-id",
    username: "testuser",
    email: "test@example.com",
    passwordHash: "",
    displayName: "Test User",
    role: UserRole.READER,
    accountStatus: AccountStatus.ACTIVE,
    creditsBalance: 0,
    loginAttempts: 0,
    lockoutUntil: null,
    emailVerified: true,
  };

  beforeEach(async () => {
    // Hash a test password
    mockUser.passwordHash = await bcrypt.hash("TestPassword123!", 12);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue("mock-token"),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                "jwt.accessExpiration": "15m",
                "jwt.refreshExpiration": "7d",
                "jwt.refreshSecret": "test-refresh-secret",
                appUrl: "http://localhost:3000",
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordReset: jest.fn().mockResolvedValue(true),
            sendEmailVerification: jest.fn().mockResolvedValue(true),
            send: jest.fn().mockResolvedValue(true),
            isConfigured: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            blacklistToken: jest.fn().mockResolvedValue(undefined),
            isBlacklisted: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    mailService = module.get(MailService);
  });

  describe("register", () => {
    it("should throw ConflictException if username already exists", async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        username: "testuser",
      } as User);

      await expect(
        service.register({
          username: "testuser",
          email: "new@example.com",
          password: "Password123!",
          acceptTerms: true,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException if email already exists", async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        email: "test@example.com",
      } as User);

      await expect(
        service.register({
          username: "newuser",
          email: "test@example.com",
          password: "Password123!",
          acceptTerms: true,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should successfully register a new user", async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser as User);
      userRepository.save.mockResolvedValue(mockUser as User);

      const result = await service.register({
        username: "newuser",
        email: "new@example.com",
        password: "Password123!",
        acceptTerms: true,
      });

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.user).toBeDefined();
    });
  });

  describe("validateUser", () => {
    it("should return null for non-existent user", async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(
        "nonexistent@example.com",
        "password",
      );

      expect(result).toBeNull();
    });

    it("should throw UnauthorizedException for banned account", async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        accountStatus: AccountStatus.BANNED,
      } as User);

      await expect(
        service.validateUser("test@example.com", "TestPassword123!"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for suspended account", async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        accountStatus: AccountStatus.SUSPENDED,
      } as User);

      await expect(
        service.validateUser("test@example.com", "TestPassword123!"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for locked account", async () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 10);

      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        lockoutUntil: futureDate,
      } as User);

      await expect(
        service.validateUser("test@example.com", "TestPassword123!"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should track failed login attempts", async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        loginAttempts: 0,
      } as User);

      const result = await service.validateUser(
        "test@example.com",
        "WrongPassword",
      );

      expect(result).toBeNull();
      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ loginAttempts: 1 }),
      );
    });

    it("should lockout account after 5 failed attempts", async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        loginAttempts: 4,
      } as User);

      await service.validateUser("test@example.com", "WrongPassword");

      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          loginAttempts: 5,
          lockoutUntil: expect.any(Date),
        }),
      );
    });

    it("should clear login attempts on successful login", async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        loginAttempts: 3,
      } as User);

      await service.validateUser("test@example.com", "TestPassword123!");

      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ loginAttempts: 0, lockoutUntil: null }),
      );
    });
  });

  describe("refreshToken", () => {
    it("should throw UnauthorizedException for banned user", async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        accountStatus: AccountStatus.BANNED,
      } as User);

      await expect(service.refreshToken("valid-refresh-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for suspended user", async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        accountStatus: AccountStatus.SUSPENDED,
      } as User);

      await expect(service.refreshToken("valid-refresh-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for deactivated user", async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        accountStatus: AccountStatus.DEACTIVATED,
      } as User);

      await expect(service.refreshToken("valid-refresh-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should return new access token for active user", async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        accountStatus: AccountStatus.ACTIVE,
      } as User);

      const result = await service.refreshToken("valid-refresh-token");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("expiresIn");
    });

    it("should throw UnauthorizedException for invalid token", async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error("Invalid token"));

      await expect(service.refreshToken("invalid-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("changePassword", () => {
    it("should throw BadRequestException for incorrect current password", async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      await expect(
        service.changePassword(
          mockUser.id!,
          "WrongPassword",
          "NewPassword123!",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should successfully change password with correct current password", async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      await service.changePassword(
        mockUser.id!,
        "TestPassword123!",
        "NewPassword123!",
      );

      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );
    });
  });

  describe("resetPassword", () => {
    it("should throw BadRequestException for invalid token", async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword("invalid-token", "NewPassword123!"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for expired token", async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);

      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordResetToken: "valid-token",
        passwordResetExpires: pastDate,
      } as User);

      await expect(
        service.resetPassword("valid-token", "NewPassword123!"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for banned user", async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        accountStatus: AccountStatus.BANNED,
        passwordResetToken: "valid-token",
        passwordResetExpires: futureDate,
      } as User);

      await expect(
        service.resetPassword("valid-token", "NewPassword123!"),
      ).rejects.toThrow(BadRequestException);

      // Ensure the password was NOT updated
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it("should successfully reset password with valid token", async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordResetToken: "valid-token",
        passwordResetExpires: futureDate,
      } as User);

      await service.resetPassword("valid-token", "NewPassword123!");

      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          passwordHash: expect.any(String),
          passwordResetToken: null,
          passwordResetExpires: null,
        }),
      );
    });
  });

  describe("login", () => {
    it("should update lastLoginAt and return tokens", async () => {
      userRepository.update.mockResolvedValue({} as any);

      const result = await service.login(mockUser as User);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("user");
      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
          loginAttempts: 0,
        }),
      );
    });

    it("should include user data in response", async () => {
      userRepository.update.mockResolvedValue({} as any);

      const result = await service.login(mockUser as User);

      expect(result.user).toEqual(mockUser);
    });
  });

  describe("generateTokens", () => {
    it("should return access and refresh tokens with expiration", async () => {
      jwtService.signAsync
        .mockResolvedValueOnce("access-token-123")
        .mockResolvedValueOnce("refresh-token-123");

      const result = await service.generateTokens(mockUser as User);

      expect(result.accessToken).toBe("access-token-123");
      expect(result.refreshToken).toBe("refresh-token-123");
      expect(result.expiresIn).toBe(900); // 15m = 900s
    });

    it("should sign tokens with correct payload", async () => {
      await service.generateTokens(mockUser as User);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          username: mockUser.username,
          role: mockUser.role,
        }),
        expect.any(Object),
      );
    });
  });

  describe("getCurrentUser", () => {
    it("should return user by ID", async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.getCurrentUser("test-user-id");

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: "test-user-id" },
      });
    });

    it("should throw UnauthorizedException if user not found", async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getCurrentUser("nonexistent")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("requestPasswordReset", () => {
    it("should silently succeed for non-existent email (prevent enumeration)", async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.requestPasswordReset("nonexistent@example.com"),
      ).resolves.toBeUndefined();

      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it("should generate reset token and send email for existing user", async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);
      userRepository.update.mockResolvedValue({} as any);

      await service.requestPasswordReset("test@example.com");

      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetExpires: expect.any(Date),
        }),
      );
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
        "test@example.com",
        expect.stringContaining("token="),
      );
    });
  });

  describe("password hashing", () => {
    it("should use 12 rounds for bcrypt hashing", async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockImplementation((dto) => dto as User);
      userRepository.save.mockImplementation(async (user) => user as User);

      await service.register({
        username: "newuser",
        email: "new@example.com",
        password: "TestPassword123!",
        acceptTerms: true,
      });

      // Verify the password was hashed with bcrypt
      const savedUser = userRepository.create.mock.calls[0][0];
      expect(savedUser.passwordHash).toBeDefined();

      // Bcrypt hash format: $2b$12$... (12 is the cost factor)
      expect(savedUser.passwordHash).toMatch(/^\$2[ab]\$12\$/);
    });
  });
});
