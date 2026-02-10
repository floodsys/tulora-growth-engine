// Quick test for multi-select product interest functionality
// Run with: node test-multiselect-quick.js

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nkjxbeypbiclvouqfjyc.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''; // set SUPABASE_ANON_KEY env var

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

    const responseText = await response.text();
    const first200Chars = responseText.substring(0, 200);

    console.log('📊 Response Status:', response.status);
    console.log('📋 Headers:');
    console.log('  X-Function:', response.headers.get('X-Function'));
    console.log('  X-Version:', response.headers.get('X-Version'));
    console.log('  X-CRM-Status:', response.headers.get('X-CRM-Status'));
    console.log('🎯 Response (first 200 chars):', first200Chars);

    // Parse response if possible
    try {
      const result = JSON.parse(responseText);
      console.log('✅ JSON parsed successfully');
      if (result.success) {
        console.log('✅ SUCCESS: Form submission accepted');
        if (result.lead_id) {
          console.log('✅ Lead ID:', result.lead_id);
        }
      } else {
        console.log('❌ Form submission failed:', result.error);
      }
    } catch (e) {
      console.log('❌ Failed to parse JSON response');
    }

    // Verify expectations
    if (response.status === 200) {
      console.log('✅ SUCCESS: Multi-select returned 200');
    } else if (response.status === 424) {
      console.log('⚠️  CRM dependency failed (424) - form accepted but CRM sync failed');
    } else if (response.status === 422) {
      console.log('❌ FAILED: Got 422 validation error - multi-select not working');
    } else {
      console.log('❌ FAILED: Unexpected status code:', response.status);
    }

  } catch (error) {
    console.error('💥 ERROR:', error);
  }
}

// Run the test
testMultiSelectProductInterest().then(() => {
  console.log('\n🏁 Test completed!');
});