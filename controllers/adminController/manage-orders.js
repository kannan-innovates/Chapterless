const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")

const getManageOrders = async (req, res) => {
  try {
    // Pagination parameters
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10 // Orders per page
    const skip = (page - 1) * limit

    // Build query
    const query = { isDeleted: false }

    // Handle Order Status filter
    const validStatuses = ["Placed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"]
    let status = req.query.status || ""
    if (status === "Pending") status = "Placed" // Map "Pending" to "Placed" as per schema
    if (status && validStatuses.includes(status)) {
      query.orderStatus = status
    }

    // Handle Payment Method filter
    const validPaymentMethods = ["COD", "UPI", "Card", "Wallet"]
    let payment = req.query.payment || ""
    if (payment === "CARD") payment = "Card" // Normalize for schema
    if (payment === "UPI") payment = "UPI" // Already matches schema
    if (payment && validPaymentMethods.includes(payment)) {
      query.paymentMethod = payment
    }

    // Handle Order Amount filter
    const minAmount = Number.parseFloat(req.query.min_amount) || 0
    const maxAmount = Number.parseFloat(req.query.max_amount) || Number.POSITIVE_INFINITY
    if (minAmount > 0 || maxAmount < Number.POSITIVE_INFINITY) {
      query.total = {}
      if (minAmount > 0) query.total.$gte = minAmount
      if (maxAmount < Number.POSITIVE_INFINITY) query.total.$lte = maxAmount
    }

    // Handle Order Date filter
    const startDate = req.query.start_date ? new Date(req.query.start_date) : null
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null
    if (startDate && !isNaN(startDate)) {
      query.createdAt = query.createdAt || {}
      query.createdAt.$gte = startDate
    }
    if (endDate && !isNaN(endDate)) {
      // Set endDate to the end of the day
      endDate.setHours(23, 59, 59, 999)
      query.createdAt = query.createdAt || {}
      query.createdAt.$lte = endDate
    }

    // Fetch total number of orders based on the query
    const totalOrders = await Order.countDocuments(query)

    // Fetch orders with pagination, populate user details, and apply filters
    const orders = await Order.find(query)
      .populate("user", "fullName") // Populate user to get customer name
      .sort({ createdAt: -1 }) // Sort by date, newest first
      .skip(skip)
      .limit(limit)
      .lean()

    // Calculate total pages
    const totalPages = Math.ceil(totalOrders / limit)

    // Format order data for display
    orders.forEach((order) => {
      order.formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
      order.formattedTotal = `₹${order.total.toFixed(2)}`
      order.customerName = order.user ? order.user.fullName : "Unknown"
    })

    // Pagination data
    const pagination = {
      currentPage: page,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      pages: Array.from({ length: totalPages }, (_, i) => i + 1),
    }

    // Prepare filter values to pre-select in the form
    const filters = {
      status: status || "",
      payment: payment || "",
      min_amount: req.query.min_amount || "",
      max_amount: req.query.max_amount || "",
      start_date: req.query.start_date || "",
      end_date: req.query.end_date || "",
    }

    // Render the manage-orders view
    res.render("manage-orders", {
      orders,
      pagination,
      title: "Manage Orders",
      filters, // Pass filter values for the form
    })
  } catch (error) {
    console.error("Error fetching orders:", error)
    res.status(500).render("error", { message: "Internal server error" })
  }
}

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id

    // Fetch the order and populate user details
    const order = await Order.findOne({
      _id: orderId,
      isDeleted: false,
    })
      .populate("user", "fullName email")
      .populate("items.product", "isbn author") // Populate product details for ISBN and author
      .lean()

    if (!order) {
      return res.status(404).render("error", {
        message: "Order not found",
      })
    }

    // Fetch customer data
    const customer = {
      fullName: order.user ? order.user.fullName : "Unknown",
      email: order.user ? order.user.email : "N/A",
    }

    // Format order data
    order.formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    order.formattedTotal = `₹${order.total.toFixed(2)}`
    order.formattedSubtotal = `₹${order.subtotal.toFixed(2)}`
    order.formattedTax = `₹${order.tax.toFixed(2)}`
    
    // Format discount values
    order.formattedDiscount = order.discount ? `₹${order.discount.toFixed(2)}` : "₹0.00"
    order.formattedCouponDiscount = order.couponDiscount ? `₹${order.couponDiscount.toFixed(2)}` : "₹0.00"

    // Format item data
    order.items.forEach((item) => {
      item.formattedPrice = `₹${item.price.toFixed(2)}`
      
      // Format discounted price if available
      if (item.discountedPrice) {
        item.formattedDiscountedPrice = `₹${item.discountedPrice.toFixed(2)}`
      }
      
      // Format offer discount if available
      if (item.offerDiscount) {
        item.formattedOfferDiscount = `₹${item.offerDiscount.toFixed(2)}`
      }
      
      // Ensure ISBN and author are available
      item.isbn = item.product ? item.product.isbn : "N/A"
      item.author = item.product ? item.product.author : "N/A"
    })

    // Create timeline based on order status using actual timestamps
    const timeline = [
      {
        status: "Placed",
        timestamp: new Date(order.createdAt).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        message: "Your order has been placed successfully.",
        completed: true,
      },
    ]

    // Only add Processing status if it's relevant
    if (["Processing", "Shipped", "Delivered", "Returned"].includes(order.orderStatus) || order.processedAt) {
      timeline.push({
        status: "Processing",
        timestamp: order.processedAt
          ? new Date(order.processedAt).toLocaleString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Pending",
        message: "Your order has been processed and is being prepared for shipping.",
        completed: ["Processing", "Shipped", "Delivered", "Returned"].includes(order.orderStatus) || order.processedAt,
      })
    }

    // Only add Shipped status if it's relevant
    if (["Shipped", "Delivered", "Returned"].includes(order.orderStatus) || order.shippedAt) {
      timeline.push({
        status: "Shipped",
        timestamp: order.shippedAt
          ? new Date(order.shippedAt).toLocaleString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Pending",
        message: order.trackingId
          ? `Your order has been shipped. Tracking ID: ${order.trackingId}`
          : "Your order has been shipped. Tracking information will be updated soon.",
        completed: ["Shipped", "Delivered", "Returned"].includes(order.orderStatus) || order.shippedAt,
      })
    }

    // Only add Delivered status if it's relevant
    if (["Delivered", "Returned"].includes(order.orderStatus) || order.deliveredAt) {
      timeline.push({
        status: "Delivered",
        timestamp: order.deliveredAt
          ? new Date(order.deliveredAt).toLocaleString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Pending",
        message: "Your order has been delivered.",
        completed: order.orderStatus === "Delivered" || order.orderStatus === "Returned" || order.deliveredAt,
      })
    }

    // Add Returned status if applicable
    if (order.orderStatus === "Returned" || order.returnedAt) {
      timeline.push({
        status: "Returned",
        timestamp: order.returnedAt
          ? new Date(order.returnedAt).toLocaleString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Pending",
        message: "The order has been returned.",
        completed: order.orderStatus === "Returned" || order.returnedAt,
      })
    }

    // Add Cancelled status if applicable
    if (order.orderStatus === "Cancelled" || order.cancelledAt) {
      timeline.push({
        status: "Cancelled",
        timestamp: order.cancelledAt
          ? new Date(order.cancelledAt).toLocaleString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Pending",
        message: "The order has been cancelled.",
        completed: order.orderStatus === "Cancelled" || order.cancelledAt,
      })
    }

    res.render("manage-order-details", {
      order,
      customer,
      timeline,
    })
  } catch (error) {
    console.error("Error in rendering order details:", error)
    res.status(500).render("error", { message: "Internal server error" })
  }
}

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id
    const { status } = req.body

    // Validate the new status
    const validStatuses = ["Placed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" })
    }

    // Fetch the order
    const order = await Order.findById(orderId)
    if (!order || order.isDeleted) {
      return res.status(404).json({ message: "Order not found" })
    }

    // Define allowed status transitions
    const statusTransitions = {
      Placed: ["Processing", "Cancelled"],
      Processing: ["Shipped", "Cancelled"],
      Shipped: ["Delivered"],
      Delivered: ["Returned"],
      Cancelled: [],
      Returned: [],
    }

    // Check if the transition is allowed
    const allowedStatuses = statusTransitions[order.orderStatus] || []
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: `Cannot update order status from ${order.orderStatus} to ${status}`,
      })
    }

    // Update the order status and set timestamps
    const now = new Date()
    order.orderStatus = status

    // Reset timestamps to null before setting the relevant one
    order.processedAt = null
    order.shippedAt = null
    order.deliveredAt = null
    order.cancelledAt = null
    order.returnedAt = null

    // Set the appropriate timestamp based on the new status
    if (status === "Processing") {
      order.processedAt = now
    } else if (status === "Shipped") {
      order.shippedAt = now
      // Ensure processedAt is set if not already (for consistency)
      if (!order.processedAt) {
        order.processedAt = order.createdAt
      }
    } else if (status === "Delivered") {
      order.deliveredAt = now
      // Ensure processedAt and shippedAt are set if not already
      if (!order.processedAt) {
        order.processedAt = order.createdAt
      }
      if (!order.shippedAt) {
        order.shippedAt = new Date(order.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000)
      }
      // For COD orders, update payment status to "Paid" upon delivery
      if (order.paymentMethod === "COD") {
        order.paymentStatus = "Paid"
      }
    } else if (status === "Cancelled") {
      order.cancelledAt = now
      // If order is cancelled, payment status should reflect as "Failed" for COD
      if (order.paymentMethod === "COD") {
        order.paymentStatus = "Failed"
      }
    } else if (status === "Returned") {
      order.returnedAt = now
      // For COD orders, if returned, payment status should be "Refunded" (assuming payment was collected)
      if (order.paymentMethod === "COD" && order.paymentStatus === "Paid") {
        order.paymentStatus = "Refunded"
      }
    }

    await order.save()

    res.status(200).json({ message: "Order status updated successfully" })
  } catch (error) {
    console.error("Error updating order status:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id

    // Fetch the order
    const order = await Order.findOne({
      _id: orderId,
      isDeleted: false,
    }).lean()

    if (!order) {
      return res.status(404).send("Order not found")
    }

    // Fetch user data
    const user = await User.findById(order.user, "fullName email").lean()
    if (!user) {
      return res.status(401).send("User not found")
    }

    // Format order data
    order.formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    order.formattedTotal = `₹${order.total.toFixed(2)}`
    order.formattedSubtotal = `₹${order.subtotal.toFixed(2)}`
    order.formattedTax = `₹${order.tax.toFixed(2)}`
    order.formattedDiscount = order.discount ? `₹${order.discount.toFixed(2)}` : "₹0.00"
    order.formattedCouponDiscount = order.couponDiscount ? `₹${order.couponDiscount.toFixed(2)}` : "₹0.00"

    order.items.forEach((item) => {
      item.formattedPrice = `₹${item.price.toFixed(2)}`
      item.formattedDiscountedPrice = item.discountedPrice ? `₹${item.discountedPrice.toFixed(2)}` : item.formattedPrice
      item.formattedOfferDiscount = item.offerDiscount ? `₹${item.offerDiscount.toFixed(2)}` : "₹0.00"
    })

    // Create PDF with proper margins
    const PDFDocument = require("pdfkit")
    const path = require("path")
    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
    })

    const filename = `invoice-${order.orderNumber}.pdf`

    // Set response headers
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

    // Pipe PDF to response
    doc.pipe(res)

    // Calculate page dimensions with margins
    const pageWidth = doc.page.width
    const pageHeight = doc.page.height
    const borderX = 50 // Starting x (margin)
    const borderY = 50 // Starting y (margin)
    const borderWidth = pageWidth - 100 // Width minus left and right margins
    const borderHeight = pageHeight - 100 // Height minus top and bottom margins

    // Draw invoice-box border
    doc.roundedRect(borderX, borderY, borderWidth, borderHeight, 10).lineWidth(1).strokeColor("#ddd").stroke()

    // Content padding inside the border
    const contentX = borderX + 30
    const contentY = borderY + 30
    const contentWidth = borderWidth - 60

    // Add logo
    const logoPath = path.join(__dirname, "../../public/assets/harryPotter.jpeg")
    doc.image(logoPath, contentX, contentY, { width: 55 })

    // Brand and slogan
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .fillColor("#212529")
      .text("Chapterless", contentX + 65, contentY)
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#6c757d")
      .text("WHERE STORIES FIND LOST SOULS", contentX + 65, contentY + 30, { uppercase: true })

    // Invoice header (right-aligned)
    const headerX = contentX + contentWidth - 150
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#333")
    doc.text(`Invoice #: ${order.orderNumber}`, headerX, contentY, { width: 150, align: "right" })
    doc.text(`Date: ${order.formattedDate}`, headerX, contentY + 15, { width: 150, align: "right" })

    // Billing details
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Billing To:", contentX, contentY + 80)
    doc.fontSize(12).font("Helvetica")

    // Calculate y position for billing info
    let billingY = contentY + 105

    doc.font("Helvetica-Bold").text(order.shippingAddress.fullName || "N/A", contentX, billingY)
    billingY += 15

    doc.font("Helvetica")
    doc.text(order.shippingAddress.street || "", contentX, billingY)
    billingY += 15

    if (order.shippingAddress.landmark) {
      doc.text(order.shippingAddress.landmark, contentX, billingY)
      billingY += 15
    }

    doc.text(
      `${order.shippingAddress.district || ""}, ${order.shippingAddress.state || ""} ${order.shippingAddress.pincode || ""}`,
      contentX,
      billingY,
    )
    billingY += 15

    doc.text("India", contentX, billingY)
    billingY += 15

    doc.text(user.email || "", contentX, billingY)
    billingY += 30 // Extra space before order details

    // Order items table
    doc.fontSize(14).font("Helvetica-Bold").text("Order Details:", contentX, billingY)
    billingY += 25

    // Table dimensions
    const tableTop = billingY

    // Column widths
    const colBook = contentX // Book column start
    const colBookWidth = contentWidth * 0.45 // 45% of content width

    const colPrice = colBook + colBookWidth // Price column start
    const colPriceWidth = contentWidth * 0.15 // 15% of content width

    const colQty = colPrice + colPriceWidth // Qty column start
    const colQtyWidth = contentWidth * 0.15 // 15% of content width

    const colSubtotal = colQty + colQtyWidth // Subtotal column start
    const colSubtotalWidth = contentWidth * 0.25 // 25% of content width

    const rowHeight = 30
    const headerHeight = 30

    // Table header background
    doc.rect(colBook, tableTop, contentWidth, headerHeight).fillColor("#f8f9fa").fill()

    // Table headers
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#333")
    doc.text("Book", colBook + 5, tableTop + 10, { width: colBookWidth - 10 })
    doc.text("Price", colPrice + 5, tableTop + 10, { width: colPriceWidth - 10, align: "center" })
    doc.text("Qty", colQty + 5, tableTop + 10, { width: colQtyWidth - 10, align: "center" })
    doc.text("Subtotal", colSubtotal + 5, tableTop + 10, { width: colSubtotalWidth - 10, align: "right" })

    // Table rows
    doc.fontSize(12).font("Helvetica")
    let y = tableTop + headerHeight

    order.items.forEach((item, index) => {
      doc.fillColor("#333")

      // Book title with offer info if applicable
      if (item.offerTitle) {
        doc
          .font("Helvetica-Bold")
          .text(item.title || "Unknown Product", colBook + 5, y + 5, { width: colBookWidth - 10 })
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#d63031")
          .text(item.offerTitle, colBook + 5, y + 20, { width: colBookWidth - 10 })
        doc.fontSize(12).fillColor("#333")
      } else {
        doc.text(item.title || "Unknown Product", colBook + 5, y + 10, { width: colBookWidth - 10 })
      }

      // Price with original and discounted if applicable
      if (item.discountedPrice && item.discountedPrice < item.price) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#666")
          .text(item.formattedPrice, colPrice + 5, y + 5, { width: colPriceWidth - 10, align: "center", strike: true })
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor("#28a745")
          .text(item.formattedDiscountedPrice, colPrice + 5, y + 18, { width: colPriceWidth - 10, align: "center" })
      } else {
        doc.text(item.formattedPrice, colPrice + 5, y + 10, { width: colPriceWidth - 10, align: "center" })
      }

      // Quantity
      doc.fillColor("#333").font("Helvetica")
      doc.text(item.quantity.toString() || "1", colQty + 5, y + 10, { width: colQtyWidth - 10, align: "center" })

      // Subtotal
      const itemTotal = item.discountedPrice ? item.discountedPrice * item.quantity : item.price * item.quantity
      doc.text(`₹${itemTotal.toFixed(2)}`, colSubtotal + 5, y + 10, {
        width: colSubtotalWidth - 10,
        align: "right",
      })

      y += rowHeight
    })

    // Summary rows
    const summaryStartY = y
    const summaryLabelX = colQty - 20
    const summaryValueX = colSubtotal

    // Subtotal row
    doc.text("Subtotal", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
    doc.text(order.formattedSubtotal, summaryValueX + 5, y + 10, { width: colSubtotalWidth - 10, align: "right" })
    y += rowHeight

    // Offer Discount row (if applicable)
    if (order.discount && order.discount > 0) {
      doc.text("Offer Discount", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
      doc.fillColor("#28a745").text(`-${order.formattedDiscount}`, summaryValueX + 5, y + 10, {
        width: colSubtotalWidth - 10,
        align: "right",
      })
      doc.fillColor("#333")
      y += rowHeight
    }

    // Coupon Discount row (if applicable)
    if (order.couponDiscount && order.couponDiscount > 0) {
      doc.text("Coupon Discount", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
      doc.fillColor("#28a745").text(`-${order.formattedCouponDiscount}`, summaryValueX + 5, y + 10, {
        width: colSubtotalWidth - 10,
        align: "right",
      })
      if (order.couponCode) {
        doc
          .fillColor("#666")
          .fontSize(9)
          .text(`(Code: ${order.couponCode})`, summaryLabelX - 80, y + 10, { width: colQtyWidth + 20, align: "right" })
      }
      doc.fillColor("#333").fontSize(12)
      y += rowHeight
    }

    // Tax row
    doc.text("Tax", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
    doc.text(order.formattedTax, summaryValueX + 5, y + 10, { width: colSubtotalWidth - 10, align: "right" })
    y += rowHeight

    // Total row (with larger font)
    doc.font("Helvetica-Bold").fontSize(16)
    doc.text("Total", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
    doc.text(order.formattedTotal, summaryValueX + 5, y + 10, { width: colSubtotalWidth - 10, align: "right" })
    y += rowHeight

    // Payment method row
    doc.font("Helvetica").fontSize(12)
    doc.text("Payment Method", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
    doc.text(order.paymentMethod || "Cash on Delivery", summaryValueX + 5, y + 10, {
      width: colSubtotalWidth - 10,
      align: "right",
    })

    // Draw table borders
    const totalTableHeight = y + rowHeight - tableTop

    // Outer border for the entire table
    doc.rect(colBook, tableTop, contentWidth, totalTableHeight).lineWidth(1).strokeColor("#ddd").stroke()

    // Column dividers
    const colDividers = [colPrice, colQty, colSubtotal, colBook + contentWidth]
    colDividers.forEach((x) => {
      doc
        .moveTo(x, tableTop)
        .lineTo(x, tableTop + totalTableHeight)
        .stroke()
    })

    // Row dividers (header and items)
    let rowY = tableTop + headerHeight
    doc
      .moveTo(colBook, rowY)
      .lineTo(colBook + contentWidth, rowY)
      .stroke()

    order.items.forEach((_, i) => {
      rowY += rowHeight
      doc
        .moveTo(colBook, rowY)
        .lineTo(colBook + contentWidth, rowY)
        .stroke()
    })

    // Summary section divider
    doc
      .moveTo(colBook, summaryStartY)
      .lineTo(colBook + contentWidth, summaryStartY)
      .stroke()

    // Footer
    const footerY = y + rowHeight + 50
    doc
      .fontSize(12)
      .fillColor("#666")
      .text("This is a computer-generated invoice and does not require a signature.", contentX, footerY, {
        align: "center",
        width: contentWidth,
      })

    doc.text("Thank you for shopping at Chapterless", contentX, footerY + 20, { align: "center", width: contentWidth })

    // Finalize PDF
    doc.end()
  } catch (error) {
    console.error("Error generating invoice:", error)
    res.status(500).send("Internal server error")
  }
}

module.exports = { getManageOrders, getOrderDetails, updateOrderStatus, downloadInvoice }