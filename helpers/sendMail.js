require("dotenv").config();
const nodemailer = require("nodemailer");

const sendOtpEmail = async (email, name, otp, subject, purpose = "signup") => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Generate professional HTML email template
  const generateEmailTemplate = (name, otp, purpose) => {
    let title, message, actionText;

    switch (purpose) {
      case "resend":
        title = "New Verification Code";
        message = "Here's your new verification code for your Chapterless account:";
        actionText = "Complete your signup to start exploring our amazing collection of books!";
        break;
      case "forgot-password":
        title = "Password Reset Code";
        message = "Use this verification code to reset your Chapterless password:";
        actionText = "This code will expire in 1 minute for your security.";
        break;
      case "email-update":
        title = "Email Update Verification";
        message = "Use this verification code to update your email address:";
        actionText = "This code will expire in 1 minute for your security.";
        break;
      default:
        title = "Welcome to Chapterless!";
        message = "Thank you for joining Chapterless. Use this verification code to complete your account setup:";
        actionText = "Once verified, you'll have access to thousands of books and exclusive offers!";
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8f9fa;
            }
            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            }
            .header {
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: white;
                padding: 30px 20px;
                text-align: center;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
                letter-spacing: 1px;
            }
            .tagline {
                font-size: 14px;
                opacity: 0.9;
                font-weight: 300;
            }
            .content {
                padding: 40px 30px;
                text-align: center;
            }
            .greeting {
                font-size: 24px;
                color: #2c3e50;
                margin-bottom: 20px;
                font-weight: 600;
            }
            .message {
                font-size: 16px;
                color: #555;
                margin-bottom: 30px;
                line-height: 1.8;
            }
            .otp-container {
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border: 2px dashed #dee2e6;
                border-radius: 12px;
                padding: 25px;
                margin: 30px 0;
                display: inline-block;
            }
            .otp-label {
                font-size: 14px;
                color: #6c757d;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-weight: 600;
            }
            .otp-code {
                font-size: 36px;
                font-weight: bold;
                color: #2c3e50;
                letter-spacing: 8px;
                font-family: 'Courier New', monospace;
                margin: 10px 0;
            }
            .action-text {
                font-size: 14px;
                color: #28a745;
                margin-top: 20px;
                font-weight: 500;
            }
            .security-note {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 15px;
                margin: 25px 0;
                font-size: 14px;
                color: #856404;
            }
            .footer {
                background-color: #f8f9fa;
                padding: 25px 30px;
                text-align: center;
                border-top: 1px solid #dee2e6;
            }
            .footer-text {
                font-size: 14px;
                color: #6c757d;
                margin-bottom: 15px;
            }
            .social-links {
                margin: 15px 0;
            }
            .social-links a {
                color: #2c3e50;
                text-decoration: none;
                margin: 0 10px;
                font-weight: 500;
            }
            .copyright {
                font-size: 12px;
                color: #adb5bd;
                margin-top: 15px;
            }
            @media (max-width: 600px) {
                .content {
                    padding: 30px 20px;
                }
                .otp-code {
                    font-size: 28px;
                    letter-spacing: 4px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="logo">📚 CHAPTERLESS</div>
                <div class="tagline">Your Gateway to Endless Stories</div>
            </div>

            <div class="content">
                <div class="greeting">Hello ${name}!</div>
                <div class="message">${message}</div>

                <div class="otp-container">
                    <div class="otp-label">Verification Code</div>
                    <div class="otp-code">${otp}</div>
                </div>

                <div class="action-text">${actionText}</div>

                <div class="security-note">
                    <strong>🔒 Security Notice:</strong> This code is valid for 1 minute only. Never share this code with anyone. If you didn't request this code, please ignore this email.
                </div>
            </div>

            <div class="footer">
                <div class="footer-text">
                    Need help? Contact our support team at <strong>support@chapterless.com</strong>
                </div>
                <div class="social-links">
                    <a href="#">About Us</a> |
                    <a href="#">Privacy Policy</a> |
                    <a href="#">Terms of Service</a>
                </div>
                <div class="copyright">
                    © ${new Date().getFullYear()} Chapterless. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
  };

  const htmlContent = generateEmailTemplate(name, otp, purpose);

  const mailOptions = {
    from: '"Chapterless - Your Bookstore" <noreply@chapterless.com>',
    to: email,
    subject,
    html: htmlContent,
    text: `Hello ${name}, Your verification code for Chapterless is: ${otp}. This code will expire in 1 minute.`, // Fallback text
  };

  await transporter.sendMail(mailOptions);
};

const sendContactEmail = async (contactData, type = "confirmation") => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
    },
  });

  if (type === "confirmation") {
    // Send confirmation email to user
    const confirmationTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thank You for Contacting Us</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8f9fa;
            }
            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            }
            .header {
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: white;
                padding: 30px 20px;
                text-align: center;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
                letter-spacing: 1px;
            }
            .tagline {
                font-size: 14px;
                opacity: 0.9;
            }
            .content {
                padding: 40px 30px;
            }
            .greeting {
                font-size: 20px;
                font-weight: 600;
                color: #2c3e50;
                margin-bottom: 20px;
            }
            .message {
                font-size: 16px;
                line-height: 1.6;
                color: #555;
                margin-bottom: 25px;
            }
            .contact-details {
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
                border-left: 4px solid #2c3e50;
            }
            .contact-details h4 {
                color: #2c3e50;
                margin-bottom: 10px;
                font-size: 16px;
            }
            .contact-details p {
                margin: 5px 0;
                color: #666;
            }
            .footer {
                background-color: #f8f9fa;
                padding: 25px 30px;
                text-align: center;
                border-top: 1px solid #e9ecef;
            }
            .footer-text {
                font-size: 14px;
                color: #666;
                margin-bottom: 15px;
            }
            .social-links {
                font-size: 12px;
                color: #999;
                margin-bottom: 10px;
            }
            .social-links a {
                color: #2c3e50;
                text-decoration: none;
            }
            .copyright {
                font-size: 12px;
                color: #999;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="logo">📚 CHAPTERLESS</div>
                <div class="tagline">Your Gateway to Endless Stories</div>
            </div>

            <div class="content">
                <div class="greeting">Hello ${contactData.name}!</div>
                <div class="message">
                    Thank you for reaching out to us! We've received your message and our team will get back to you within 24 hours.
                </div>

                <div class="contact-details">
                    <h4>📋 Your Message Details:</h4>
                    <p><strong>Subject:</strong> ${getSubjectText(contactData.subject)}</p>
                    <p><strong>Message:</strong> ${contactData.message}</p>
                    <p><strong>Submitted on:</strong> ${new Date().toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</p>
                </div>

                <div class="message">
                    In the meantime, feel free to explore our curated collection of books or check out our latest arrivals. We're here to help you find your next great read!
                </div>
            </div>

            <div class="footer">
                <div class="footer-text">
                    Need immediate assistance? Contact us at <strong>hello@chapterless.com</strong> or call <strong>+91 1234567890</strong>
                </div>
                <div class="social-links">
                    <a href="#">About Us</a> |
                    <a href="#">Privacy Policy</a> |
                    <a href="#">Terms of Service</a>
                </div>
                <div class="copyright">
                    © ${new Date().getFullYear()} Chapterless. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    const mailOptions = {
      from: '"Chapterless - Your Bookstore" <noreply@chapterless.com>',
      to: contactData.email,
      subject: "✅ Thank you for contacting Chapterless - We'll get back to you soon!",
      html: confirmationTemplate,
      text: `Hello ${contactData.name}, Thank you for contacting Chapterless! We've received your message about "${getSubjectText(contactData.subject)}" and will get back to you within 24 hours.`,
    };

    await transporter.sendMail(mailOptions);
  } else if (type === "admin") {
    // Send notification email to admin
    const adminTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Form Submission</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .field { margin: 10px 0; }
            .field strong { color: #2c3e50; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>📧 New Contact Form Submission</h2>
            </div>
            <div class="content">
                <div class="field"><strong>Name:</strong> ${contactData.name}</div>
                <div class="field"><strong>Email:</strong> ${contactData.email}</div>
                <div class="field"><strong>Phone:</strong> ${contactData.phone || 'Not provided'}</div>
                <div class="field"><strong>Subject:</strong> ${getSubjectText(contactData.subject)}</div>
                <div class="field"><strong>Message:</strong><br>${contactData.message}</div>
                <div class="field"><strong>Submitted:</strong> ${new Date().toLocaleString('en-IN')}</div>
            </div>
        </div>
    </body>
    </html>
    `;

    const adminMailOptions = {
      from: '"Chapterless Contact Form" <noreply@chapterless.com>',
      to: process.env.ADMIN_EMAIL || process.env.EMAIL,
      subject: `🔔 New Contact: ${getSubjectText(contactData.subject)} - ${contactData.name}`,
      html: adminTemplate,
      text: `New contact form submission from ${contactData.name} (${contactData.email}) about ${getSubjectText(contactData.subject)}: ${contactData.message}`,
    };

    await transporter.sendMail(adminMailOptions);
  }
};

// Helper function to get readable subject text
const getSubjectText = (subject) => {
  const subjects = {
    general: "General Inquiry",
    order: "Order Support",
    recommendation: "Book Recommendation",
    feedback: "Feedback",
    partnership: "Partnership",
    other: "Other"
  };
  return subjects[subject] || subject;
};

module.exports = { sendOtpEmail, sendContactEmail };