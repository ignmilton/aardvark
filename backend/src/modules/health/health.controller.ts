import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@ApiTags("health")
@Controller("health")
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({ summary: "Health check endpoint" })
  async check() {
    const dbHealthy = await this.checkDatabase();

    return {
      status: dbHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || "1.0.0",
      checks: {
        database: dbHealthy ? "healthy" : "unhealthy",
        memory: this.getMemoryUsage(),
      },
    };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe for orchestrators" })
  async ready() {
    const dbHealthy = await this.checkDatabase();
    if (!dbHealthy) {
      return { status: "not_ready", reason: "database connection failed" };
    }
    return { status: "ready" };
  }

  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  live() {
    return { status: "alive" };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      rssMB: Math.round(usage.rss / 1024 / 1024),
    };
  }
}
