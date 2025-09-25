const mongoose = require('mongoose');
const { InventoryConfig } = require('./src/models/InventoryConfig');

async function checkCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/next-inventory');
    const config = await InventoryConfig.findOne({});
    if (config && config.categoryConfigs) {
      console.log('Categories in database:');
      config.categoryConfigs.forEach((cat, index) => {
        console.log(`${index}: ${cat.name} (ID: ${cat.id}, Order: ${cat.order})`);
      });
    } else {
      console.log('No categories found');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCategories();
