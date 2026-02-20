export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isNewUser: boolean;
}

export interface LoginResponse {
  token: string;
  user: User & { is_new_user: boolean };
}
