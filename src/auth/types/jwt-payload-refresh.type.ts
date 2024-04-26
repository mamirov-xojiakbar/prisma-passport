import { JwtPaload } from './jwt-payload.type';

export type JwtPaloadWithRefreshToken = JwtPaload & { refreshToken: string };
