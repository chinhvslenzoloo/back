import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReminderEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to,
    subject,
    html
  });
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const safeUrl = String(resetUrl);
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to,
    subject: "Reset your password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Password reset</h2>
        <p>Click the link below to reset your password:</p>
        <p><a href="${safeUrl}">${safeUrl}</a></p>
        <p>If you did not request a password reset, you can ignore this email.</p>
      </div>
    `
  });
}
