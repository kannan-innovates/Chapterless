const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");
const { HttpStatus } = require("../../helpers/status-code");

const getAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const user = await User.findById(userId);
    const addresses = await Address.find({ userId }).sort({
      isDefault: -1,
      updatedAt: -1,
    });
    const returnTo = req.query.returnTo || "";
    res.render("address", { user, addresses, returnTo });
  } catch (error) {
    console.log("Error in rendering profile addresses", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .render("error", { message: "Internal server error" });
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const {
      fullName,
      phone,
      pincode,
      district,
      state,
      street,
      landmark,
      isDefault,
      returnTo,
    } = req.body;
    if (!fullName || !phone || !pincode || !district || !state || !street) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "All required fields must be filled",
      });
    }
    if (isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }
    const newAddress = new Address({
      userId,
      fullName,
      phone,
      pincode,
      district,
      state,
      street,
      landmark,
      isDefault: isDefault || false,
    });
    await newAddress.save();
    if (returnTo === "checkout") {
      return res.status(HttpStatus.CREATED).json({
        success: true,
        message: "Address added successfully",
        address: newAddress,
        redirect: "/checkout",
      });
    }
    res.status(HttpStatus.CREATED).json({
      success: true,
      message: "Address added successfully",
      address: newAddress,
    });
  } catch (error) {
    console.log("Error adding address:", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to add address" });
  }
};

const updateAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const addressId = req.params.id;
    const {
      fullName,
      phone,
      pincode,
      district,
      state,
      street,
      landmark,
      isDefault,
    } = req.body;

    if (!fullName || !phone || !pincode || !district || !state || !street) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Address not found" });
    }

    if (address.userId.toString() !== userId) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ success: false, message: "Unauthorized access" });
    }

    if (isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }

    // Update address
    address.fullName = fullName;
    address.phone = phone;
    address.pincode = pincode;
    address.district = district;
    address.state = state;
    address.street = street;
    address.landmark = landmark;
    address.isDefault = isDefault || false;

    await address.save();

    res.json({
      success: true,
      message: "Address updated successfully",
      address,
    });
  } catch (error) {
    console.log("Error updating address:", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to update address" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const addressId = req.params.id;

    const address = await Address.findById(addressId);
    if (!address) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Address not found" });
    }

    if (address.userId.toString() !== userId) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ success: false, message: "Unauthorized access" });
    }

    // Delete address
    await Address.findByIdAndDelete(addressId);

    res.json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    console.log("Error deleting address:", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to delete address" });
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const addressId = req.params.id;

    const address = await Address.findById(addressId);
    if (!address) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Address not found" });
    }

    if (address.userId.toString() !== userId) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ success: false, message: "Unauthorized access" });
    }

    await Address.updateMany({ userId }, { isDefault: false });

    address.isDefault = true;
    await address.save();

    res.json({ success: true, message: "Address set as default successfully" });
  } catch (error) {
    console.log("Error setting default address:", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to set default address" });
  }
};

const getAddressById = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const addressId = req.params.id;

    const address = await Address.findById(addressId);
    if (!address) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Address not found" });
    }
    if (address.userId.toString() !== userId) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ success: false, message: "Unauthorized access" });
    }

    res.json({ success: true, address });
  } catch (error) {
    console.log("Error fetching address:", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to fetch address" });
  }
};

module.exports = {
  getAddress,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getAddressById,
};
