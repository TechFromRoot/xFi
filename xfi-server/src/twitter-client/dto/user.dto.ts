// create-user.dto.ts
export class CreateUserDto {
  userId;
  userName: string;
  chains?: string[];
}

// update-user.dto.ts
export class UpdateUserDto {
  userName?: string;
  active?: boolean;
  chains?: string[];
}
