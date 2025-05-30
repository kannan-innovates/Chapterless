
const globalErrorHandler = (err, req, res, next) => {
  // Log error for debugging
  console.error('Error occurred:', {
    message: err.message,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = 500;
  let message = 'Something went wrong. Please try again.';

  // Handle common error types
  if (err.name === 'ValidationError') {
    // Mongoose validation errors
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  } else if (err.code === 11000) {
    // Duplicate key error
    statusCode = 409;
    const field = Object.keys(err.keyPattern)[0];
    message = `${field} already exists`;
  } else if (err.name === 'CastError') {
    // Invalid ObjectId
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Return JSON for AJAX requests, otherwise render error page
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    return res.status(statusCode).json({
      success: false,
      message: message
    });
  } else {
    return res.status(statusCode).render('page-404', {
      title: 'Error',
      message: message
    });
  }
};


const notFoundHandler = (req, res, next) => {
  console.warn('404 Not Found:', req.originalUrl);

  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  } else {
    return res.status(404).render('page-404', {
      title: 'Page Not Found',
      message: 'The page you are looking for does not exist.'
    });
  }
};

module.exports = {
  globalErrorHandler,
  notFoundHandler
};
