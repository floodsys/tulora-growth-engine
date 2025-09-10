// E2E test for multi-select product interest functionality
// Run with: deno run --allow-net --allow-env test-multiselect.ts

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://nkjxbeypbiclvouqfjyc.supabase.co';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ranhiZXlwYmljbHZvdXFmanljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Nzg2NDEsImV4cCI6MjA3MTA1NDY0MX0.iuFFcJSX97MKkiBvSYLmIao9aTMrQm7zqnf4kEDraQg';

async function testMultiSelectProductInterest() {
  console.log('🧪 Testing multi-select product interest...');
  
  const testPayload = {
    inquiry_type: 'enterprise',
    full_name: 'Test User MultiSelect',
    email: `test-multiselect-${Date.now()}@example.com`,
    company: 'Test Company',
    message: 'Testing multi-select functionality',
    product_interest: ['AI Lead Generation', 'AI Customer Service'], // Both options
    expected_volume: '5,000-20,000 calls/month',
    additional_requirements: 'Testing both products'
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/contact-sales`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('🎯 Response Data:', result);
    console.log('📋 CRM Status:', response.headers.get('X-CRM-Status'));

    // Verify expectations
    if (response.status === 200) {
      console.log('✅ SUCCESS: Multi-select returned 200');
      
      if (response.headers.get('X-CRM-Status') === 'success') {
        console.log('✅ SUCCESS: X-CRM-Status is success');
      } else {
        console.log('⚠️  WARNING: X-CRM-Status is not success');
      }
      
      // Check if lead was created with expected properties
      if (result.lead_id) {
        console.log('✅ SUCCESS: Lead was created with ID:', result.lead_id);
        
        // The backend should have:
        // - Set product_line to first selected (leadgen)
        // - Added both to source_metadata.product_interests
        // - Appended "Also interested in: AI Customer Service" to message
        console.log('📝 Expected: product_line=leadgen, source_metadata includes both interests');
      }
    } else if (response.status === 422) {
      console.log('❌ FAILED: Got 422 validation error');
      console.log('🔍 Validation errors:', result.details);
    } else {
      console.log('❌ FAILED: Unexpected status code');
    }

  } catch (error) {
    console.error('💥 ERROR:', error);
  }
}

async function testSingleSelectProductInterest() {
  console.log('\n🧪 Testing single-select product interest (backward compatibility)...');
  
  const testPayload = {
    inquiry_type: 'enterprise',
    full_name: 'Test User Single',
    email: `test-single-${Date.now()}@example.com`,
    company: 'Test Company',
    message: 'Testing single-select functionality',
    product_interest: 'AI Lead Generation', // Single value
    expected_volume: '5,000-20,000 calls/month',
    additional_requirements: 'Testing single product'
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/contact-sales`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('🎯 Response Data:', result);

    if (response.status === 200) {
      console.log('✅ SUCCESS: Single-select still works');
    } else {
      console.log('❌ FAILED: Single-select broken');
    }

  } catch (error) {
    console.error('💥 ERROR:', error);
  }
}

async function testInvalidProductInterest() {
  console.log('\n🧪 Testing invalid product interest...');
  
  const testPayload = {
    inquiry_type: 'enterprise',
    full_name: 'Test User Invalid',
    email: `test-invalid-${Date.now()}@example.com`,
    company: 'Test Company',
    message: 'Testing invalid values',
    product_interest: ['Invalid Product', 'AI Lead Generation'], // One invalid, one valid
    expected_volume: '5,000-20,000 calls/month'
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/contact-sales`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('🎯 Response Data:', result);

    if (response.status === 422) {
      console.log('✅ SUCCESS: Invalid values correctly rejected with 422');
      
      // Check if the error message mentions the invalid value
      const hasFieldError = result.details?.some((error: any) => 
        error.field === 'product_interest' && error.message.includes('Invalid Product')
      );
      
      if (hasFieldError) {
        console.log('✅ SUCCESS: Field-specific error returned');
      } else {
        console.log('⚠️  WARNING: Expected field-specific error not found');
      }
    } else {
      console.log('❌ FAILED: Should have returned 422 for invalid values');
    }

  } catch (error) {
    console.error('💥 ERROR:', error);
  }
}

// Run all tests
if (import.meta.main) {
  await testMultiSelectProductInterest();
  await testSingleSelectProductInterest();
  await testInvalidProductInterest();
  console.log('\n🏁 All tests completed!');
}