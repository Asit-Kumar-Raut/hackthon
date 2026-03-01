const nodemailer = require('nodemailer');

// credentials should be provided via environment variables
// EMAIL_USER and EMAIL_PASS are common names, but we also allow
// ALERT_EMAIL / ALERT_EMAIL_PASS for clarity.
const user = process.env.EMAIL_USER || process.env.ALERT_EMAIL;
const pass = process.env.EMAIL_PASS || process.env.ALERT_EMAIL_PASS;

let transporter = null;
if (user && pass) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

/**
 * Send a simple email alert. Returns true on success, false on failure.
 *
 * @param {string} to - recipient email address
 * @param {string} subject - subject line
 * @param {string} text - plain-text body
 */
const sendEmailAlert = async (to, subject, text) => {
  if (!transporter) {
    console.warn('Email transporter not configured. Set EMAIL_USER/EMAIL_PASS in .env');
    return false;
  }

  try {
    await transporter.sendMail({
      from: user,
      to,
      subject,
      text,
    });
    console.log(`Email sent to ${to}`);
    return true;
  } catch (err) {
    console.error('Error sending email:', err);
    return false;
  }
};

module.exports = { sendEmailAlert };
