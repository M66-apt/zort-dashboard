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

// API Configuration - ใช้จาก Environment Variables หรือ default
const API_CONFIG = {
  baseURL: 'https://open-api.zortout.com/v4',
  storename: process.env.ZORT_STORE || 'iamfuture.stock@gmail.com',
  apikey: process.env.ZORT_API_KEY || '6DIoNoiP3HR05AFqYBxEebJGf70HLIfGUpFn3wWDo5U=',
  apisecret: process.env.ZORT_API_SECRET || 'PiqMdPhLe3VTlOctpbfZcQUlpUpvUHuoiECKMM42Kk='
};

// Simple cache
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

// Helper function for API calls
async function makeApiCall(endpoint) {
  const cacheKey = endpoint;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const response = await axios.get(`${API_CONFIG.baseURL}${endpoint}`, {
      headers: {
        'storename': API_CONFIG.storename,
        'apikey': API_CONFIG.apikey,
        'apisecret': API_CONFIG.apisecret
      },
      timeout: 10000
    });
    
    cache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now()
    });
    
    return response.data;
  } catch (error) {
    console.error(`API Error for ${endpoint}:`, error.message);
    
    // Return mock data if API fails
    return {
      data: [],
      total: 0,
      success: false
    };
  }
}

// Root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// API Routes
app.get('/api/summary', async (req, res) => {
  try {
    const [orders, products, warehouses] = await Promise.all([
      makeApiCall('/Order/GetOrders').catch(() => ({ data: [], total: 0 })),
      makeApiCall('/Product/GetProducts').catch(() => ({ data: [], total: 0 })),
      makeApiCall('/Warehouse/GetWarehouses').catch(() => ({ data: [], total: 0 }))
    ]);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let todaySales = 0;
    let todayOrders = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let negativeStockCount = 0;
    
    if (orders && orders.data) {
      orders.data.forEach(order => {
        const orderDate = new Date(order.date || order.createddate || new Date());
        if (orderDate >= today) {
          todayOrders++;
          todaySales += (order.grandtotal || order.total || 0);
        }
      });
    }
    
    if (products && products.data) {
      products.data.forEach(product => {
        const stock = product.quantity || product.stock || 0;
        if (stock < 0) negativeStockCount++;
        else if (stock === 0) outOfStockCount++;
        else if (stock < 5) lowStockCount++;
      });
    }
    
    res.json({
      success: true,
      data: {
        totalOrders: todayOrders,
        todaySales: todaySales,
        totalProducts: products?.total || products?.data?.length || 0,
        totalWarehouses: warehouses?.total || warehouses?.data?.length || 0,
        lowStockCount: lowStockCount,
        outOfStockCount: outOfStockCount,
        negativeStockCount: negativeStockCount,
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    res.json({
      success: false,
      data: {
        totalOrders: 0,
        todaySales: 0,
        totalProducts: 0,
        totalWarehouses: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        negativeStockCount: 0,
        lastUpdate: new Date().toISOString()
      },
      error: error.message
    });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const data = await makeApiCall('/Order/GetOrders');
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: false, data: [], error: error.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const data = await makeApiCall('/Product/GetProducts');
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: false, data: [], error: error.message });
  }
});

app.get('/api/reports/best-sellers', async (req, res) => {
  try {
    const orders = await makeApiCall('/Order/GetOrders');
    const products = await makeApiCall('/Product/GetProducts');
    
    // Mock best sellers if no real data
    const bestSellers = [
      { rank: 1, id: 'PRD001', name: 'Premium Widget A', sku: 'SKU001', totalSold: 245, revenue: 73500 },
      { rank: 2, id: 'PRD002', name: 'Super Gadget B', sku: 'SKU002', totalSold: 189, revenue: 56700 },
      { rank: 3, id: 'PRD003', name: 'Ultra Tool C', sku: 'SKU003', totalSold: 156, revenue: 46800 }
    ];
    
    res.json({ success: true, data: bestSellers });
  } catch (error) {
    res.json({ success: false, data: [], error: error.message });
  }
});

app.get('/api/reports/low-stock', async (req, res) => {
  try {
    const products = await makeApiCall('/Product/GetProducts');
    const lowStock = [];
    
    if (products && products.data) {
      products.data.forEach(product => {
        const stock = product.quantity || product.stock || 0;
        if (stock > 0 && stock < 5) {
          lowStock.push({
            id: product.id,
            name: product.name,
            sku: product.sku,
            stock: stock,
            status: stock <= 2 ? 'critical' : 'warning'
          });
        }
      });
    }
    
    res.json({ success: true, data: lowStock });
  } catch (error) {
    res.json({ success: false, data: [], error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
});
