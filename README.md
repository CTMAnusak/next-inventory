This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment Setup

1. คัดลอกไฟล์ `.env.example` เป็น `.env.local`
2. กรอกค่า environment variables ที่จำเป็น:

### MongoDB
- `MONGODB_URI`: URI ของ MongoDB database

### JWT
- `JWT_SECRET`: Secret key สำหรับ JWT tokens

### Email (Nodemailer)
- `EMAIL_HOST`: SMTP host (เช่น smtp.gmail.com)
- `EMAIL_PORT`: SMTP port (587 สำหรับ TLS)
- `EMAIL_USER`: อีเมลที่ใช้ส่ง
- `EMAIL_PASS`: App password ของ Gmail

### Admin
- `ADMIN_PASSWORD`: รหัสผ่านของ admin หลัก

### NextAuth
- `NEXTAUTH_URL`: URL ของแอป (http://localhost:3000 สำหรับ development)
- `NEXTAUTH_SECRET`: Secret key สำหรับ NextAuth

### EmailJS (ถ้าใช้)
- `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`: Public key ของ EmailJS
- `NEXT_PUBLIC_EMAILJS_SERVICE_ID`: Service ID ของ EmailJS
- `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`: Template ID ของ EmailJS

### Google OAuth (ถ้าใช้)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Client ID จาก Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: Client Secret จาก Google Cloud Console