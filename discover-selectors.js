/**
 * PropFinder Selector Discovery Tool
 * 
 * Run this first to discover the correct selectors for PropFinder.
 * Opens a visible browser so you can see what's happening.
 * 
 * Usage: node discover-selectors.js
 */

require('dotenv').config();
const puppeteer = require('puppeteer');

async function discover() {
  console.log('🔍 PropFinder Selector Discovery Tool\n');
  console.log('This will open a browser window.');
  console.log('Watch what happens and note any issues.\n');
  
  const browser = await puppeteer.launch({
    headless: false,  // VISIBLE browser
    args: ['--window-size=1400,900'],
    slowMo: 100  // Slow down actions so you can see them
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  
  try {
    // Step 1: Go to login page
    console.log('Step 1: Loading login page...');
    await page.goto('https://propfinder.app/login', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);
    
    // Log all input fields found
    const inputs = await page.$$eval('input', elements => 
      elements.map(el => ({
        type: el.type,
        name: el.name,
        placeholder: el.placeholder,
        id: el.id,
        class: el.className
      }))
    );
    console.log('\n📝 Input fields found:');
    console.log(JSON.stringify(inputs, null, 2));
    
    // Log all buttons found
    const buttons = await page.$$eval('button', elements =>
      elements.map(el => ({
        text: el.textContent.trim().substring(0, 50),
        type: el.type,
        class: el.className
      }))
    );
    console.log('\n🔘 Buttons found:');
    console.log(JSON.stringify(buttons, null, 2));
    
    // Try to login
    console.log('\nStep 2: Attempting login...');
    
    // Find and fill email
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[id*="email" i]'
    ];
    
    for (const selector of emailSelectors) {
      const emailInput = await page.$(selector);
      if (emailInput) {
        console.log(`  ✅ Found email input: ${selector}`);
        await emailInput.type(process.env.PROPFINDER_EMAIL || 'test@example.com');
        break;
      }
    }
    
    // Find and fill password
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      console.log('  ✅ Found password input');
      await passwordInput.type(process.env.PROPFINDER_PASSWORD || 'testpass');
    }
    
    await page.waitForTimeout(2000);
    
    // Find login button
    const loginSelectors = [
      'button[type="submit"]',
      'button:has-text("Log in")',
      'button:has-text("Sign in")',
      'input[type="submit"]'
    ];
    
    console.log('\n⏸️  PAUSED: Review the browser window.');
    console.log('   Press Enter in terminal to continue and submit login...');
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
    // Click submit
    for (const selector of loginSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          console.log(`  Clicking: ${selector}`);
          await btn.click();
          break;
        }
      } catch (e) {}
    }
    
    // Wait for navigation
    await page.waitForTimeout(5000);
    
    console.log('\n📍 Current URL:', page.url());
    
    // Check if logged in
    if (page.url().includes('login')) {
      console.log('⚠️  Still on login page - login may have failed');
    } else {
      console.log('✅ Appears to be logged in');
    }
    
    // Step 3: Discover main page selectors
    console.log('\nStep 3: Analyzing main page...\n');
    
    // Find league buttons
    const leagueButtons = await page.$$eval('button, [role="button"], .btn', elements =>
      elements
        .filter(el => /NHL|NBA|MLB|NFL/i.test(el.textContent))
        .map(el => ({
          text: el.textContent.trim(),
          class: el.className,
          tag: el.tagName
        }))
    );
    console.log('🏈 League buttons found:');
    console.log(JSON.stringify(leagueButtons, null, 2));
    
    // Find filter inputs
    const filterInputs = await page.$$eval('input, select', elements =>
      elements.map(el => ({
        type: el.type || el.tagName,
        name: el.name,
        placeholder: el.placeholder,
        id: el.id,
        class: el.className,
        'aria-label': el.getAttribute('aria-label')
      }))
    );
    console.log('\n🎛️  Filter inputs found:');
    console.log(JSON.stringify(filterInputs, null, 2));
    
    // Find tables
    const tables = await page.$$eval('table, [role="table"], .table', elements =>
      elements.map(el => ({
        class: el.className,
        id: el.id,
        rows: el.querySelectorAll('tr').length
      }))
    );
    console.log('\n📊 Tables found:');
    console.log(JSON.stringify(tables, null, 2));
    
    console.log('\n⏸️  PAUSED: Browser is open for manual inspection.');
    console.log('   Inspect elements, test filters manually.');
    console.log('   Press Enter to close browser and exit...');
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n✅ Discovery complete. Update scraper.js selectors based on findings above.');
}

discover();
