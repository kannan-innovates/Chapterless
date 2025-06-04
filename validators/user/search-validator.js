const { HttpStatus } = require('../../helpers/status-code');
const { sanitizeInput } = require('../../helpers/validation-helper');

/**
 * Validate search query parameters
 */
const validateSearchQuery = (req, res, next) => {
  try {
    const { 
      q, 
      category, 
      brand, 
      minPrice, 
      maxPrice, 
      sortBy, 
      sortOrder, 
      page, 
      limit,
      inStock 
    } = req.query;
    
    const sanitizedQuery = {};
    const errors = [];
    
    // Validate search term
    if (q) {
      const sanitizedQ = sanitizeInput(q);
      if (sanitizedQ.length < 2) {
        errors.push('Search term must be at least 2 characters');
      } else if (sanitizedQ.length > 100) {
        errors.push('Search term must not exceed 100 characters');
      } else {
        sanitizedQuery.q = sanitizedQ;
      }
    }
    
    // Validate category
    if (category) {
      const sanitizedCategory = sanitizeInput(category);
      if (sanitizedCategory.length > 50) {
        errors.push('Category name too long');
      } else {
        sanitizedQuery.category = sanitizedCategory;
      }
    }
    
    // Validate brand
    if (brand) {
      const sanitizedBrand = sanitizeInput(brand);
      if (sanitizedBrand.length > 50) {
        errors.push('Brand name too long');
      } else {
        sanitizedQuery.brand = sanitizedBrand;
      }
    }
    
    // Validate price range
    if (minPrice) {
      const minPriceNum = parseFloat(minPrice);
      if (isNaN(minPriceNum) || minPriceNum < 0) {
        errors.push('Invalid minimum price');
      } else if (minPriceNum > 100000) {
        errors.push('Minimum price too high');
      } else {
        sanitizedQuery.minPrice = minPriceNum;
      }
    }
    
    if (maxPrice) {
      const maxPriceNum = parseFloat(maxPrice);
      if (isNaN(maxPriceNum) || maxPriceNum < 0) {
        errors.push('Invalid maximum price');
      } else if (maxPriceNum > 100000) {
        errors.push('Maximum price too high');
      } else {
        sanitizedQuery.maxPrice = maxPriceNum;
      }
    }
    
    // Validate price range logic
    if (sanitizedQuery.minPrice && sanitizedQuery.maxPrice) {
      if (sanitizedQuery.minPrice > sanitizedQuery.maxPrice) {
        errors.push('Minimum price cannot be greater than maximum price');
      }
    }
    
    // Validate sort parameters
    if (sortBy) {
      const validSortFields = ['title', 'price', 'createdAt', 'popularity', 'rating'];
      if (!validSortFields.includes(sortBy)) {
        errors.push('Invalid sort field');
      } else {
        sanitizedQuery.sortBy = sortBy;
      }
    }
    
    if (sortOrder) {
      const validSortOrders = ['asc', 'desc'];
      if (!validSortOrders.includes(sortOrder.toLowerCase())) {
        errors.push('Invalid sort order');
      } else {
        sanitizedQuery.sortOrder = sortOrder.toLowerCase();
      }
    }
    
    // Validate pagination
    if (page) {
      const pageNum = parseInt(page);
      if (isNaN(pageNum) || pageNum < 1) {
        errors.push('Invalid page number');
      } else if (pageNum > 1000) {
        errors.push('Page number too high');
      } else {
        sanitizedQuery.page = pageNum;
      }
    }
    
    if (limit) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1) {
        errors.push('Invalid limit');
      } else if (limitNum > 100) {
        errors.push('Limit too high (maximum 100)');
      } else {
        sanitizedQuery.limit = limitNum;
      }
    }
    
    // Validate stock filter
    if (inStock !== undefined) {
      const inStockBool = inStock === 'true' || inStock === '1';
      sanitizedQuery.inStock = inStockBool;
    }
    
    if (errors.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Invalid search parameters',
        errors: errors
      });
    }
    
    req.validatedQuery = sanitizedQuery;
    next();
  } catch (error) {
    console.error('Search validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate search suggestions request
 */
const validateSearchSuggestions = (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Search term is required'
      });
    }
    
    const sanitizedQ = sanitizeInput(q);
    
    if (sanitizedQ.length < 2) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Search term must be at least 2 characters'
      });
    }
    
    if (sanitizedQ.length > 50) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Search term too long'
      });
    }
    
    req.validatedQuery = { q: sanitizedQ };
    next();
  } catch (error) {
    console.error('Search suggestions validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate filter options request
 */
const validateFilterOptions = (req, res, next) => {
  try {
    const { category } = req.query;
    const sanitizedQuery = {};
    
    if (category) {
      const sanitizedCategory = sanitizeInput(category);
      if (sanitizedCategory.length > 50) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Category name too long'
        });
      }
      sanitizedQuery.category = sanitizedCategory;
    }
    
    req.validatedQuery = sanitizedQuery;
    next();
  } catch (error) {
    console.error('Filter options validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate product details request
 */
const validateProductDetails = (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    
    // Validate MongoDB ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }
    
    req.validatedParams = { id };
    next();
  } catch (error) {
    console.error('Product details validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  validateSearchQuery,
  validateSearchSuggestions,
  validateFilterOptions,
  validateProductDetails
};
