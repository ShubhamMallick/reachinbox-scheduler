import nodemailer from "nodemailer";
import { config } from "./config";

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpPort === 465,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPass
  }
});

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  fromName: string,
  fromEmail: string
) {
  return transporter.sendMail({
    from: {
      name: fromName,
      address: fromEmail
    },
    to,
    subject,
    text: body
  });
}