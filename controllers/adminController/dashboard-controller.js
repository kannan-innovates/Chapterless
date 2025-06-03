const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const { HttpStatus } = require('../../helpers/status-code');

const getDashboard = async (req, res) => {
  try {
    // Get filter parameter (default to monthly)
    const chartFilter = req.query.chartFilter || 'monthly';

    // Calculate dashboard statistics
    const dashboardStats = await calculateDashboardStats();

    // Calculate chart data based on filter
    const chartData = await calculateChartData(chartFilter);

    // Calculate best selling products
    const bestSellingProducts = await calculateBestSellingProducts();

    // Calculate best selling categories
    const bestSellingCategories = await calculateBestSellingCategories();

    // Calculate best selling authors
    const bestSellingAuthors = await calculateBestSellingAuthors();

    res.render('adminDashboard', {
      admin: res.locals.admin,
      dashboardStats,
      chartData,
      bestSellingProducts,
      bestSellingCategories,
      bestSellingAuthors,
      currentFilter: chartFilter
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load Dashboard',
    });
  }
};

// Helper function to calculate dashboard statistics
const calculateDashboardStats = async () => {
  try {
    const now = new Date();

    // Current month (this month)
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Previous month
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // 1. Total Users (exclude admin users) - show total but compare monthly growth
    const totalUsers = await User.countDocuments({ isAdmin: false });
    const currentMonthUsers = await User.countDocuments({
      isAdmin: false,
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });
    const previousMonthUsers = await User.countDocuments({
      isAdmin: false,
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd }
    });
    const usersGrowth = calculateGrowthPercentage(currentMonthUsers, previousMonthUsers);

    // 2. Total Orders - show total but compare monthly growth
    const totalOrders = await Order.countDocuments({ isDeleted: false });
    const currentMonthOrders = await Order.countDocuments({
      isDeleted: false,
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });
    const previousMonthOrders = await Order.countDocuments({
      isDeleted: false,
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd }
    });
    const ordersGrowth = calculateGrowthPercentage(currentMonthOrders, previousMonthOrders);

    // 3. Total Sales (from successful orders) - show total but compare monthly growth
    const salesOrders = await Order.find({
      orderStatus: { $in: ['Delivered', 'Shipped', 'Processing'] },
      isDeleted: false
    });
    const totalSales = salesOrders.reduce((sum, order) => sum + (order.total || 0), 0);

    const currentMonthSalesOrders = await Order.find({
      orderStatus: { $in: ['Delivered', 'Shipped', 'Processing'] },
      isDeleted: false,
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });
    const currentMonthSales = currentMonthSalesOrders.reduce((sum, order) => sum + (order.total || 0), 0);

    const previousMonthSalesOrders = await Order.find({
      orderStatus: { $in: ['Delivered', 'Shipped', 'Processing'] },
      isDeleted: false,
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd }
    });
    const previousMonthSales = previousMonthSalesOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const salesGrowth = calculateGrowthPercentage(currentMonthSales, previousMonthSales);

    // 4. Pending Orders - show current total but compare monthly growth
    const pendingOrders = await Order.countDocuments({
      orderStatus: { $in: ['Placed', 'Processing'] },
      isDeleted: false
    });
    const currentMonthPendingOrders = await Order.countDocuments({
      orderStatus: { $in: ['Placed', 'Processing'] },
      isDeleted: false,
      createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });
    const previousMonthPendingOrders = await Order.countDocuments({
      orderStatus: { $in: ['Placed', 'Processing'] },
      isDeleted: false,
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd }
    });
    const pendingGrowth = calculateGrowthPercentage(currentMonthPendingOrders, previousMonthPendingOrders);

    // Debug logging to help verify calculations
    console.log('Dashboard Stats Debug (Fixed Logic):');
    console.log('Users - Total:', totalUsers, 'Current Month:', currentMonthUsers, 'Previous Month:', previousMonthUsers);
    console.log('Orders - Total:', totalOrders, 'Current Month:', currentMonthOrders, 'Previous Month:', previousMonthOrders);
    console.log('Sales - Total:', totalSales, 'Current Month:', currentMonthSales, 'Previous Month:', previousMonthSales);
    console.log('Pending - Total:', pendingOrders, 'Current Month:', currentMonthPendingOrders, 'Previous Month:', previousMonthPendingOrders);
    console.log('Growth Calculations (Current vs Previous Month):');
    console.log('Users Growth:', usersGrowth);
    console.log('Orders Growth:', ordersGrowth);
    console.log('Sales Growth:', salesGrowth);
    console.log('Pending Growth:', pendingGrowth);

    return {
      totalUsers: {
        value: totalUsers.toLocaleString('en-IN'),
        growth: usersGrowth,
        rawValue: totalUsers
      },
      totalOrders: {
        value: totalOrders.toLocaleString('en-IN'),
        growth: ordersGrowth,
        rawValue: totalOrders
      },
      totalSales: {
        value: formatCurrency(totalSales),
        growth: salesGrowth,
        rawValue: totalSales
      },
      pendingOrders: {
        value: pendingOrders.toLocaleString('en-IN'),
        growth: pendingGrowth,
        rawValue: pendingOrders
      }
    };
  } catch (error) {
    console.error('Error calculating dashboard stats:', error);
    return {
      totalUsers: { value: '0', growth: { percentage: 0, isPositive: true }, rawValue: 0 },
      totalOrders: { value: '0', growth: { percentage: 0, isPositive: true }, rawValue: 0 },
      totalSales: { value: '₹0', growth: { percentage: 0, isPositive: true }, rawValue: 0 },
      pendingOrders: { value: '0', growth: { percentage: 0, isPositive: true }, rawValue: 0 }
    };
  }
};

// Helper function to calculate growth percentage
const calculateGrowthPercentage = (current, previous) => {
  // Handle edge cases
  if (previous === 0) {
    if (current === 0) {
      return { percentage: 0, isPositive: true };
    }
    // If previous was 0 and current > 0, it's infinite growth, show as 100%
    return { percentage: 100, isPositive: true };
  }

  if (current === 0 && previous > 0) {
    // Complete decline from previous value
    return { percentage: 100, isPositive: false };
  }

  // Calculate percentage change: ((current - previous) / previous) * 100
  const percentageChange = ((current - previous) / previous) * 100;
  const isPositive = percentageChange >= 0;
  const percentage = Math.abs(percentageChange);

  return {
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
    isPositive
  };
};

// Helper function to format currency
const formatCurrency = (amount) => {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
};

// Helper function to calculate chart data based on filter
const calculateChartData = async (filter) => {
  try {
    const now = new Date();
    let startDate, endDate, labels, groupBy;

    switch (filter) {
      case 'daily':
        // Last 7 days
        startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        endDate = now;
        labels = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          labels.push(date.toLocaleDateString('en-IN', { weekday: 'short' }));
        }
        groupBy = 'day';
        break;

      case 'weekly':
        // Last 8 weeks
        startDate = new Date(now.getTime() - 7 * 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        labels = [];
        for (let i = 7; i >= 0; i--) {
          labels.push(`Week ${8-i}`);
        }
        groupBy = 'week';
        break;

      case 'yearly':
        // Last 5 years
        startDate = new Date(now.getFullYear() - 4, 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        labels = [];
        for (let i = 4; i >= 0; i--) {
          labels.push((now.getFullYear() - i).toString());
        }
        groupBy = 'year';
        break;

      default: // monthly
        // Last 12 months
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        labels = [];
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push(monthDate.toLocaleDateString('en-IN', { month: 'short' }));
        }
        groupBy = 'month';
        break;
    }

    // Get orders within date range
    const orders = await Order.find({
      orderStatus: { $in: ['Delivered', 'Shipped', 'Processing'] },
      isDeleted: false,
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: 1 });

    // Group orders by time period and calculate totals
    const salesData = new Array(labels.length).fill(0);
    const grossSalesData = new Array(labels.length).fill(0);

    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      let index;

      switch (groupBy) {
        case 'day':
          const daysDiff = Math.floor((now - orderDate) / (24 * 60 * 60 * 1000));
          index = 6 - daysDiff;
          break;
        case 'week':
          const weeksDiff = Math.floor((now - orderDate) / (7 * 24 * 60 * 60 * 1000));
          index = 7 - weeksDiff;
          break;
        case 'year':
          index = orderDate.getFullYear() - (now.getFullYear() - 4);
          break;
        default: // month
          const monthsDiff = (now.getFullYear() - orderDate.getFullYear()) * 12 + (now.getMonth() - orderDate.getMonth());
          index = 11 - monthsDiff;
          break;
      }

      if (index >= 0 && index < labels.length) {
        salesData[index] += order.total || 0;
        grossSalesData[index] += (order.total || 0) + (order.discount || 0) + (order.couponDiscount || 0);
      }
    });

    return {
      labels,
      salesData,
      grossSalesData,
      filter,
      maxValue: Math.max(...salesData, ...grossSalesData)
    };
  } catch (error) {
    console.error('Error calculating chart data:', error);
    return {
      labels: ['No Data'],
      salesData: [0],
      grossSalesData: [0],
      filter,
      maxValue: 1000
    };
  }
};

// Helper function to calculate best selling products
const calculateBestSellingProducts = async () => {
  try {
    // Aggregate order items to find best selling products
    const bestSellingProducts = await Order.aggregate([
      // Match successful orders only
      {
        $match: {
          orderStatus: { $in: ['Delivered', 'Shipped', 'Processing'] },
          isDeleted: false
        }
      },
      // Unwind items array to work with individual items
      { $unwind: '$items' },
      // Match only active items
      {
        $match: {
          'items.status': 'Active'
        }
      },
      // Group by product and calculate totals
      {
        $group: {
          _id: '$items.product',
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.discountedPrice', '$items.quantity'] } },
          orderCount: { $sum: 1 },
          productTitle: { $first: '$items.title' },
          productImage: { $first: '$items.image' }
        }
      },
      // Sort by total quantity sold (descending)
      { $sort: { totalQuantitySold: -1 } },
      // Limit to top 10
      { $limit: 10 },
      // Lookup product details
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      // Add product details to result
      {
        $addFields: {
          product: { $arrayElemAt: ['$productDetails', 0] }
        }
      },
      // Project final fields
      {
        $project: {
          _id: 1,
          productTitle: 1,
          productImage: 1,
          totalQuantitySold: 1,
          totalRevenue: 1,
          orderCount: 1,
          author: '$product.author',
          salePrice: '$product.salePrice',
          isListed: '$product.isListed'
        }
      }
    ]);

    return bestSellingProducts;
  } catch (error) {
    console.error('Error calculating best selling products:', error);
    return [];
  }
};

// Helper function to calculate best selling categories
const calculateBestSellingCategories = async () => {
  try {
    // Aggregate order items to find best selling categories
    const bestSellingCategories = await Order.aggregate([
      // Match successful orders only
      {
        $match: {
          orderStatus: { $in: ['Delivered', 'Shipped', 'Processing'] },
          isDeleted: false
        }
      },
      // Unwind items array to work with individual items
      { $unwind: '$items' },
      // Match only active items
      {
        $match: {
          'items.status': 'Active'
        }
      },
      // Lookup product details to get category
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      // Filter out items where product lookup failed
      {
        $match: {
          'productDetails.0': { $exists: true }
        }
      },
      // Add product details to the document
      {
        $addFields: {
          product: { $arrayElemAt: ['$productDetails', 0] }
        }
      },
      // Lookup category details
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      // Filter out items where category lookup failed
      {
        $match: {
          'categoryDetails.0': { $exists: true }
        }
      },
      // Add category details to the document
      {
        $addFields: {
          category: { $arrayElemAt: ['$categoryDetails', 0] }
        }
      },
      // Group by category and calculate totals
      {
        $group: {
          _id: '$category._id',
          categoryName: { $first: '$category.name' },
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.discountedPrice', '$items.quantity'] } },
          uniqueProducts: { $addToSet: '$items.product' },
          orderCount: { $sum: 1 }
        }
      },
      // Add count of unique products
      {
        $addFields: {
          productCount: { $size: '$uniqueProducts' }
        }
      },
      // Sort by total quantity sold (descending)
      { $sort: { totalQuantitySold: -1 } },
      // Limit to top 10
      { $limit: 10 },
      // Project final fields
      {
        $project: {
          _id: 1,
          categoryName: 1,
          totalQuantitySold: 1,
          totalRevenue: 1,
          productCount: 1,
          orderCount: 1
        }
      }
    ]);

    return bestSellingCategories;
  } catch (error) {
    console.error('Error calculating best selling categories:', error);
    return [];
  }
};

// Helper function to calculate best selling authors
const calculateBestSellingAuthors = async () => {
  try {
    // Aggregate order items to find best selling authors
    const bestSellingAuthors = await Order.aggregate([
      // Match successful orders only
      {
        $match: {
          orderStatus: { $in: ['Delivered', 'Shipped', 'Processing'] },
          isDeleted: false
        }
      },
      // Unwind items array to work with individual items
      { $unwind: '$items' },
      // Match only active items
      {
        $match: {
          'items.status': 'Active'
        }
      },
      // Lookup product details to get author
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      // Filter out items where product lookup failed
      {
        $match: {
          'productDetails.0': { $exists: true }
        }
      },
      // Add product details to the document
      {
        $addFields: {
          product: { $arrayElemAt: ['$productDetails', 0] }
        }
      },
      // Filter out products without author
      {
        $match: {
          'product.author': { $exists: true, $ne: null, $ne: '' }
        }
      },
      // Group by author and calculate totals
      {
        $group: {
          _id: '$product.author',
          authorName: { $first: '$product.author' },
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.discountedPrice', '$items.quantity'] } },
          uniqueProducts: { $addToSet: '$items.product' },
          orderCount: { $sum: 1 }
        }
      },
      // Add count of unique books by this author
      {
        $addFields: {
          bookCount: { $size: '$uniqueProducts' }
        }
      },
      // Sort by total quantity sold (descending)
      { $sort: { totalQuantitySold: -1 } },
      // Limit to top 10
      { $limit: 10 },
      // Project final fields
      {
        $project: {
          _id: 1,
          authorName: 1,
          totalQuantitySold: 1,
          totalRevenue: 1,
          bookCount: 1,
          orderCount: 1
        }
      }
    ]);

    return bestSellingAuthors;
  } catch (error) {
    console.error('Error calculating best selling authors:', error);
    return [];
  }
};

module.exports = {
  getDashboard
};
