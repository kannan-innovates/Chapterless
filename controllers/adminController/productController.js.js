const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const cloudinary = require('../../config/cloudinary');
const fs = require('fs');


// Get Products Page
const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // Define limit here
    const search = req.query.search || '';
    const categoryFilter = req.query.category || '';
    const sortBy = req.query.sort || 'newest';
    const skip = (page - 1) * limit;

    // Build query
    const query = { isListed: true }; // Only listed products
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
      ];
    }
    if (categoryFilter) {
      query.category = categoryFilter;
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sortBy === 'oldest') sortOption = { createdAt: 1 };
    else if (sortBy === 'price-low') sortOption = { salePrice: 1 };
    else if (sortBy === 'price-high') sortOption = { salePrice: -1 };
    else if (sortBy === 'stock-high') sortOption = { stock: -1 };

    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const categories = await Category.find({ isListed: true }); // For filter dropdown

    res.render('getProducts', {
      products,
      categories,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      search,
      categoryFilter,
      sortBy,
      limit, // Add limit to the render data
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Add Product
const addProduct = async (req, res) => {
  try {
    const {
      title,
      author,
      description,
      category,
      regularPrice,
      salePrice,
      stock,
      pages,
      language,
      publisher,
      publishedDate,
      isbn,
      isListed,
    } = req.body;

    // Validate category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Log file information for debugging
    console.log('Uploaded Files:', req.files);

    // Upload main image
    let mainImageUrl = '';
    if (req.files && req.files.mainImage && req.files.mainImage.length > 0) {
      const file = req.files.mainImage[0];
      if (!fs.existsSync(file.path)) {
        throw new Error(`Main image not found at ${file.path}`);
      }
      console.log(`Uploading main image from: ${file.path}`);
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'products',
      });
      mainImageUrl = result.secure_url;
      fs.unlinkSync(file.path); // Delete local file
    } else {
      return res.status(400).json({ error: 'Main image is required' });
    }

    // Upload sub images (up to 3)
    const subImages = [];
    const processedPaths = new Set(); // Track processed file paths to avoid duplicates
    if (req.files && req.files.subImages && req.files.subImages.length > 0) {
      for (const file of req.files.subImages) {
        console.log(`Processing sub image: ${file.path}, original name: ${file.originalname}`);
        if (processedPaths.has(file.path)) {
          console.log(`Skipping duplicate sub image path: ${file.path}`);
          continue;
        }
        if (!fs.existsSync(file.path)) {
          console.warn(`Sub image not found at ${file.path}, skipping...`);
          continue;
        }
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'products/sub',
        });
        subImages.push(result.secure_url);
        processedPaths.add(file.path); // Mark this path as processed
        fs.unlinkSync(file.path); // Delete local file
      }
    }

    const product = new Product({
      title,
      author,
      description,
      category,
      regularPrice: parseFloat(regularPrice),
      salePrice: parseFloat(salePrice),
      stock: parseInt(stock),
      pages: parseInt(pages),
      language,
      publisher,
      publishedDate: publishedDate ? new Date(publishedDate) : undefined,
      isbn,
      mainImage: mainImageUrl,
      subImages,
      isListed: isListed === 'on',
    });

    await product.save();
    res.status(201).json({ message: 'Product added successfully' });
  } catch (error) {
    console.error('Error adding product:', error);
    if (error.message.includes('ENOENT')) {
      res.status(500).json({ error: 'File upload failed: File not found on server' });
    } else if (error.name === 'TimeoutError') {
      res.status(500).json({ error: 'Upload timed out. Please try again with a smaller file or check your network.' });
    } else {
      res.status(500).json({ error: 'Server Error' });
    }
  }
};

// Toggle Product Status
const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    product.isListed = !product.isListed;
    await product.save();
    res.json({
      message: `Product ${product.isListed ? 'listed' : 'unlisted'} successfully`,
    });
  } catch (error) {
    console.error('Error toggling product status:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

module.exports = { getProducts, addProduct, toggleProductStatus };