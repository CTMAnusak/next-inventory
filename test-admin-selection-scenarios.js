/**
 * สคริปต์ทดสอบกรณีต่างๆ ที่แอดมินเปลี่ยนการเลือกอุปกรณ์
 * 
 * วิธีใช้:
 * 1. เปิด Browser Developer Tools
 * 2. ไปที่หน้า Admin Equipment Reports
 * 3. Copy & Paste สคริปต์นี้ใน Console
 * 4. เรียกใช้ฟังก์ชันทดสอบ
 */

// ฟังก์ชันสำหรับทดสอบกรณีต่างๆ
window.testAdminSelectionScenarios = {
  
  // กรณีที่ 1: เปลี่ยนเบอร์โทรศัพท์ซิมการ์ด
  async testPhoneNumberChange() {
    console.log('🧪 กรณีที่ 1: ทดสอบการเปลี่ยนเบอร์โทรศัพท์ซิมการ์ด');
    console.log('   ผู้ใช้เบิก: 0816565465 → แอดมินเลือก: 0854646656');
    
    // สมมติข้อมูลที่ส่งไป API
    const testSelection = {
      masterId: "sim_card_master_id",
      itemName: "AIS",
      category: "cat_sim_card",
      requestedQuantity: 1,
      selectedItems: [
        {
          itemId: "inventory_item_id_for_0854646656", // itemId ของเบอร์ที่แอดมินเลือก
          serialNumber: "0854646656" // เบอร์ที่แอดมินเลือก
        }
      ]
    };
    
    console.log('📤 ข้อมูลที่ส่งไป API:', testSelection);
    console.log('✅ คาดหวัง: assignedPhoneNumbers = ["0854646656"]');
    console.log('✅ คาดหวัง: equipment-tracking แสดงเบอร์ 0854646656');
    
    return testSelection;
  },
  
  // กรณีที่ 2: เปลี่ยน Serial Number
  async testSerialNumberChange() {
    console.log('🧪 กรณีที่ 2: ทดสอบการเปลี่ยน Serial Number');
    console.log('   ผู้ใช้เบิก: SN "001" → แอดมินเลือก: SN "002"');
    
    const testSelection = {
      masterId: "laptop_master_id",
      itemName: "Notebook",
      category: "cat_laptop",
      requestedQuantity: 1,
      selectedItems: [
        {
          itemId: "inventory_item_id_for_002", // itemId ของ SN ที่แอดมินเลือก
          serialNumber: "002" // SN ที่แอดมินเลือก
        }
      ]
    };
    
    console.log('📤 ข้อมูลที่ส่งไป API:', testSelection);
    console.log('✅ คาดหวัง: assignedSerialNumbers = ["002"]');
    console.log('✅ คาดหวัง: equipment-tracking แสดง SN "002"');
    
    return testSelection;
  },
  
  // กรณีที่ 3: เปลี่ยนจาก SN เป็นไม่มี SN
  async testSNToNoSN() {
    console.log('🧪 กรณีที่ 3: ทดสอบการเปลี่ยนจาก SN เป็นไม่มี SN');
    console.log('   ผู้ใช้เบิก: SN "001" → แอดมินเลือก: อุปกรณ์ไม่มี SN');
    
    const testSelection = {
      masterId: "mouse_master_id",
      itemName: "Mouse",
      category: "cat_accessories",
      requestedQuantity: 1,
      selectedItems: [
        {
          itemId: "inventory_item_id_no_sn", // itemId ของอุปกรณ์ไม่มี SN
          serialNumber: undefined // ไม่มี SN
        }
      ]
    };
    
    console.log('📤 ข้อมูลที่ส่งไป API:', testSelection);
    console.log('✅ คาดหวัง: assignedSerialNumbers = []');
    console.log('✅ คาดหวัง: equipment-tracking แสดง "ไม่มี SN"');
    
    return testSelection;
  },
  
  // กรณีที่ 4: เปลี่ยนจากไม่มี SN เป็นมี SN
  async testNoSNToSN() {
    console.log('🧪 กรณีที่ 4: ทดสอบการเปลี่ยนจากไม่มี SN เป็นมี SN');
    console.log('   ผู้ใช้เบิก: อุปกรณ์ไม่มี SN → แอดมินเลือก: SN "001"');
    
    const testSelection = {
      masterId: "monitor_master_id",
      itemName: "Monitor",
      category: "cat_monitor",
      requestedQuantity: 1,
      selectedItems: [
        {
          itemId: "inventory_item_id_for_001", // itemId ของ SN ที่แอดมินเลือก
          serialNumber: "001" // SN ที่แอดมินเลือก
        }
      ]
    };
    
    console.log('📤 ข้อมูลที่ส่งไป API:', testSelection);
    console.log('✅ คาดหวัง: assignedSerialNumbers = ["001"]');
    console.log('✅ คาดหวัง: equipment-tracking แสดง SN "001"');
    
    return testSelection;
  },
  
  // ฟังก์ชันทดสอบทั้งหมด
  async runAllTests() {
    console.log('🚀 เริ่มทดสอบทุกกรณี...\n');
    
    await this.testPhoneNumberChange();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await this.testSerialNumberChange();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await this.testSNToNoSN();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await this.testNoSNToSN();
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('✅ ทดสอบเสร็จสิ้น!');
    console.log('\n📋 สรุป: ทุกกรณีควรใช้ข้อมูลที่แอดมินเลือก ไม่ใช่ที่ผู้ใช้ขอเดิม');
  }
};

// คำแนะนำการใช้งาน
console.log('🔧 สคริปต์ทดสอบโหลดเรียบร้อย!');
console.log('📝 วิธีใช้:');
console.log('   testAdminSelectionScenarios.runAllTests() - ทดสอบทุกกรณี');
console.log('   testAdminSelectionScenarios.testPhoneNumberChange() - ทดสอบเฉพาะเบอร์โทรศัพท์');
console.log('   testAdminSelectionScenarios.testSerialNumberChange() - ทดสอบเฉพาะ Serial Number');
