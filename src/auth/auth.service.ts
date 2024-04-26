import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { CreateAuthDto, UpdateAuthDto } from './dto';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { JwtPaload, Tokens } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async getTokens(userId: number, email: string): Promise<Tokens> {
    const jwtPayload: JwtPaload = {
      sub: userId,
      email: email,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.ACCESS_TOKEN_KEY,
        expiresIn: process.env.ACCESS_TOKEN_TIME,
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.REFRESH_TOKEN_KEY,
        expiresIn: process.env.REFRESH_TOKEN_TIME,
      }),
    ]);
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async updateRefershToken(userId: number, refreshToken: string) {
    const hashedrefreshToken = await bcrypt.hash(refreshToken, 7);
    await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        hashedrefreshToken,
      },
    });
  }

  async signup(createAuthDto: CreateAuthDto, res: Response): Promise<Tokens> {
    const condidate = await this.prismaService.user.findUnique({
      where: { email: createAuthDto.email },
    });
    if (condidate) {
      throw new BadRequestException('User already exists!');
    }

    const hashedPassword = await bcrypt.hash(createAuthDto.password, 7);

    const newUser = await this.prismaService.user.create({
      data: {
        name: createAuthDto.name,
        email: createAuthDto.email,
        hashedPassword,
      },
    });

    const tokens = await this.getTokens(newUser.id, newUser.email);
    await this.updateRefershToken(newUser.id, tokens.refresh_token);

    res.cookie('refresh_token', tokens.refresh_token, {
      maxAge: Number(process.env.COOKIE_TIME),
      httpOnly: true,
    });

    return tokens;
  }

  async signin(createAuthDto: CreateAuthDto, res: Response) {
    const condidate = await this.prismaService.user.findUnique({
      where: { email: createAuthDto.email },
    });

    if (!condidate) {
      throw new BadRequestException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      createAuthDto.password,
      condidate.hashedPassword,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password');
    }

    const tokens = await this.getTokens(condidate.id, condidate.email);
    await this.updateRefershToken(condidate.id, tokens.refresh_token);

    res.cookie('refresh_token', tokens.refresh_token, {
      maxAge: Number(process.env.COOKIE_TIME),
      httpOnly: true,
    });

    return tokens;
  }

  async logout(refreshToken: string, res: Response) {
    try {
      const patientData = await this.jwtService.verify(refreshToken, {
        secret: process.env.REFRESH_TOKEN_KEY,
      });
      console.log(patientData);

      if (!patientData || !patientData.sub) {
        throw new ForbiddenException('Patient not verified or invalid ID');
      }

      // console.log('Patient ID:', patientData.id);

      const updateUser = await this.prismaService.user.update({
        where: {
          id: patientData.sub,
        },
        data: {
          hashedrefreshToken: null,
        },
      });

      console.log('Updated User:', updateUser);

      res.clearCookie('refresh_token');

      const response = {
        message: 'Patient logged out successfully',
        user_refresh_token: updateUser.hashedrefreshToken,
      };

      return response;
    } catch (error) {
      console.error('Logout Error:', error);
      throw new InternalServerErrorException('Error logging out');
    }
  }

  async refreshToken(patientId: number, refreshToken: string, res: Response) {
    try {
      const decodedToken = await this.jwtService.decode(refreshToken);
      if (patientId !== decodedToken['sub']) {
        throw new BadRequestException('id does not match');
      }

      const patient = await this.prismaService.user.findFirst({
        where: { id: patientId },
      });

      console.log(patient);

      if (!patient || !patient.hashedrefreshToken) {
        throw new BadRequestException('Patient not found');
      }
      console.log(patient.hashedrefreshToken  );
      console.log(refreshToken);
      
      
      const tokenMatch = await bcrypt.compare(
        refreshToken,
        patient.hashedrefreshToken,
      );

      if (!tokenMatch) {
        throw new ForbiddenException('Forbidden');
      }

      const tokens = await this.getTokens(patient.id, patient.email);

      const hashed_refresh_token = await bcrypt.hash(tokens.refresh_token, 7);

      const updatedPatient = await this.updateRefershToken(
        patient.id,
        hashed_refresh_token,
      );

      res.cookie('refresh_token', tokens.refresh_token, {
        maxAge: 15 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      });

      const response = {
        message: 'Patient refreshed token',
        patient: updatedPatient, 
        tokens,
      };
      return response;
    } catch (error) {
      console.error('Refresh Token Error:', error);
      throw new InternalServerErrorException('Error refreshing token');
    }
  }

  create(createAuthDto: CreateAuthDto) {
    return 'This action adds a new auth';
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
