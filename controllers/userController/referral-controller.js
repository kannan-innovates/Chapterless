const { HttpStatus } = require("../../helpers/status-code");
const User = require("../../models/userSchema");
const Referral = require("../../models/referralSchema");

const getReferrals = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect('/login');
    }

    // Get referral statistics
    const referralStats = await Referral.find({ referrer: userId }).populate('referred', 'fullName email createdAt');

    res.render("referrals", {
      user,
      referralCode: user.referralCode,
      referrals: referralStats
    });
  } catch (error) {
    console.log("Error in rendering referrals page", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render("error", {
      message: "Internal server error",
    });
  }
};

// Validate referral code
const validateReferral = async (req, res) => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Referral code is required"
      });
    }

    // Find user with this referral code
    const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });

    if (!referrer) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Invalid referral code"
      });
    }

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Valid referral code",
      referrerName: referrer.fullName
    });

  } catch (error) {
    console.error("Error validating referral code:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Server error while validating referral code"
    });
  }
};

module.exports = {
  getReferrals,
  validateReferral,
};
