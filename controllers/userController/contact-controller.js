const { HttpStatus } = require('../../helpers/status-code');
const Contact = require('../../models/contactSchema');
const { sendContactEmail } = require('../../helpers/sendMail');

const getContact = async (req, res) => {
  try {
    res.render("contact");
  } catch (error) {
    console.log("Error in rendering contact page", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render("error", {
      message: "Internal server error",
    });
  }
};

const postContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Create new contact message in database
    const contactMessage = new Contact({
      name,
      email,
      phone,
      subject,
      message,
    });

    await contactMessage.save();

    // Send confirmation email to user
    try {
      await sendContactEmail({
        name,
        email,
        phone,
        subject,
        message,
      }, "confirmation");
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Continue execution even if email fails
    }

    // Send notification email to admin
    try {
      await sendContactEmail({
        name,
        email,
        phone,
        subject,
        message,
      }, "admin");
    } catch (emailError) {
      console.error("Failed to send admin notification email:", emailError);
      // Continue execution even if email fails
    }

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "✅ Thanks for contacting us! We'll get back to you soon.",
    });

  } catch (error) {
    console.error("Error in postContact:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};

module.exports = {
  getContact,
  postContact,
};
