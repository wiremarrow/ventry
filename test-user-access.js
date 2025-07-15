// Quick test script to verify user@ventry.com login is blocked
import fetch from 'node-fetch';

const backendUrl = 'http://localhost:3001/api/trpc';

async function testUserLogin() {
  console.log('Testing user@ventry.com login behavior...');
  
  try {
    const response = await fetch(`${backendUrl}/auth.login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'user@ventry.com',
        password: 'password123'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('❌ SECURITY ISSUE: user@ventry.com was able to login!');
      console.log('Response:', result);
    } else {
      console.log('✅ SECURITY WORKING: user@ventry.com login blocked');
      console.log('Status:', response.status);
      console.log('Error:', result);
    }
  } catch (error) {
    console.log('⚠️  Could not test (backend not running?):', error.message);
  }
}

// Test with organization user for comparison
async function testEmployeeLogin() {
  console.log('\nTesting employee@ventry.com login (should work)...');
  
  try {
    const response = await fetch(`${backendUrl}/auth.login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'employee@ventry.com',
        password: 'password123'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ employee@ventry.com login successful (expected)');
      console.log('Organization ID:', result.user.organizationId);
    } else {
      console.log('❌ employee@ventry.com login failed (unexpected)');
      console.log('Error:', result);
    }
  } catch (error) {
    console.log('⚠️  Could not test (backend not running?):', error.message);
  }
}

testUserLogin().then(() => testEmployeeLogin());