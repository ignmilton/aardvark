import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { User } from "@/database/entities";
import { AccountStatus, UserRole } from "@aardvark/shared";
import { TokenBlacklistService } from "./token-blacklist.service";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let userRepository: jest.Mocked<Repository<User>>;
  let tokenBlacklistService: jest.Mocked<TokenBlacklistService>;

  const mockPayload = {
    sub: "test-user-id",
    username: "testuser",
    role: UserRole.READER,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  };

  const mockUser: Partial<User> = {
    id: "test-user-id",
    username: "testuser",
    role: UserRole.READER,
    accountStatus: AccountStatus.ACTIVE,
    passwordChangedAt: null,
  };

  /**
   * Create a minimal mock Request with an Authorization header.
   * The strategy uses ExtractJwt.fromAuthHeaderAsBearerToken() to pull
   * the raw token from the request.
   */
  const createMockRequest = (token = "mock-jwt-token") =>
    ({
      headers: {
        authorization: `Bearer ${token}`,
      },
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                "jwt.secret": "test-jwt-secret",
              };
              return config[key];
            }),
          },
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            isBlacklisted: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    userRepository = module.get(getRepositoryToken(User));
    tokenBlacklistService = module.get(TokenBlacklistService);
  });

  describe("validate", () => {
    it("should return an object with both id and userId fields set to payload.sub", async () => {
      userRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await strategy.validate(createMockRequest(), mockPayload);

      expect(result).toEqual({
        id: mockPayload.sub,
        userId: mockPayload.sub,
        username: mockPayload.username,
        role: mockPayload.role,
      });
      expect(result.id).toBe(result.userId);
    });

    it("should reject blacklisted tokens", async () => {
      tokenBlacklistService.isBlacklisted.mockResolvedValue(true);

      try {
        await strategy.validate(createMockRequest(), mockPayload);
        throw new Error("Expected UnauthorizedException");
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe("Token has been invalidated");
      }

      // Should not even look up the user when the token is blacklisted
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it("should reject banned users", async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        accountStatus: AccountStatus.BANNED,
      } as User);

      try {
        await strategy.validate(createMockRequest(), mockPayload);
        throw new Error("Expected UnauthorizedException");
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe("Account has been banned");
      }
    });

    it("should reject suspended users", async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        accountStatus: AccountStatus.SUSPENDED,
      } as User);

      try {
        await strategy.validate(createMockRequest(), mockPayload);
        throw new Error("Expected UnauthorizedException");
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe("Account is suspended");
      }
    });

    it("should reject tokens issued before password change", async () => {
      // Password was changed 60 seconds after the token was issued
      const passwordChangedAt = new Date((mockPayload.iat + 60) * 1000);

      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordChangedAt,
      } as User);

      try {
        await strategy.validate(createMockRequest(), mockPayload);
        throw new Error("Expected UnauthorizedException");
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe("Token invalidated by password change");
      }
    });

    it("should allow tokens issued after password change", async () => {
      // Password was changed 60 seconds before the token was issued
      const passwordChangedAt = new Date((mockPayload.iat - 60) * 1000);

      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordChangedAt,
      } as User);

      const result = await strategy.validate(createMockRequest(), mockPayload);

      expect(result).toEqual({
        id: mockPayload.sub,
        userId: mockPayload.sub,
        username: mockPayload.username,
        role: mockPayload.role,
      });
    });

    it("should throw UnauthorizedException when user is not found", async () => {
      userRepository.findOne.mockResolvedValue(null);

      try {
        await strategy.validate(createMockRequest(), mockPayload);
        throw new Error("Expected UnauthorizedException");
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe("User not found");
      }
    });
  });
});
