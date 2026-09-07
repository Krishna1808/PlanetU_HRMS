import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateEmployeeDocumentDto {
  @IsEnum(DocumentType, { message: 'Invalid document type' })
  @IsNotEmpty({ message: 'Document type is required' })
  documentType: DocumentType;

  @IsString()
  @IsNotEmpty({ message: 'File name is required' })
  fileName: string;

  @IsString()
  @IsNotEmpty({ message: 'File URL / path is required' })
  fileUrl: string;

  @IsNumber()
  @IsOptional()
  fileSize?: number;
}
