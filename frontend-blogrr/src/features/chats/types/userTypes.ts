export interface UserBasic {
  id: number;
  username: string;
  email: string;
}

export interface SearchUserResponse {
  items: UserBasic[];
  total: number;
  page: number;
  size: number;
}
