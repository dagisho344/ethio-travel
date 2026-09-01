export interface AuthenticatedUser {
  email: string;
  roles: string[];
  sessionId: string;
  sub: string;
}
