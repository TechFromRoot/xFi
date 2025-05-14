export class CreateTweetDto {
  text: string;
  media?: string; // Optional media URL
}
export class CreateTweetResponseDto {
  id: string;
  text: string;
  media?: string; // Optional media URL
}
export class CreateTweetErrorResponseDto {
  error: string;
  message: string;
}
export class CreateTweetErrorResponse {
  error: string;
  message: string;
}
export class CreateTweetResponse {
  id: string;
  text: string;
  media?: string; // Optional media URL
}
