import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class DisburseBatchDto {
  /**
   * Reference identifier from the payment gateway or bank transfer (e.g. UTR / NEFT / RTGS ref)
   */
  @IsString()
  @IsNotEmpty({ message: 'paymentReference is required' })
  paymentReference: string;

  /**
   * Optional administrative notes regarding the disbursal
   */
  @IsString()
  @IsOptional()
  notes?: string;
}
