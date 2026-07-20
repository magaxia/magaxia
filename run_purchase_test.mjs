import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    console.log('[PAGE]', msg.type(), msg.text());
  });

  const fileUrl = 'http://127.0.0.1:3001/test-bootstrap.html';
  console.log('Opening', fileUrl);
  await page.goto(fileUrl);

  // Sign up/sign in to auth emulator using client SDK
  await page.evaluate(async () => {
    const firebaseAuth = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const mod = await import(new URL('../vip5-firebase.js', import.meta.url).href);
    const auth = mod.auth;
    const email = 'tester+promo@example.com';
    const pass = 'Password123!';
    try {
      await firebaseAuth.createUserWithEmailAndPassword(auth, email, pass);
      console.log('[TEST] created user', email);
    } catch (e) {
      console.log('[TEST] createUser error (may already exist):', e.message || e);
    }
    await firebaseAuth.signInWithEmailAndPassword(auth, email, pass);
    console.log('[TEST] signed in as', email);
  });

  // Directly invoke the purchase function to trigger the checkout flow
  // Wait for auth to be established and page scripts to initialize
  await page.waitForFunction(async () => {
    try {
      const fb = await import('./vip5-firebase.js');
      return !!(fb && fb.auth && fb.auth.currentUser);
    } catch (e) {
      return false;
    }
  }, { timeout: 15000 });

  // Wait until the page exposes the comprarProduto function, then invoke it to run the full checkout flow
  await page.waitForFunction(() => {
    return typeof window.comprarProduto === 'function';
  }, { timeout: 20000 }).catch(() => {});

  const invokeResult = await page.evaluate(async () => {
    try {
      if (typeof window.comprarProduto !== 'function') return { error: 'no-comprar' };
      // Call comprarProduto(productId, nome, preco, renda, ciclo, tipo, requiredVip)
      // Use test values; adjust if needed for your environment.
      try {
        window.comprarProduto('test-product-1', 'Automated Test Product', 10, 0, 30, 'test', false);
        return { invoked: true };
      } catch (e) {
        return { error: e && e.message };
      }
    } catch (e) {
      return { error: e && e.message };
    }
  });

  console.log('[TEST] comprarProduto invocation result:', invokeResult);

  // Wait a bit to capture console logs from the transaction
  await page.waitForTimeout(5000);
  await browser.close();
})();
