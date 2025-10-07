import { google } from 'googleapis';

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXTAUTH_URL + '/api/auth/callback/google';

// Gmail API Scopes
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * สร้าง OAuth2 Client
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

/**
 * สร้าง Authorization URL สำหรับให้ผู้ใช้ล็อกอิน Google
 */
export function getAuthUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state, // ใช้สำหรับเก็บข้อมูลเพิ่มเติม เช่น issueId
    prompt: 'select_account' // บังคับให้แสดง Account Picker ทุกครั้ง
  });
}

/**
 * แลกเปลี่ยน authorization code เป็น access token
 */
export async function getTokensFromCode(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * ส่งอีเมลผ่าน Gmail API
 */
export async function sendEmailViaGmail(
  accessToken: string,
  emailData: {
    to: string[];
    subject: string;
    htmlBody: string;
    fromName: string;
    fromEmail: string;
  }
) {
  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // สร้าง email message
    const message = [
      `To: ${emailData.to.join(', ')}`,
      `From: ${emailData.fromName} <${emailData.fromEmail}>`,
      `Subject: ${emailData.subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      emailData.htmlBody
    ].join('\n');

    // Encode เป็น base64
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // ส่งอีเมล
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log('Email sent via Gmail API:', result.data);
    return { success: true, messageId: result.data.id };

  } catch (error) {
    console.error('Gmail API error:', error);
    return { success: false, error: error };
  }
}

/**
 * ดึงข้อมูล user profile จาก Google
 */
export async function getUserProfile(accessToken: string) {
  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    return {
      id: data.id,
      email: data.email,
      name: data.name
    };
  } catch (error) {
    console.error('Get user profile error:', error);
    return null;
  }
}
