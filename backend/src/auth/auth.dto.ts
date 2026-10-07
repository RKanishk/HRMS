import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsStrongPassword, MaxLength, MinLength } from 'class-validator';
export class LoginDto {
  @ApiProperty({ example: 'employee01@cipl.example' }) @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ format: 'password' }) @IsString() @MinLength(1) @MaxLength(72) password!: string;
}
export class ChangePasswordDto {
  @ApiProperty({ format: 'password' }) @IsString() @MaxLength(72) currentPassword!: string;
  @ApiProperty({ format: 'password', minLength: 12, maxLength: 72 })
  @IsStrongPassword({ minLength: 12 })
  @MaxLength(72)
  newPassword!: string;
}
export class ForgotPasswordDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
}
export class ResetPasswordDto {
  @ApiProperty() @IsString() @MinLength(40) @MaxLength(100) token!: string;
  @ApiProperty({ format: 'password', minLength: 12, maxLength: 72 })
  @IsStrongPassword({ minLength: 12 })
  @MaxLength(72)
  newPassword!: string;
}
