const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await browser.close();
})();
