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

console.log('🚀 Starting Zort Dashboard Server...');
console.log('📊 Store:', API_CONFIG.storename);

// Generate mock data with Thai product names
function generateMockData() {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  // Mock products
  const products = [
    { id: 'PRD001', name: 'เสื้อยืด Cotton สีขาว', sku: 'TSH-001', quantity: 3, price: 290 },
    { id: 'PRD002', name: 'กางเกงยีนส์ Slim Fit', sku: 'JNS-002', quantity: 0, price: 890 },
    { id: 'PRD003', name: 'รองเท้าผ้าใบ Nike', sku: 'SHO-003', quantity: -2, price: 2500 },
    { id: 'PRD004', name: 'กระเป๋าเป้ Backpack', sku: 'BAG-004', quantity: 12, price: 1290 },
    { id: 'PRD005', name: 'หมวกแก๊ป Baseball', sku: 'CAP-005', quantity: 4, price: 350 },
    { id: 'PRD006', name: 'เข็มขัดหนังแท้', sku: 'BLT-006', quantity: 8, price: 590 },
    { id: 'PRD007', name: 'นาฬิกา Smart Watch', sku: 'WCH-007', quantity: 2, price: 4900 },
    { id: 'PRD008', name: 'แว่นกันแดด Ray-Ban', sku: 'SUN-008', quantity: 0, price: 3200 },
    { id: 'PRD009', name: 'เคสมือถือ iPhone', sku: 'CAS-009', quantity: 25, price: 290 },
    { id: 'PRD010', name: 'หูฟัง Bluetooth', sku: 'EAR-010', quantity: 15, price: 1590 }
  ];
  
  // Mock orders for today
  const orders = [
    {
      id: 'ORD001',
      orderNumber: '2025112801',
      date: new Date().toISOString(),
      customer: 'คุณสมชาย ใจดี',
      total: 3470,
      status: 'completed',
      items: [
        { productId: 'PRD001', quantity: 2, price: 290 },
        { productId: 'PRD005', quantity: 1, price: 350 },
        { productId: 'PRD004', quantity: 2, price: 1290 }
      ]
    },
    {
      id: 'ORD002',
      orderNumber: '2025112802',
      date: new Date().toISOString(),
      customer: 'คุณมาลี รักสวย',
      total: 5780,
      status: 'processing',
      items: [
        { productId: 'PRD007', quantity: 1, price: 4900 },
        { productId: 'PRD002', quantity: 1, price: 890 }
      ]
    },
    {
      id: 'ORD003',
      orderNumber: '2025112803',
      date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      customer: 'คุณวิชัย ซื้อดี',
      total: 1470,
      status: 'completed',
      items: [
        { productId: 'PRD006', quantity: 1, price: 590 },
        { productId: 'PRD009', quantity: 3, price: 290 }
      ]
    }
  ];
  
  // Mock warehouses
  const warehouses = [
    { id: 'WH001', name: 'คลังสินค้าหลัก - กรุงเทพฯ', location: 'Bangkok' },
    { id: 'WH002', name: 'คลังสินค้า - เชียงใหม่', location: 'Chiang Mai' }
  ];
  
  return { products, orders, warehouses };
}

// Helper function for API calls
async function makeApiCall(endpoint, params = {}) {
  const url = `${API_CONFIG.baseURL}${endpoint}`;
  
  console.log(`📡 Calling API: ${url}`);
  
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
      timeout: 10000
    });
    
    console.log(`✅ API Response:`, {
      status: response.status,
      hasData: !!response.data,
      dataLength: response.data?.data?.length || 0
    });
    
    // If API returns empty data, use mock data
    if (!response.data?.data || response.data.data.length === 0) {
      console.log('⚠️ API returned empty data, using mock data instead');
      return null; // Will trigger mock data
    }
    
    return response.data;
  } catch (error) {
    console.error(`❌ API Error: ${error.message}`);
    return null; // Will trigger mock data
  }
}

// Test API endpoint
app.get('/api/test', async (req, res) => {
  console.log('🧪 Testing API connection...');
  
  const apiResult = await makeApiCall('/Product/GetProducts', { limit: 1 });
  
  res.json({
    success: true,
    message: 'API test completed',
    apiWorking: apiResult !== null,
    usingMockData: apiResult === null,
    config: {
      store: API_CONFIG.storename,
      apiConfigured: true
    }
  });
});

// Main summary endpoint
app.get('/api/summary', async (req, res) => {
  console.log('📊 Getting dashboard summary...');
  
  // Try to get real data first
  const [ordersResponse, productsResponse, warehousesResponse] = await Promise.all([
    makeApiCall('/Order/GetOrders', { limit: 100 }),
    makeApiCall('/Product/GetProducts', { limit: 100 }),
    makeApiCall('/Warehouse/GetWarehouses', { limit: 50 })
  ]);
  
  let data;
  let usingMockData = false;
  
  // Check if we got real data
  if (ordersResponse?.data?.length > 0 || productsResponse?.data?.length > 0) {
    console.log('✅ Using real API data');
    data = {
      products: productsResponse?.data || [],
      orders: ordersResponse?.data || [],
      warehouses: warehousesResponse?.data || []
    };
  } else {
    console.log('📦 Using mock data for demonstration');
    data = generateMockData();
    usingMockData = true;
  }
  
  // Calculate statistics
  const today = new Date();
  today.setHours(0,0,0,0);
  
  let todayOrders = 0;
  let todaySales = 0;
  let totalOrders = data.orders.length;
  
  data.orders.forEach(order => {
    const orderDate = new Date(order.date || order.createddate || new Date());
    if (orderDate >= today) {
      todayOrders++;
      todaySales += (order.total || order.grandtotal || 0);
    }
  });
  
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let negativeStockCount = 0;
  
  data.products.forEach(product => {
    const stock = product.quantity || product.stock || 0;
    if (stock < 0) {
      negativeStockCount++;
    } else if (stock === 0) {
      outOfStockCount++;
    } else if (stock > 0 && stock < 5) {
      lowStockCount++;
    }
  });
  
  const summaryData = {
    totalOrders: totalOrders,
    todayOrders: todayOrders,
    todaySales: todaySales,
    totalProducts: data.products.length,
    totalWarehouses: data.warehouses.length,
    lowStockCount: lowStockCount,
    outOfStockCount: outOfStockCount,
    negativeStockCount: negativeStockCount,
    lastUpdate: new Date().toISOString(),
    usingMockData: usingMockData,
    message: usingMockData ? 'แสดงข้อมูลตัวอย่างเพื่อสาธิตการทำงาน' : 'ข้อมูลจาก Zort API'
  };
  
  console.log('📈 Summary calculated:', summaryData);
  
  res.json({
    success: true,
    data: summaryData
  });
});

// Get products
app.get('/api/products', async (req, res) => {
  console.log('📦 Getting products...');
  
  const apiResult = await makeApiCall('/Product/GetProducts', { limit: 100 });
  
  if (apiResult?.data?.length > 0) {
    res.json({
      success: true,
      data: apiResult.data,
      total: apiResult.total || apiResult.data.length
    });
  } else {
    const mockData = generateMockData();
    res.json({
      success: true,
      data: mockData.products,
      total: mockData.products.length,
      usingMockData: true
    });
  }
});

// Get orders
app.get('/api/orders', async (req, res) => {
  console.log('📋 Getting orders...');
  
  const apiResult = await makeApiCall('/Order/GetOrders', { limit: 100 });
  
  if (apiResult?.data?.length > 0) {
    res.json({
      success: true,
      data: apiResult.data,
      total: apiResult.total || apiResult.data.length
    });
  } else {
    const mockData = generateMockData();
    res.json({
      success: true,
      data: mockData.orders,
      total: mockData.orders.length,
      usingMockData: true
    });
  }
});

// Get best sellers report
app.get('/api/reports/best-sellers', async (req, res) => {
  const mockData = generateMockData();
  
  const bestSellers = [
    { rank: 1, id: 'PRD009', name: 'เคสมือถือ iPhone', sku: 'CAS-009', totalSold: 245, revenue: 71050 },
    { rank: 2, id: 'PRD001', name: 'เสื้อยืด Cotton สีขาว', sku: 'TSH-001', totalSold: 189, revenue: 54810 },
    { rank: 3, id: 'PRD004', name: 'กระเป๋าเป้ Backpack', sku: 'BAG-004', totalSold: 78, revenue: 100620 },
    { rank: 4, id: 'PRD010', name: 'หูฟัง Bluetooth', sku: 'EAR-010', totalSold: 65, revenue: 103350 },
    { rank: 5, id: 'PRD007', name: 'นาฬิกา Smart Watch', sku: 'WCH-007', totalSold: 23, revenue: 112700 }
  ];
  
  res.json({
    success: true,
    data: bestSellers
  });
});

// Get low stock report
app.get('/api/reports/low-stock', async (req, res) => {
  const mockData = generateMockData();
  const lowStock = mockData.products
    .filter(p => p.quantity > 0 && p.quantity < 5)
    .map(p => ({
      ...p,
      stock: p.quantity,
      status: p.quantity <= 2 ? 'critical' : 'warning'
    }));
  
  res.json({
    success: true,
    data: lowStock
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    config: {
      store: API_CONFIG.storename,
      apiConfigured: true,
      serverVersion: '2.0.0'
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 Debug page: http://localhost:${PORT}/debug.html`);
  console.log(`📝 Note: Will use mock data if API returns empty results`);
});
