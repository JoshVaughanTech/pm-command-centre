export { default } from 'next-auth/middleware';

export const config = {
  matcher: ['/((?!auth|api|share|_next/static|_next/image|favicon.ico).*)'],
};
