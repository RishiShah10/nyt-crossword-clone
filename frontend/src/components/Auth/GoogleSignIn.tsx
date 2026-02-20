import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';

const GoogleSignIn: React.FC = () => {
  const { login } = useAuth();

  const handleSuccess = async (response: CredentialResponse) => {
    if (response.credential) {
      try {
        await login(response.credential);
      } catch (error) {
        console.error('Login failed:', error);
      }
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => console.error('Google Sign-In failed')}
      size="medium"
      shape="pill"
      text="signin_with"
    />
  );
};

export default GoogleSignIn;
