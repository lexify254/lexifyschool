import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[]; logged_out?: string | string[] }>;
};

const loginErrors: Record<string, string> = {
  auth_callback: "That sign-in link is invalid or expired. Please try again or request a fresh link.",
  auth_unavailable: "Account services are temporarily unavailable. Please try again later.",
  role_unverified: "We could not verify your account access. Please contact support.",
  logout: "We could not safely end your session. Please try again.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = Array.isArray(params.next) ? params.next[0] : params.next;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const loggedOut = (Array.isArray(params.logged_out) ? params.logged_out[0] : params.logged_out) === "1";
  return (
    <LoginForm
      nextPath={nextPath}
      initialError={errorCode ? loginErrors[errorCode] : undefined}
      initialStatus={loggedOut ? "You have been signed out." : undefined}
    />
  );
}
