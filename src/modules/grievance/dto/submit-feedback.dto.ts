import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SubmitFeedbackDto {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  satisfactionRating: number;

  @IsOptional()
  @IsString()
  feedbackComments?: string;
}
