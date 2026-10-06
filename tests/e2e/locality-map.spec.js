const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test('locality map is opt-in and missing data has an accessible retry state', async ({page}, testInfo) => {
  const requests = []; const failures = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => failures.push(error.message));
  await page.route('**/maps/locality.json', route => route.fulfill({status:404, body:'Not provisioned'}));
  await page.goto('/');
  await expect(page.getByRole('button', {name:/View locality map/})).toBeVisible();
  expect(requests.filter(url => new URL(url).pathname.startsWith('/maps/'))).toEqual([]);
  await page.getByRole('button', {name:/View locality map/}).click();
  await expect(page.getByRole('heading', {name:'Locality map not yet available.'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Retry map', exact:true})).toBeVisible();
  const attemptsBeforeRetry = requests.filter(url=>new URL(url).pathname==='/maps/locality.json').length;
  await page.getByRole('button', {name:'Retry map', exact:true}).click();
  await expect(page.getByRole('heading', {name:'Locality map not yet available.'})).toBeVisible();
  const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>v.id)).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('locality-map-unavailable.png'),fullPage:true});
  await page.getByRole('button', {name:'Back to schematic', exact:true}).click();
  await expect(page.getByText('Route schematic · not for navigation').first()).toBeVisible();
  expect(requests.every(url=>['localhost','127.0.0.1'].includes(new URL(url).hostname))).toBe(true);
  expect(requests.filter(url=>new URL(url).pathname==='/maps/locality.json')).toHaveLength(attemptsBeforeRetry + 1);
  expect(failures).toEqual([]);
});

test('invalid map configuration fails before fetching tiles or creating a worker', async ({page}) => {
  await page.addInitScript(() => {
    window.mapWorkersCreated = 0;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(...args) { super(...args); window.mapWorkersCreated += 1; }
    };
  });
  const resources=[];
  page.on('request', request=>resources.push(new URL(request.url()).pathname));
  await page.route('**/maps/locality.json', route=>route.fulfill({contentType:'application/json',
    body:JSON.stringify({version:1,bounds:[[-180,-85],[180,85]],places:[]})}));
  await page.goto('/');
  await page.getByRole('button', {name:/View locality map/}).click();
  await expect(page.getByRole('heading', {name:'Locality map not yet available.'})).toBeVisible();
  expect(resources.filter(path=>path.endsWith('.pmtiles'))).toEqual([]);
  expect(await page.evaluate(()=>window.mapWorkersCreated)).toBe(0);
});
