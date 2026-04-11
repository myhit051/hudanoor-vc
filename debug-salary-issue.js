// Debug script to identify salary parsing issues
const API_BASE = 'http://localhost:3000/api';

async function debugSalaryIssue() {
  console.log('🔍 Debugging Salary Issue: ฿9,000 → ฿9\n');

  try {
    // Step 1: Check raw Google Sheets data
    console.log('📊 Step 1: Checking raw Google Sheets data...');
    const employeesResponse = await fetch(`${API_BASE}/employees`);
    
    if (!employeesResponse.ok) {
      throw new Error(`Employees API failed: ${employeesResponse.status}`);
    }
    
    const employeesData = await employeesResponse.json();
    console.log('✅ Got employees data from Google Sheets');
    
    if (employeesData.data && employeesData.data.length > 1) {
      console.log('\n📋 Raw Google Sheets Data Analysis:');
      console.log('Headers:', employeesData.data[0]);
      
      // Find the problematic employee
      for (let i = 1; i < employeesData.data.length; i++) {
        const row = employeesData.data[i];
        const rawSalary = row[6];
        
        console.log(`\n👤 Employee ${i}: ${row[1]}`);
        console.log(`   Raw Salary Value: "${rawSalary}"`);
        console.log(`   Type: ${typeof rawSalary}`);
        console.log(`   Length: ${rawSalary ? rawSalary.toString().length : 'N/A'}`);
        
        // Test different parsing methods
        console.log('\n   🧪 Testing parsing methods:');
        
        // Method 1: Direct parseFloat
        const method1 = parseFloat(rawSalary) || 0;
        console.log(`   Method 1 (parseFloat): ${method1}`);
        
        // Method 2: Remove commas first
        const method2 = typeof rawSalary === 'string' ? 
          parseFloat(rawSalary.replace(/,/g, '')) : parseFloat(rawSalary) || 0;
        console.log(`   Method 2 (remove commas): ${method2}`);
        
        // Method 3: Remove all formatting
        const method3 = (() => {
          if (typeof rawSalary === 'string') {
            const cleanValue = rawSalary.replace(/[,฿$\s]/g, '');
            return parseFloat(cleanValue) || 0;
          }
          return parseFloat(rawSalary) || 0;
        })();
        console.log(`   Method 3 (remove all formatting): ${method3}`);
        
        // Method 4: Check for hidden characters
        if (typeof rawSalary === 'string') {
          const charCodes = [];
          for (let j = 0; j < rawSalary.length; j++) {
            charCodes.push(rawSalary.charCodeAt(j));
          }
          console.log(`   Character codes: [${charCodes.join(', ')}]`);
          
          // Check for non-printable characters
          const hasNonPrintable = charCodes.some(code => code < 32 || code > 126);
          if (hasNonPrintable) {
            console.log(`   ⚠️  Contains non-printable characters!`);
          }
        }
        
        // Flag potential issues
        if (method1 !== method2 || method2 !== method3) {
          console.log(`   🚨 PARSING MISMATCH DETECTED!`);
        }
        
        if (method3 < 1000 && rawSalary && rawSalary.toString().includes('9000')) {
          console.log(`   🎯 FOUND THE ISSUE! Expected ~9000 but got ${method3}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Step 2: Check commission reports
    console.log('📈 Step 2: Checking commission reports...');
    const commissionResponse = await fetch(`${API_BASE}/commission-reports`);
    
    if (!commissionResponse.ok) {
      throw new Error(`Commission API failed: ${commissionResponse.status}`);
    }
    
    const commissionData = await commissionResponse.json();
    console.log('✅ Got commission reports data');
    
    if (commissionData.data && commissionData.data.length > 0) {
      console.log('\n📊 Commission Reports Analysis:');
      
      commissionData.data.forEach((report, index) => {
        console.log(`\n👤 ${report.employeeName}:`);
        console.log(`   Employee ID: ${report.employeeId}`);
        console.log(`   Salary in Report: ${report.salary}`);
        console.log(`   Formatted: ${report.salary.toLocaleString()} บาท`);
        
        if (report.salary < 1000) {
          console.log(`   🚨 SUSPICIOUS LOW SALARY DETECTED!`);
        }
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Step 3: Cross-reference data
    console.log('🔄 Step 3: Cross-referencing employee and commission data...');
    
    if (employeesData.data && commissionData.data) {
      const employeeMap = new Map();
      
      // Build employee map from raw data
      for (let i = 1; i < employeesData.data.length; i++) {
        const row = employeesData.data[i];
        employeeMap.set(row[0], {
          name: row[1],
          rawSalary: row[6],
          parsedSalary: (() => {
            const rawSalary = row[6];
            if (typeof rawSalary === 'string') {
              const cleanValue = rawSalary.replace(/[,฿$\s]/g, '');
              return parseFloat(cleanValue) || 0;
            }
            return parseFloat(rawSalary) || 0;
          })()
        });
      }
      
      // Compare with commission data
      commissionData.data.forEach(report => {
        const employee = employeeMap.get(report.employeeId);
        if (employee) {
          console.log(`\n👤 ${report.employeeName}:`);
          console.log(`   Raw from Sheets: "${employee.rawSalary}"`);
          console.log(`   Parsed by us: ${employee.parsedSalary}`);
          console.log(`   In Commission Report: ${report.salary}`);
          
          if (employee.parsedSalary !== report.salary) {
            console.log(`   🚨 MISMATCH! Our parsing: ${employee.parsedSalary}, Report: ${report.salary}`);
          } else {
            console.log(`   ✅ Match!`);
          }
        }
      });
    }

    console.log('\n🎯 Debug Complete! Check the output above for issues.');

  } catch (error) {
    console.error('💥 Debug failed:', error.message);
  }
}

// Run the debug
debugSalaryIssue();