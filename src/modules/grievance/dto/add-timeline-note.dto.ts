import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class AddTimelineNoteDto {
  @IsNotEmpty()
  @IsString()
  notes: string;

  @IsOptional()
  @IsBoolean()
  isInternalOnly?: boolean;
}
