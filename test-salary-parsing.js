// Test script for salary parsing issues
const API_BASE = 'http://localhost:3000/api';

async function testSalaryParsing() {
  console.log('💰 Testing Salary Parsing Issues...\n');

  try {
    // Test 1: Get employees data directly
    console.log('👥 Test 1: Get employees data directly');
    const employeesResponse = await fetch(`${API_BASE}/employees`);
    
    if (employeesResponse.ok) {
      const employeesData = await employeesResponse.json();
      console.log('✅ Employees API Success!');
      
      if (employeesData.data && employeesData.data.length > 1) {
        console.log('\n📋 Raw Employee Data from Google Sheets:');
        
        // Show header
        const headers = employeesData.data[0];
        console.log('Headers:', headers);
        
        // Show first few employee records
        for (let i = 1; i < Math.min(4, employeesData.data.length); i++) {
          const row = employeesData.data[i];
          console.log(`\nEmployee ${i}:`);
          console.log(`  ID: ${row[0]}`);
          console.log(`  Name: ${row[1]}`);
          console.log(`  Position: ${row[2]}`);
          console.log(`  Email: ${row[3]}`);
          console.log(`  Phone: ${row[4]}`);
          console.log(`  Start Date: ${row[5]}`);
          console.log(`  Salary (Raw): "${row[6]}" (Type: ${typeof row[6]})`);
          console.log(`  Status: ${row[7]}`);
          console.log(`  Branch Commissions: ${row[8]}`);
          
          // Test salary parsing
          const salaryValue = row[6];
          let parsedSalary;
          
          if (typeof salaryValue === 'string') {
            const cleanValue = salaryValue.replace(/[,฿$\s]/g, '');
            parsedSalary = parseFloat(cleanValue) || 0;
            console.log(`  Salary (Cleaned): "${cleanValue}"`);
          } else {
            parsedSalary = parseFloat(salaryValue) || 0;
          }
          
          console.log(`  Salary (Parsed): ${parsedSalary}`);
          console.log(`  Salary (Formatted): ${parsedSalary.toLocaleString()} บาท`);
        }
      }
    } else {
      const error = await employeesResponse.json();
      console.log('❌ Employees API Failed:', error.error);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 2: Get commission reports
    console.log('📊 Test 2: Get commission reports');
    const commissionResponse = await fetch(`${API_BASE}/commission-reports`);
    
    if (commissionResponse.ok) {
      const commissionData = await commissionResponse.json();
      console.log('✅ Commission Reports API Success!');
      
      if (commissionData.data && commissionData.data.length > 0) {
        console.log('\n📋 Commission Report Data:');
        
        commissionData.data.forEach((report, index) => {
          console.log(`\nEmployee ${index + 1}:`);
          console.log(`  ID: ${report.employeeId}`);
          console.log(`  Name: ${report.employeeName}`);
          console.log(`  Salary: ${report.salary} (${report.salary.toLocaleString()} บาท)`);
          console.log(`  Store Commission: ${report.storeCommission}`);
          console.log(`  Online Commission: ${report.onlineCommission}`);
          console.log(`  Total Commission: ${report.totalCommission}`);
          console.log(`  Total Earnings: ${report.totalEarnings}`);
        });
        
        // Check for salary discrepancies
        console.log('\n🔍 Salary Analysis:');
        const salaries = commissionData.data.map(r => r.salary);
        const minSalary = Math.min(...salaries);
        const maxSalary = Math.max(...salaries);
        const avgSalary = salaries.reduce((sum, s) => sum + s, 0) / salaries.length;
        
        console.log(`  Min Salary: ${minSalary.toLocaleString()} บาท`);
        console.log(`  Max Salary: ${maxSalary.toLocaleString()} บาท`);
        console.log(`  Avg Salary: ${avgSalary.toLocaleString()} บาท`);
        
        // Flag suspicious values
        salaries.forEach((salary, index) => {
          if (salary < 1000) {
            console.log(`  ⚠️  Suspicious low salary for ${commissionData.data[index].employeeName}: ${salary} บาท`);
          }
        });
      }
    } else {
      const error = await commissionResponse.json();
      console.log('❌ Commission Reports API Failed:', error.error);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 3: Test different salary formats
    console.log('🧪 Test 3: Test salary parsing with different formats');
    
    const testValues = [
      '9000',
      '9,000',
      '฿9,000',
      '$9,000',
      '9000.00',
      '9,000.00',
      ' 9,000 ',
      9000,
      '9',
      '9.00'
    ];
    
    testValues.forEach(value => {
      let parsed;
      if (typeof value === 'string') {
        const cleanValue = value.replace(/[,฿$\s]/g, '');
        parsed = parseFloat(cleanValue) || 0;
      } else {
        parsed = parseFloat(value) || 0;
      }
      
      console.log(`  "${value}" (${typeof value}) → ${parsed}`);
    });

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
}

// Run the test
testSalaryParsing();