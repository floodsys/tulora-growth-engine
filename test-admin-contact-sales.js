// Quick test for Admin contact-sales verification
// Run with: node test-admin-contact-sales.js

const SUPABASE_URL = 'https://nkjxbeypbiclvouqfjyc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ranhiZXlwYmljbHZvdXFmanljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Nzg2NDEsImV4cCI6MjA3MTA1NDY0MX0.iuFFcJSX97MKkiBvSYLmIao9aTMrQm7zqnf4kEDraQg';

async function testContactSales(testCase, payload) {
  console.log(`\n🧪 Testing: ${testCase}`);
  console.log('📤 Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/contact-sales`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(payload)
    });

    console.log('📊 Status:', response.status);
    console.log('📋 Headers:');
    console.log('  X-Function:', response.headers.get('X-Function'));
    console.log('  X-Version:', response.headers.get('X-Version'));
    console.log('  X-CRM-Status:', response.headers.get('X-CRM-Status'));
    
    const result = await response.text();
    console.log('📝 Response (first 200 chars):', result.substring(0, 200));
    
    try {
      const jsonResult = JSON.parse(result);
      if (jsonResult.lead_id) {
        console.log('✅ Lead ID:', jsonResult.lead_id);
      }
      if (jsonResult.product_line) {
        console.log('✅ Product Line:', jsonResult.product_line);
      }
    } catch (e) {
      // Response may not be JSON
    }
    
    if (response.status === 200 || response.status === 424) {
      console.log('✅ SUCCESS: Expected non-422 status');
    } else if (response.status === 422) {
      console.log('❌ FAILED: Got 422 validation error');
    } else {
      console.log('⚠️  UNEXPECTED: Unexpected status code');
    }

  } catch (error) {
    console.error('💥 ERROR:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Testing contact-sales endpoint normalization and validation');
  
  // Test a) product_interest: []
  await testContactSales('Empty array', {
    inquiry_type: 'enterprise',
    full_name: 'Test User A',
    email: `test-a-${Date.now()}@example.com`,
    company: 'Test Company',
    message: 'Testing empty array',
    product_interest: []
  });

  // Test b) product_interest: ["AI Lead Generation"]
  await testContactSales('Single selection', {
    inquiry_type: 'enterprise',
    full_name: 'Test User B',
    email: `test-b-${Date.now()}@example.com`,
    company: 'Test Company',
    message: 'Testing single selection',
    product_interest: ['AI Lead Generation']
  });

  // Test c) product_interest: ["AI Lead Generation","AI Customer Service"]
  await testContactSales('Multi-select both', {
    inquiry_type: 'enterprise',
    full_name: 'Test User C',
    email: `test-c-${Date.now()}@example.com`,
    company: 'Test Company',
    message: 'Testing multi-select',
    product_interest: ['AI Lead Generation', 'AI Customer Service']
  });

  // Test d) synonyms: ["leadgen","support"]
  await testContactSales('Synonyms', {
    inquiry_type: 'enterprise',
    full_name: 'Test User D',
    email: `test-d-${Date.now()}@example.com`,
    company: 'Test Company',
    message: 'Testing synonyms',
    product_interest: ['leadgen', 'support']
  });

  // Test e) mixed case: ["ai lead generation","AI CUSTOMER SERVICE"]
  await testContactSales('Mixed case', {
    inquiry_type: 'enterprise',
    full_name: 'Test User E',
    email: `test-e-${Date.now()}@example.com`,
    company: 'Test Company',
    message: 'Testing mixed case',
    product_interest: ['ai lead generation', 'AI CUSTOMER SERVICE']
  });

  // Test f) Invalid values (should get 422)
  await testContactSales('Invalid values (expect 422)', {
    inquiry_type: 'enterprise',
    full_name: 'Test User F',
    email: `test-f-${Date.now()}@example.com`,
    company: 'Test Company',
    message: 'Testing invalid values',
    product_interest: ['Invalid Product', 'Another Invalid']
  });

  console.log('\n🏁 All tests completed!');
}

// Run tests
runTests().catch(console.error);