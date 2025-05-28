const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const { getActiveOfferForProduct, calculateDiscount } = require('../../utils/offer-helper');

const shopPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    let query = { isListed: true, isDeleted: false };

    const categoryId = req.query.category;
    if (categoryId) {
      if (Array.isArray(categoryId)) {
        query.category = { $in: categoryId };
      } else {
        query.category = categoryId;
      }
    }

    const minPrice = parseInt(req.query.minPrice) || 0;
    const maxPrice = parseInt(req.query.maxPrice) || 5000;

    const sortOption = req.query.sort || 'recommended';
    let sortQuery = {};

    switch (sortOption) {
      case 'price-asc':
        sortQuery = { finalPrice: 1 };
        break;
      case 'price-desc':
        sortQuery = { finalPrice: -1 };
        break;
      case 'date-desc':
        sortQuery = { createdAt: -1 };
        break;
      case 'stock-desc':
        sortQuery = { stock: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
        break;
    }

    const products = await Product.find(query)
      .populate('category')
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    // Calculate finalPrice and apply offers
    for (const product of products) {
      const offer = await getActiveOfferForProduct(product._id, product.category._id, product.regularPrice);
      console.log(`Processing offers for product ${product.title}:`, {
        productId: product._id,
        categoryId: product.category._id,
        regularPrice: product.regularPrice,
        hasOffer: !!offer
      });

      const { discountPercentage, discountAmount, finalPrice } = calculateDiscount(offer, product.regularPrice);
      console.log('Calculated discount:', {
        discountPercentage,
        discountAmount,
        finalPrice,
        offerTitle: offer?.title
      });

      product.activeOffer = offer;
      product.discountPercentage = discountPercentage;
      product.discountAmount = discountAmount;
      product.finalPrice = finalPrice || product.salePrice; // Fallback to salePrice if no offer

    }

    // Apply price filter using finalPrice
    const filteredProducts = products.filter(product =>
      product.finalPrice >= minPrice && product.finalPrice <= maxPrice
    );

    const totalProducts = filteredProducts.length;
    const totalPages = Math.ceil(totalProducts / limit);

    const paginationData = {
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      lastPage: totalPages,
      pages: generatePaginationArray(page, totalPages)
    };

    const categories = await Category.find({ isListed: true });

    let queryParams = new URLSearchParams();

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
      products: filteredProducts,
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

function generatePaginationArray(currentPage, totalPages) {
  let pages = [];

  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (currentPage <= 3) {
    endPage = Math.min(5, totalPages);
  } else if (currentPage >= totalPages - 2) {
    startPage = Math.max(1, totalPages - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return pages;
}

module.exports = { shopPage };