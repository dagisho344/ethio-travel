import { AuthForm } from '../../components/auth/AuthForm';
import { Container } from '../../components/ui/Container';
export default function RegisterPage() {
  return (
    <main className="bg-slate-50">
      <Container className="py-14">
        <AuthForm mode="register" />
      </Container>
    </main>
  );
}
