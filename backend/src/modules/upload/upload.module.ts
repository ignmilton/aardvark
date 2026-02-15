import { Module } from "@nestjs/common";
import { UploadController } from "./upload.controller";
import { UploadService } from "./upload.service";

/**
 * Upload module providing file upload endpoints with validation.
 * Validates file types, sizes, and magic bytes for security.
 */
@Module({
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
