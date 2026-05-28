import { User, IUser } from "./User";

export async function getOrCreateUser(
  telegramId: string,
  userData?: Record<string, unknown>
): Promise<IUser | null> {
  if (userData) {
    return await User.findOneAndUpdate(
      { telegramId },
      {
        $set: {
          firstName: userData.first_name || userData.firstName,
          lastName: userData.last_name || userData.lastName,
          username: userData.username,
          photoUrl: userData.photo_url || userData.photoUrl,
        },
      },
      { upsert: true, new: true }
    );
  }
  return await User.findOne({ telegramId });
}