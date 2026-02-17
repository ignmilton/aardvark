import { IsArray, IsUUID, ArrayMaxSize } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class MarkReadDto {
  @ApiProperty({
    description: "Array of notification IDs to mark as read",
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  notificationIds: string[];
}
