const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');

// Get address page with user's addresses
const getAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const user = await User.findById(userId);
    const addresses = await Address.find({ userId }).sort({ isDefault: -1, updatedAt: -1 });
    const returnTo = req.query.returnTo || '';
    res.render('address', { user, addresses, returnTo });
  } catch (error) {
    console.log('Error in rendering profile addresses', error);
    res.status(500).render('error', { message: 'Internal server error' });
  }
};
// Add a new address
const addAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { fullName, phone, pincode, district, state, street, landmark, isDefault, returnTo } = req.body;
    if (!fullName || !phone || !pincode || !district || !state || !street) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
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
      isDefault: isDefault || false
    });
    await newAddress.save();
    if (returnTo === 'checkout') {
      return res.status(201).json({ success: true, message: 'Address added successfully', address: newAddress, redirect: '/checkout' });
    }
    res.status(201).json({ success: true, message: 'Address added successfully', address: newAddress });
  } catch (error) {
    console.log('Error adding address:', error);
    res.status(500).json({ success: false, message: 'Failed to add address' });
  }
};

// Update an existing address
const updateAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const addressId = req.params.id;
    const { fullName, phone, pincode, district, state, street, landmark, isDefault } = req.body;
    
    // Validate required fields
    if (!fullName || !phone || !pincode || !district || !state || !street) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }
    
    // Find address and verify ownership
    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    
    if (address.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }
    
    // If setting as default, unset any existing default address
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
      message: 'Address updated successfully',
      address
    });
  } catch (error) {
    console.log('Error updating address:', error);
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
};

// Delete an address
const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const addressId = req.params.id;
    
    // Find address and verify ownership
    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    
    if (address.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }
    
    // Delete address
    await Address.findByIdAndDelete(addressId);
    
    res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    console.log('Error deleting address:', error);
    res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
};

// Set address as default
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const addressId = req.params.id;
    
    // Find address and verify ownership
    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    
    if (address.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }
    
    // Unset any existing default address
    await Address.updateMany({ userId }, { isDefault: false });
    
    // Set this address as default
    address.isDefault = true;
    await address.save();
    
    res.json({ success: true, message: 'Address set as default successfully' });
  } catch (error) {
    console.log('Error setting default address:', error);
    res.status(500).json({ success: false, message: 'Failed to set default address' });
  }
};

module.exports = {
  getAddress,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
