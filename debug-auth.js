// Debug script to check authentication and organization context
// Run this in the browser console after logging in

console.log('=== AUTH DEBUG START ===');

// Check cookies
console.log('\n1. COOKIES:');
console.log('All cookies:', document.cookie);
console.log('auth-token cookie exists:', document.cookie.includes('auth-token'));
console.log('active-organization cookie exists:', document.cookie.includes('active-organization'));

// Check localStorage
console.log('\n2. LOCAL STORAGE:');
const authStorage = localStorage.getItem('auth-storage');
if (authStorage) {
  try {
    const parsed = JSON.parse(authStorage);
    console.log('Auth storage:', parsed);
    console.log('User data:', parsed.state?.user);
    console.log('Organization ID in user:', parsed.state?.user?.organizationId);
  } catch (e) {
    console.log('Failed to parse auth storage:', e);
  }
} else {
  console.log('No auth storage found');
}

const orgStorage = localStorage.getItem('organization-store');
if (orgStorage) {
  try {
    const parsed = JSON.parse(orgStorage);
    console.log('Organization storage:', parsed);
    console.log('Active org ID:', parsed.state?.activeOrganizationId);
  } catch (e) {
    console.log('Failed to parse org storage:', e);
  }
} else {
  console.log('No organization storage found');
}

// Check window object
console.log('\n3. WINDOW OBJECT:');
console.log('window.__organizationId:', window.__organizationId);

// Check network requests
console.log('\n4. NETWORK DEBUGGING:');
console.log('To check network requests:');
console.log('1. Open Network tab in DevTools');
console.log('2. Filter by "auth.login" to see login response');
console.log('3. Check the response body for organizationId field');
console.log('4. Filter by "auth.me" to see the me query response');
console.log('5. Check if cookies are being sent with requests');

// Check if we can make a test request
console.log('\n5. TEST AUTH.ME REQUEST:');
console.log('Run this to test auth.me manually:');
console.log(`
fetch('/api/trpc/auth.me', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  }
}).then(r => r.json()).then(data => {
  console.log('auth.me response:', data);
  if (data.result?.data) {
    console.log('User data:', data.result.data);
    console.log('Has organizationId?', 'organizationId' in data.result.data);
    console.log('organizationId value:', data.result.data.organizationId);
  }
}).catch(e => console.error('Error:', e));
`);

console.log('\n=== AUTH DEBUG END ===');
