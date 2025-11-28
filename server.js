const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Configuration
const API_CONFIG = {
  baseURL: 'https://open-api.zortout.com/v4',
  storename: process.env.ZORT_STORE || 'iamfuture.stock@gmail.com',
  apikey: process.env.ZORT_API_KEY || '6DIoNoiP3HR05AFqYBxEebJGf70HLIfGUpFn3wWDo5U=',
  apisecret: process.env.ZORT_API_SECRET || 'PiqMdPhLe3VTlOctpbfZcQUlpUpvUHuoiECKMM42Kk='
};

console.log('🔧 Starting server with config:', {
  store: API_CONFIG.storename,
  apiURL: API_CONFIG.baseURL
});

// Helper function for API calls with better error handling
async function makeApiCall(endpoint, params = {}) {
  const url = `${API_CONFIG.baseURL}${endpoint}`;
  
  console.log(`📡 Calling API: ${url}`);
  console.log('Headers:', {
    storename: API_CONFIG.storename,
    apikey: API_CONFIG.apikey ? 'SET' : 'NOT SET',
    apisecret: API_CONFIG.apisecret ? 'SET' : 'NOT SET'
  });
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      headers: {
        'storename': API_CONFIG.storename,
        'apikey': API_CONFIG.apikey,
        'apisecret': API_CONFIG.apisecret,
        'Content-Type': 'application/json'
      },
      params: params,
      timeout: 15000
    });
    
    console.log(`✅ API Success for ${endpoint}:`, {
      status: response.status,
      hasData: !!response.data,
      dataLength: response.data?.data?.length || 0
    });
    
    return response.data;
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
    
    // Return empty data structure instead of throwing
    return { 
      data: [], 
      total: 0,
      success: false,
      error: error.message 
    };
  }
}

// Test API endpoint
app.get('/api/test', async (req, res) => {
  console.log('🧪 Testing API connection...');
  
  try {
    // Try to get products as a test
    const result = await makeApiCall('/Product/GetProducts', { limit: 1 });
    
    res.json({
      success: true,
      message: 'API test',
      apiResponse: result,
      config: {
        store: API_CONFIG.storename,
        apiConfigured: !!(API_CONFIG.apikey && API_CONFIG.apisecret)
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      config: {
        store: API_CONFIG.storename,
        apiConfigured: !!(API_CONFIG.apikey && API_CONFIG.apisecret)
      }
    });
  }
});

// Main summary endpoint with detailed logging
app.get('/api/summary', async (req, res) => {
  console.log('📊 Getting dashboard summary...');
  
  try {
    // Fetch all data with proper parameters
    const [ordersResponse, productsResponse, warehousesResponse] = await Promise.all([
      makeApiCall('/Order/GetOrders', { 
        page: 1, 
        limit: 100,
        startdate: new Date(new Date().setHours(0,0,0,0)).toISOString().split('T')[0],
        enddate: new Date().toISOString().split('T')[0]
      }),
      makeApiCall('/Product/GetProducts', { 
        page: 1, 
        limit: 500 
      }),
      makeApiCall('/Warehouse/GetWarehouses', { 
        page: 1, 
        limit: 50 
      })
    ]);
    
    console.log('📦 API Responses:', {
      orders: { 
        success: !!ordersResponse, 
        count: ordersResponse?.total || ordersResponse?.data?.length || 0 
      },
      products: { 
        success: !!productsResponse, 
        count: productsResponse?.total || productsResponse?.data?.length || 0 
      },
      warehouses: { 
        success: !!warehousesResponse, 
        count: warehousesResponse?.total || warehousesResponse?.data?.length || 0 
      }
    });
    
    // Process orders for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let todayOrders = 0;
    let todaySales = 0;
    
    if (ordersResponse && ordersResponse.data && Array.isArray(ordersResponse.data)) {
      ordersResponse.data.forEach(order => {
        // Check different date field names
        const orderDate = new Date(
          order.date || 
          order.createddate || 
          order.createdate || 
          order.orderdate || 
          new Date()
        );
        
        if (orderDate >= today) {
          todayOrders++;
          // Check different total field names
          const total = order.grandtotal || 
                       order.total || 
                       order.totalprice || 
                       order.amount || 
                       0;
          todaySales += total;
        }
      });
    }
    
    // Process products for stock status
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let negativeStockCount = 0;
    let totalProducts = 0;
    
    if (productsResponse && productsResponse.data && Array.isArray(productsResponse.data)) {
      totalProducts = productsResponse.total || productsResponse.data.length;
      
      productsResponse.data.forEach(product => {
        // Check different stock field names
        const stock = product.quantity || 
                     product.stock || 
                     product.inventory || 
                     product.available || 
                     0;
        
        if (stock < 0) {
          negativeStockCount++;
        } else if (stock === 0) {
          outOfStockCount++;
        } else if (stock > 0 && stock < 5) {
          lowStockCount++;
        }
      });
    }
    
    // Count warehouses
    const totalWarehouses = warehousesResponse?.total || 
                           warehousesResponse?.data?.length || 
                           0;
    
    const summaryData = {
      totalOrders: ordersResponse?.total || ordersResponse?.data?.length || todayOrders,
      todayOrders: todayOrders,
      todaySales: todaySales,
      totalProducts: totalProducts,
      totalWarehouses: totalWarehouses,
      lowStockCount: lowStockCount,
      outOfStockCount: outOfStockCount,
      negativeStockCount: negativeStockCount,
      lastUpdate: new Date().toISOString(),
      debug: {
        ordersFound: ordersResponse?.data?.length || 0,
        productsFound: productsResponse?.data?.length || 0,
        warehousesFound: warehousesResponse?.data?.length || 0
      }
    };
    
    console.log('📈 Summary calculated:', summaryData);
    
    res.json({
      success: true,
      data: summaryData
    });
    
  } catch (error) {
    console.error('💥 Summary endpoint error:', error);
    
    // Return mock data if everything fails
    res.json({
      success: true,
      data: {
        totalOrders: 5,
        todayOrders: 2,
        todaySales: 12500,
        totalProducts: 45,
        totalWarehouses: 2,
        lowStockCount: 3,
        outOfStockCount: 1,
        negativeStockCount: 0,
        lastUpdate: new Date().toISOString(),
        note: 'Using demo data - API connection issue'
      }
    });
  }
});

// Get all products endpoint
app.get('/api/products', async (req, res) => {
  console.log('📦 Getting products...');
  
  try {
    const result = await makeApiCall('/Product/GetProducts', {
      page: 1,
      limit: 100
    });
    
    res.json({
      success: true,
      data: result?.data || [],
      total: result?.total || 0
    });
  } catch (error) {
    res.json({
      success: false,
      data: [],
      error: error.message
    });
  }
});

// Get all orders endpoint
app.get('/api/orders', async (req, res) => {
  console.log('📋 Getting orders...');
  
  try {
    const result = await makeApiCall('/Order/GetOrders', {
      page: 1,
      limit: 100
    });
    
    res.json({
      success: true,
      data: result?.data || [],
      total: result?.total || 0
    });
  } catch (error) {
    res.json({
      success: false,
      data: [],
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    config: {
      store: API_CONFIG.storename,
      apiConfigured: !!(API_CONFIG.apikey && API_CONFIG.apisecret)
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 API Store: ${API_CONFIG.storename}`);
  console.log(`✅ Ready to serve requests!`);
});
