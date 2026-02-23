export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isNewUser: boolean;
}

export interface LoginResponse {
  user: User & { is_new_user: boolean };
}
