const User = require("../../models/userSchema");

const getUsers = async (req, res) => {
  try {
    // Get search parameter if any
    const searchTerm = req.query.search || "";

    // Build search query
    let searchQuery = {};
    if (searchTerm) {
      searchQuery = {
        $or: [
          { fullName: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: searchTerm, $options: "i" } },
          { phone: { $regex: searchTerm, $options: "i" } },
        ],
      };
    }

    // Pagination setup
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Users per page
    const skip = (page - 1) * limit;

    // Get total user count matching the search
    const totalUsers = await User.countDocuments(searchQuery);

    // Get users for current page
    const users = await User.find(searchQuery).skip(skip).limit(limit);

    // Calculate pagination variables
    const totalPages = Math.ceil(totalUsers / limit);
    const startIdx = skip;
    const endIdx = Math.min(skip + limit, totalUsers);

    // Render view with all required data
    res.render("getUser", {
      users: users || [],
      currentPage: page,
      totalPages,
      totalUsers,
      startIdx,
      endIdx,
      searchTerm,
    });
  } catch (error) {
    console.log("Error in getting User", error);
    res.status(500).send("Server error");
  }
};

const blockUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { isBlocked: true },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User blocked successfully ",
      user: { id: user._id, isBlocked: user.isBlocked },
    });
  } catch (error) {
    console.log(`Error in deleting user,${error}`);
    return res.status(400).json({
      success: false,
      message: "server error",
    });
  }
};

const unblockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByIdAndUpdate(
      userId,
      { isBlocked: false},
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User unblocked successfully",
    });
  } catch (error) {
    console.log(`Error in unblocking user,${error}`);
    res.status(400).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = { getUsers,blockUser,unblockUser };
