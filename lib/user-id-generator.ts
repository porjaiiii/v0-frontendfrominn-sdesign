// Generate a unique User ID from LINE User ID using consistent hashing
export function generateUserIdFromLineId(lineUserId: string): string {
  if (!lineUserId) return '';
  
  // Use a simple but consistent hash function
  // This ensures the same LINE User ID always generates the same User ID
  let hash = 0;
  for (let i = 0; i < lineUserId.length; i++) {
    const char = lineUserId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to positive number and create a readable ID
  const positiveHash = Math.abs(hash);
  const prefix = 'DW'; // Digital Wasted prefix
  const userIdNumber = positiveHash.toString().substring(0, 10).padEnd(10, '0');
  
  return `${prefix}${userIdNumber}`;
}

// Verify that hash is consistent
export function verifyUserIdHash(lineUserId: string, userId: string): boolean {
  return generateUserIdFromLineId(lineUserId) === userId;
}
