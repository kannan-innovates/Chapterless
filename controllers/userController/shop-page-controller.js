const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

const shopPage = async (req, res) => {
  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Build the query with all filters
    let query = { isListed: true };

    // Category filter
    const categoryId = req.query.category;
    if (categoryId) {
      if (Array.isArray(categoryId)) {
        query.category = { $in: categoryId };
      } else {
        query.category = categoryId;
      }
    }

    // Price range filter
    const minPrice = parseInt(req.query.minPrice) || 0;
    const maxPrice = parseInt(req.query.maxPrice) || 5000;
    query.salePrice = { $gte: minPrice, $lte: maxPrice };

    // Get sort option
    const sortOption = req.query.sort || 'recommended';
    let sortQuery = {};
    
    switch (sortOption) {
      case 'price-asc':
        sortQuery = { salePrice: 1 };
        break;
      case 'price-desc':
        sortQuery = { salePrice: -1 };
        break;
      case 'date-desc':
        sortQuery = { createdAt: -1 };
        break;
      case 'stock-desc':
        sortQuery = { stock: -1 };
        break;
      default:
        // For 'recommended', we could use a combination or default sort
        sortQuery = { createdAt: -1 }; // Default to newest first
        break;
    }

    // Count total products matching the query for pagination
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Get products for current page
    const products = await Product.find(query)
      .populate('category')
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    // Get all categories
    const categories = await Category.find({ isListed: true });

    // Build pagination data for the view
    const paginationData = {
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      lastPage: totalPages,
      // Create an array of page numbers to show
      pages: generatePaginationArray(page, totalPages)
    };

    // Create the query string for maintaining filters in pagination links
    let queryParams = new URLSearchParams();
    
    // Add all current query parameters except page
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'page') {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v));
        } else {
          queryParams.set(key, value);
        }
      }
    }
    
    const baseQueryString = queryParams.toString();

    res.render('shop-page', {
      products,
      categories,
      pagination: paginationData,
      currentPage: page,
      totalPages,
      totalProducts,
      categoryId,
      minPrice,
      maxPrice,
      sortOption,
      queryString: baseQueryString ? `&${baseQueryString}` : ''
    });
  } catch (error) {
    console.log(`Error in rendering Shop Page: ${error}`);
    res.status(500).send("Server Error");
  }
};

// Helper function to generate pagination array
function generatePaginationArray(currentPage, totalPages) {
  let pages = [];
  
  // Logic to determine which page numbers to show
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);
  
  // Adjust if we're near the beginning or end
  if (currentPage <= 3) {
    endPage = Math.min(5, totalPages);
  } else if (currentPage >= totalPages - 2) {
    startPage = Math.max(1, totalPages - 4);
  }
  
  // Generate the array of page numbers
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  return pages;
}

module.exports = { shopPage };