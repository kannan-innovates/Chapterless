# 📚 Chapterless - E-Commerce Bookstore Platform

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green.svg)](https://www.mongodb.com/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-blue.svg)](https://expressjs.com/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.x-purple.svg)](https://getbootstrap.com/)

A comprehensive e-commerce platform built with the MERN stack, specifically designed for book retail with advanced features including payment integration, order management, and promotional systems.

## 🚀 Live Demo

**Repository:** [https://github.com/kannan-innovates/chapterless](https://github.com/kannan-innovates/chapterless)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Admin Panel](#-admin-panel)
- [User Features](#-user-features)
- [Payment Integration](#-payment-integration)
- [Security Features](#-security-features)
- [Contributing](#-contributing)

## ✨ Features

### 🛒 **E-Commerce Core**
- **Product Catalog**: Comprehensive book inventory with categories, authors, and detailed descriptions
- **Shopping Cart**: Real-time cart management with quantity controls and price calculations
- **Wishlist**: Save products for later with bulk cart transfer functionality
- **Search & Filter**: Advanced product search with category and price filtering
- **Product Recommendations**: Top-selling and new arrival sections

### 💳 **Payment & Checkout**
- **Multiple Payment Methods**: 
  - Cash on Delivery (COD) with order value restrictions
  - Razorpay integration for online payments
  - Wallet payments with instant processing
- **Smart Checkout**: Multi-step checkout with address management
- **Order Validation**: Comprehensive order verification and processing

### 👤 **User Management**
- **Authentication System**: Secure login/signup with email verification
- **OTP Verification**: Email-based OTP for account security
- **Profile Management**: Complete user profile with address management
- **Password Security**: Secure password change functionality

### 🎯 **Promotional System**
- **Coupon Management**: 
  - Fixed and percentage-based discounts
  - Category and product-specific coupons
  - Usage limits and expiry management
- **Offer System**:
  - Product-specific offers
  - Category-wide promotions
  - Automatic discount calculations
- **Referral Program**: 
  - Unique referral codes for each user
  - Wallet rewards for successful referrals (₹100 for referrer, ₹50 for new user)

### 💰 **Wallet System**
- **Digital Wallet**: Secure wallet with transaction history
- **Refund Processing**: Automatic refunds for cancellations and returns
- **Transaction Tracking**: Detailed transaction logs with pagination
- **Balance Management**: Real-time balance updates

### 📦 **Order Management**
- **Order Tracking**: Complete order lifecycle management
- **Cancellation System**: 
  - Full order cancellation
  - Individual item cancellation
  - Intelligent refund calculations
- **Return Management**:
  - Return request system
  - Admin approval workflow
  - Automated refund processing
- **Invoice Generation**: PDF invoice download functionality

### 🔧 **Admin Panel**
- **Dashboard Analytics**: 
  - Sales charts with multiple time filters
  - Best-selling products, categories, and authors
  - Revenue and order statistics
- **User Management**: User blocking/unblocking with search functionality
- **Product Management**: Complete CRUD operations with image upload
- **Order Management**: Order status updates and tracking
- **Return Processing**: Bulk return request handling
- **Sales Reports**: Excel and PDF export functionality

## 🛠 Tech Stack

### **Backend**
- **Runtime**: Node.js 18.x
- **Framework**: Express.js 4.x
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Express-session with secure configuration
- **File Upload**: Multer for image handling
- **Payment**: Razorpay integration
- **Email**: Nodemailer for OTP and notifications

### **Frontend**
- **Template Engine**: EJS (Embedded JavaScript)
- **Styling**: Bootstrap 5.x with custom CSS
- **Icons**: Bootstrap Icons & Remix Icons
- **Charts**: Chart.js for analytics
- **Notifications**: SweetAlert2 for user feedback

### **Security & Validation**
- **Password Hashing**: bcrypt
- **Input Validation**: Custom validation middleware
- **Session Security**: Secure session configuration
- **CSRF Protection**: Built-in security measures

## 🚀 Installation

### Prerequisites
- Node.js (v18.x or higher)
- MongoDB (v6.x or higher)
- npm or yarn package manager

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/kannan-innovates/chapterless.git
   cd chapterless
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   PORT=3001
   MONGODB_URI=mongodb://localhost:27017/chapterless
   SESSION_SECRET=your_session_secret_key
   
   # Razorpay Configuration
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   
   # Email Configuration
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Access the application**
   - User Interface: `http://localhost:3001`
   - Admin Panel: `http://localhost:3001/admin/adminLogin`

## ⚙️ Configuration

### **Database Setup**
The application uses MongoDB with the following collections:
- Users (with admin roles)
- Products (books with categories)
- Orders (with item-level tracking)
- Carts & Wishlists
- Coupons & Offers
- Wallets (with transaction history)
- Referrals

### **Admin Account**
Create an admin user in MongoDB:
```javascript
{
  fullName: "Admin User",
  email: "admin@chapterless.com",
  password: "hashed_password", // Use bcrypt
  isAdmin: true,
  isBlocked: false
}
```

## 📁 Project Structure

```
chapterless/
├── controllers/           # Business logic
│   ├── adminController/   # Admin panel controllers
│   └── userController/    # User-facing controllers
├── models/               # MongoDB schemas
├── routes/               # Express route definitions
│   ├── adminRoutes/      # Admin panel routes
│   └── userRoutes/       # User-facing routes
├── views/                # EJS templates
│   ├── admin/            # Admin panel views
│   ├── user/             # User interface views
│   └── partials/         # Reusable components
├── middlewares/          # Custom middleware
├── validators/           # Input validation
├── helpers/              # Utility functions
├── utils/                # Helper utilities
├── config/               # Configuration files
├── public/               # Static assets
│   ├── assets/           # Images and media
│   ├── styles/           # CSS files
│   └── js/               # Client-side JavaScript
└── app.js               # Application entry point
```

## 🔐 Security Features

- **Session Management**: Secure session configuration with httpOnly cookies
- **Password Security**: bcrypt hashing with salt rounds
- **Input Validation**: Comprehensive server-side validation
- **XSS Protection**: Input sanitization and output encoding
- **Authentication Middleware**: Route-level access control
- **Admin Protection**: Separate admin authentication system

## 📊 Key Metrics & Analytics

- **Dashboard Analytics**: Real-time sales and order statistics
- **Best Sellers**: Top 10 products, categories, and authors
- **Sales Reports**: Exportable reports in Excel and PDF formats
- **User Analytics**: User registration and activity tracking
- **Revenue Tracking**: Detailed financial reporting

## 🎯 Business Logic Highlights

### **Smart Pricing System**
- **Offer Integration**: Automatic application of best available offers
- **Coupon Stacking**: Intelligent coupon and offer combination
- **Tax Calculation**: 8% GST calculation on final amounts
- **COD Restrictions**: Orders above ₹1000 require online payment

### **Inventory Management**
- **Stock Tracking**: Real-time inventory updates
- **Product Variants**: Support for different book editions
- **Category Management**: Hierarchical category system
- **Image Management**: Multiple product images with optimization

### **Order Processing**
- **Multi-step Checkout**: Address → Payment → Confirmation
- **Payment Verification**: Razorpay signature validation
- **Order States**: Placed → Processing → Shipped → Delivered
- **Cancellation Logic**: Time-based cancellation rules

### **Refund System**
- **Intelligent Calculations**: Proportional refunds for partial cancellations
- **Payment Method Aware**: Different refund flows for COD vs Online payments
- **Wallet Integration**: Automatic wallet credits for eligible refunds
- **Tax Handling**: Proper tax refund calculations

## 🔧 Advanced Features

### **Email System**
- **OTP Verification**: 60-second expiry with resend functionality
- **Masked Email Display**: Privacy-focused email masking (abc***@example.com)
- **Order Notifications**: Automated order status updates
- **Welcome Emails**: New user onboarding

### **Session Management**
- **Secure Sessions**: httpOnly, secure cookie configuration
- **Auto-logout**: Session timeout handling
- **Multi-device Support**: Concurrent session management
- **Cache Control**: Proper browser cache headers

### **Data Export**
- **Excel Reports**: Comprehensive sales data in XLSX format
- **PDF Generation**: Professional invoice and report PDFs
- **Date Range Filtering**: Custom date range selections
- **Bulk Operations**: Mass data processing capabilities

## 🚀 Performance Optimizations

- **Database Indexing**: Optimized MongoDB queries
- **Image Optimization**: Compressed image storage
- **Pagination**: Efficient data loading with pagination
- **Caching**: Strategic caching for frequently accessed data
- **Lazy Loading**: On-demand content loading

## 🧪 Testing & Quality

- **Input Validation**: Comprehensive server-side validation
- **Error Handling**: Graceful error management
- **Logging**: Detailed application logging
- **Code Organization**: Modular, maintainable code structure

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support and queries:
- **GitHub Issues**: [Create an issue](https://github.com/kannan-innovates/chapterless/issues)
- **Email**: Contact through GitHub profile

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Bootstrap Team** for the excellent UI framework
- **MongoDB** for the robust database solution
- **Razorpay** for seamless payment integration
- **Node.js Community** for the amazing ecosystem

## 👨‍💻 Developer

**Kannan S** - [GitHub Profile](https://github.com/kannan-innovates)

*Always curious, always improving*

---

**⭐ If you found this project helpful, please give it a star!**

*Built with ❤️ for book lovers everywhere*
