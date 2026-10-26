// A social action that can't be done, with a message for the reader and the
// status to answer with (lib/social/route.ts).
export class FriendError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}
