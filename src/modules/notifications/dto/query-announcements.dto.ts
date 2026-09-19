import { IsBooleanString, IsOptional } from 'class-validator';

export class QueryAnnouncementsDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
