const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const cloudinary = require('../../config/cloudinary');
const fs = require('fs');
const { HttpStatus } = require('../../helpers/status-code');

// Get Products Page
// Updated getProducts function to show all products in admin panel
const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const categoryFilter = req.query.category || '';
    const sortBy = req.query.sort || 'newest';
    const skip = (page - 1) * limit;

    // Changed query to include all products for admin panel
    // This should include both listed and unlisted products
    const query = { isDeleted: false }; // Only exclude permanently deleted products

    // Add search filters if provided
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
      ];
    }

    // Add category filter if provided
    if (categoryFilter) {
      query.category = categoryFilter;
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sortBy === 'oldest') sortOption = { createdAt: 1 };
    else if (sortBy === 'price-low') sortOption = { salePrice: 1 };
    else if (sortBy === 'price-high') sortOption = { salePrice: -1 };
    else if (sortBy === 'stock-high') sortOption = { stock: -1 };

    // Count and fetch products
    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    // Fetch all categories for filter dropdown
    const categories = await Category.find({ isListed: true });

    res.render('getProducts', {
      products,
      categories,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      search,
      categoryFilter,
      sortBy,
      limit,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal Server Error' });
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
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Invalid category' });
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
        quality: 'auto:best',
        fetch_format: 'auto',
        flags: 'preserve_transparency'
      });
      mainImageUrl = result.secure_url;
      fs.unlinkSync(file.path); // Delete local file
    } else {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Main image is required' });
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
          quality: 'auto:best',
          fetch_format: 'auto',
          flags: 'preserve_transparency'
        });
        subImages.push(result.secure_url);
        processedPaths.add(file.path); // Mark this path as processed
        fs.unlinkSync(file.path); // Delete local file
      }
    }



    const product = new Product({
      title: title.trim(),
      author: author.trim(),
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
      isDeleted: false,
    });

    await product.save();
    res.status(HttpStatus.CREATED).json({ message: 'Product added successfully' });
  } catch (error) {
    console.error('Error adding product:', error);
    if (error.message.includes('ENOENT')) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'File upload failed: File not found on server' });
    } else if (error.name === 'TimeoutError') {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Upload timed out. Please try again with a smaller file or check your network.' });
    } else {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Server Error' });
    }
  }
};

// Toggle Product Status
const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Product not found' });
    }

    product.isListed = !product.isListed;
    await product.save();
    res.json({
      message: `Product ${product.isListed ? 'listed' : 'unlisted'} successfully`,
    });
  } catch (error) {
    console.error('Error toggling product status:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Server Error' });
  }
};

// Get Edit Product Page
const getEditProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).populate('category');
    const categories = await Category.find({ isListed: true });

    if (!product || product.isDeleted) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Product not found' });
    }

    res.render('editProduct', { product, categories });
  } catch (error) {
    console.error('Error fetching product for edit:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Server Error' });
  }
};

// Update Product
const updateProduct = async (req, res) => {
  console.log('Update request received for productId:', req.params.id);
  try {
    const productId = req.params.id;
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

    console.log('Request body:', req.body);
    console.log('Uploaded files:', req.files);

    const product = await Product.findById(productId);
    console.log('Product found:', product);
    if (!product || product.isDeleted) {
      console.log('Product not found or deleted');
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Product not found' });
    }

    const categoryExists = await Category.findById(category);
    console.log('Category exists:', categoryExists);
    if (!categoryExists) {
      console.log('Invalid category');
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Invalid category' });
    }

    let mainImageUrl = product.mainImage;
    if (req.files && req.files.mainImage && req.files.mainImage.length > 0) {
      const file = req.files.mainImage[0];
      console.log('Uploading main image from:', file.path);
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'products',
        quality: 'auto:best',
        fetch_format: 'auto',
        flags: 'preserve_transparency'
      });
      mainImageUrl = result.secure_url;
      fs.unlinkSync(file.path);
      if (product.mainImage) {
        const publicId = product.mainImage.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`products/${publicId}`);
      }
    }

    const subImages = product.subImages || [];
    const processedPaths = new Set();
    if (req.files && req.files.subImages && req.files.subImages.length > 0) {
      for (const file of req.files.subImages) {
        console.log('Processing sub image:', file.path);
        if (processedPaths.has(file.path)) continue;
        if (!fs.existsSync(file.path)) {
          console.warn('Sub image not found:', file.path);
          continue;
        }
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'products/sub',
          quality: 'auto:best',
          fetch_format: 'auto',
          flags: 'preserve_transparency'
        });
        subImages.push(result.secure_url);
        processedPaths.add(file.path);
        fs.unlinkSync(file.path);
      }
    }

    product.title = title;
    product.author = author;
    product.description = description;
    product.category = category;
    product.regularPrice = parseFloat(regularPrice);
    product.salePrice = parseFloat(salePrice);
    product.stock = parseInt(stock);
    product.pages = parseInt(pages);
    product.language = language;
    product.publisher = publisher;
    product.publishedDate = publishedDate ? new Date(publishedDate) : undefined;
    product.isbn = isbn;
    product.mainImage = mainImageUrl;
    product.subImages = subImages;
    product.isListed = isListed === 'on';

    await product.save();
    console.log('Product updated:', product._id);
    res.status(HttpStatus.OK).json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    if (error.message.includes('ENOENT')) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'File upload failed: File not found on server' });
    } else {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Server Error' });
    }
  }
};
// Soft Delete Product
const softDeleteProduct = async (req, res) => {
  console.log('Soft delete request received for productId:', req.params.id);
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    console.log('Product found:', product);
    if (!product) {
      console.log('Product not found');
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Product not found' });
    }

    product.isDeleted = true;
    await product.save();
    console.log('Product soft deleted:', product._id);
    res.status(HttpStatus.OK).json({ message: 'Product soft deleted successfully' });
  } catch (error) {
    console.error('Error soft deleting product:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Server Error' });
  }
};

module.exports = { getProducts, addProduct, toggleProductStatus, getEditProduct, updateProduct, softDeleteProduct };