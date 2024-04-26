import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateAuthDto {
    @IsOptional()
    @IsString()
    readonly name?: string

    @IsEmail()
    readonly email: string

    @IsNotEmpty()
    @IsString()
    readonly password: string
}
