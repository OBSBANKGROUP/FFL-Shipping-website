/**
 * Fast Forward Logistics - Email Backend Server
 * Handles form submissions and sends emails via Hostinger SMTP
 */

const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Email configuration using Hostinger SMTP
const emailTransporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465,
  secure: true, // TLS/SSL
  auth: {
    user: process.env.EMAIL_USER || "support@fastforwardlogistics.express",
    pass: process.env.EMAIL_PASS || "Goodboy@419",
  },
});

// Verify email connection
emailTransporter.verify((error, success) => {
  if (error) {
    console.error("Email configuration error:", error);
  } else {
    console.log("✓ Email service is ready");
  }
});

/**
 * Route: POST /api/contact
 * Sends contact form submission as email
 */
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, company, phone, destination, notes, reference } =
      req.body;

    // Validate required fields
    if (!name || !email || !destination) {
      return res
        .status(400)
        .json({ error: "Missing required fields: name, email, destination" });
    }

    // Email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">New Contact Form Submission</h2>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>From:</strong> ${name}</p>
          ${company ? `<p><strong>Company:</strong> ${company}</p>` : ""}
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
          <p><strong>Subject/Destination:</strong> ${destination}</p>
          ${notes ? `<p><strong>Message:</strong></p><p style="white-space: pre-wrap;">${notes}</p>` : ""}
        </div>

        <div style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          <p>Reference: <strong>${reference || "N/A"}</strong></p>
          <p>Submitted: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    const textContent = `
New Contact Form Submission

From: ${name}
${company ? `Company: ${company}\n` : ""}Email: ${email}
${phone ? `Phone: ${phone}\n` : ""}Subject/Destination: ${destination}
${notes ? `\nMessage:\n${notes}\n` : ""}
---
Reference: ${reference || "N/A"}
Submitted: ${new Date().toLocaleString()}
    `;

    // Send email
    const info = await emailTransporter.sendMail({
      from: `"Fast Forward Logistics Contact Form" <support@fastforwardlogistics.express>`,
      to: "support@fastforwardlogistics.express",
      replyTo: email,
      subject: `New Contact: ${destination}`,
      html: htmlContent,
      text: textContent,
    });

    console.log("Email sent:", info.messageId);

    res.json({
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({
      error: "Failed to send email",
      details: error.message,
    });
  }
});

/**
 * Route: POST /api/quote
 * Sends quote request as email
 */
app.post("/api/quote", async (req, res) => {
  try {
    const {
      reference,
      mode,
      region,
      origin,
      destination,
      weight,
      volume,
      commodity,
      ready_date,
      name,
      company,
      email,
      phone,
      notes,
      estimate_low,
      estimate_high,
    } = req.body;

    // Validate required fields
    if (!name || !email || !destination) {
      return res
        .status(400)
        .json({ error: "Missing required fields: name, email, destination" });
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">New Quote Request</h2>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Shipment Details</h3>
          <p><strong>From:</strong> ${origin || "Iraq"}</p>
          <p><strong>To:</strong> ${destination}</p>
          <p><strong>Region:</strong> ${region}</p>
          <p><strong>Mode:</strong> ${mode}</p>
          <p><strong>Weight:</strong> ${weight} kg</p>
          ${volume ? `<p><strong>Volume:</strong> ${volume} m³</p>` : ""}
          ${commodity ? `<p><strong>Commodity:</strong> ${commodity}</p>` : ""}
          ${ready_date ? `<p><strong>Ready Date:</strong> ${ready_date}</p>` : ""}
          
          ${
            estimate_low && estimate_high
              ? `
          <div style="background-color: #fff; border-left: 4px solid #fbbf24; padding: 15px; margin: 15px 0;">
            <p style="margin: 0;"><strong>Indicative Estimate:</strong> $${estimate_low.toLocaleString()} – $${estimate_high.toLocaleString()}</p>
          </div>
          `
              : ""
          }
          
          <h3 style="margin: 20px 0 10px 0; color: #374151;">Contact Information</h3>
          <p><strong>Name:</strong> ${name}</p>
          ${company ? `<p><strong>Company:</strong> ${company}</p>` : ""}
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
          
          ${
            notes
              ? `
          <h3 style="margin: 20px 0 10px 0; color: #374151;">Additional Notes</h3>
          <p style="white-space: pre-wrap;">${notes}</p>
          `
              : ""
          }
        </div>

        <div style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          <p>Reference: <strong>${reference}</strong></p>
          <p>Submitted: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    const textContent = `
New Quote Request

Reference: ${reference}

Shipment Details:
From: ${origin || "Iraq"}
To: ${destination}
Region: ${region}
Mode: ${mode}
Weight: ${weight} kg
${volume ? `Volume: ${volume} m³\n` : ""}${commodity ? `Commodity: ${commodity}\n` : ""}${ready_date ? `Ready Date: ${ready_date}\n` : ""}
${
  estimate_low && estimate_high
    ? `Indicative Estimate: $${estimate_low.toLocaleString()} – $${estimate_high.toLocaleString()}\n`
    : ""
}

Contact Information:
Name: ${name}
${company ? `Company: ${company}\n` : ""}Email: ${email}
${phone ? `Phone: ${phone}\n` : ""}
${notes ? `\nAdditional Notes:\n${notes}\n` : ""}

Submitted: ${new Date().toLocaleString()}
    `;

    // Send email
    const info = await emailTransporter.sendMail({
      from: `"Fast Forward Logistics Quote Request" <support@fastforwardlogistics.express>`,
      to: "support@fastforwardlogistics.express",
      replyTo: email,
      subject: `Quote Request - ${destination}`,
      html: htmlContent,
      text: textContent,
    });

    console.log("Quote email sent:", info.messageId);

    res.json({
      success: true,
      message: "Quote email sent successfully",
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Error sending quote email:", error);
    res.status(500).json({
      error: "Failed to send quote email",
      details: error.message,
    });
  }
});

/**
 * Health check endpoint
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Fast Forward Logistics Email Server running on port ${PORT}`);
  console.log(`📧 Email: support@fastforwardlogistics.express`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});
