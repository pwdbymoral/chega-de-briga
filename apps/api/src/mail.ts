import nodemailer from "nodemailer";

export async function sendMail(to: string, subject: string, text: string) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!user || !pass) throw new Error("Transactional email is not configured");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM ?? user, to, subject, text });
}
