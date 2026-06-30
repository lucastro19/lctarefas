import crypto from 'crypto';

export function generateCalendarToken(userId) {
  return crypto
    .createHmac('sha256', process.env.CALENDAR_SECRET)
    .update(userId)
    .digest('base64url')
    .slice(0, 32);
}
