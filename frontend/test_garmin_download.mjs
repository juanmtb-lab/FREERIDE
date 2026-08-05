import { GarminConnect } from 'garmin-connect';

async function test() {
  const GC = new GarminConnect({
    username: 'juanmtb9@gmail.com',
    password: '' // We don't have user password in plaintext, but let's test available API methods
  });
  console.log("Testing GarminConnect API methods...");
}

test();
