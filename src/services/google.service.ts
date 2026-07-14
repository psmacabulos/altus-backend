import { OAuth2Client } from 'google-auth-library';
import { AppError } from './auth.service';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

interface GoogleIdentity {
  googleId: string;
  email: string;
}

const verifyGoogleToken = async (idToken: string): Promise<GoogleIdentity> => {
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch {
    throw new AppError('Invalid Google token', 401);
  }

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new AppError('Invalid Google token', 401);
  }

  if (!payload.email_verified) {
    throw new AppError('Google account email is not verified', 401);
  }

  return {
    googleId: payload.sub, // googles unique id for this person
    email: payload.email,
  };
};

export { verifyGoogleToken };
