const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const crypto = require('node:crypto');
const mongoose = require('../../backend/node_modules/mongoose');
const { User, Invite, Session, Group, Message, Report } = require('../../backend/models');
const { passwordHash, digest } = require('../../backend/lib/security');
const { testUri } = require('../../scripts/test-env.cjs');
const password = 'A strong browser-test passphrase';
let hash;
const createdUserIds = [];
const createdInviteIds = [];
test.beforeAll(async () => {
  await mongoose.connect(testUri('tenx_browser', process.env.E2E_MONGO_URI));
  await Promise.all([User, Invite, Session, Group, Message, Report].map(model => model.init()));
  hash = await passwordHash(password);
});
test.afterAll(async () => {
  const groups = await Group.find({hostId: {$in: createdUserIds}}).select('_id').lean();
  await Message.deleteMany({groupId: {$in: groups.map(g => g._id)}});
  await Group.deleteMany({hostId: {$in: createdUserIds}});
  await Session.deleteMany({userId: {$in: createdUserIds}});
  await User.deleteMany({_id: {$in: createdUserIds}});
  await Invite.deleteMany({_id: {$in: createdInviteIds}});
  await Report.deleteMany({reporterId: {$in: createdUserIds}});
  await mongoose.disconnect();
});
async function account(role = 'member') {
  const id=crypto.randomBytes(5).toString('hex');
  const user = await User.create({alias:`Neighbour ${id}`,email:`${id}@example.test`,passwordHash:hash,role});
  createdUserIds.push(user._id);
  return {alias:user.alias,email:user.email,id:String(user._id)};
}
async function login(page, user) {
  await page.goto('/');
  await page.getByLabel('Email', {exact:true}).fill(user.email);
  await page.getByLabel('Password', {exact:true}).fill(password);
  await page.getByRole('button', {name:'Sign in →',exact:true}).click();
  await expect(page.getByRole('button',{name:'My groups',exact:true})).toBeVisible();
}
async function accessible(page) {
  const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}

test('landing is private, accessible, and contains no external tracking requests', async ({page}, testInfo) => {
  const failures=[]; const destinations=[];
  page.on('pageerror', e=>failures.push(e.message));
  page.on('request', request=>destinations.push(new URL(request.url()).hostname));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/The last mile/})).toBeVisible();
  await expect(page.getByText('Route schematic · not for navigation').first()).toBeVisible();
  await accessible(page);
  await page.screenshot({path:testInfo.outputPath('landing.png'),fullPage:true});
  expect(failures).toEqual([]);
  expect(destinations.every(host=>['localhost','127.0.0.1'].includes(host))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
});

test('invite registration creates a private session and protects the board', async ({page}) => {
  const code=crypto.randomBytes(32).toString('hex');
  const invite=await Invite.create({codeHash:digest(code),expiresAt:new Date(Date.now()+60000)});
  createdInviteIds.push(invite._id);
  const id=crypto.randomBytes(5).toString('hex');
  await page.goto('/');
  await page.getByRole('button',{name:'Join community',exact:true}).click();
  await page.getByLabel('Your public alias').fill(`New neighbour ${id}`);
  await page.getByLabel('Invite code',{exact:true}).fill(code);
  await page.getByLabel('Email',{exact:true}).fill(`${id}@example.test`);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Join TenX Together →',exact:true}).click();
  await expect(page.getByRole('button',{name:'My groups',exact:true})).toBeVisible();
  const registered=await User.findOne({email:`${id}@example.test`});
  createdUserIds.push(registered._id);
  const cookie=(await page.context().cookies()).find(c=>c.name==='tenx_session');
  expect(cookie.httpOnly).toBe(true); expect(cookie.sameSite).toBe('Strict');
  expect(await page.evaluate(()=>localStorage.length)).toBe(0);
  await accessible(page);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign in →',exact:true})).toBeVisible();
  expect((await page.request.get('/api/groups')).status()).toBe(401);
});

test('neighbours create, join, privately coordinate and leave a departure', async ({page,browser},testInfo) => {
  const host=await account(); const neighbour=await account();
  await login(page,host);
  await page.getByRole('button',{name:'+ Post a departure',exact:true}).click();
  const departure=new Date(Date.now()+120*60000);
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(departure);
  const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  const date=`${values.year}-${values.month}-${values.day}`;
  await page.getByLabel('Date',{exact:true}).fill(date);
  await page.getByLabel('Departure time · IST').fill(`${values.hour}:${values.minute}`);
  await page.getByRole('button',{name:'Post departure →',exact:true}).click();
  await page.getByLabel('Departure date').fill(date);
  const card=page.locator('.departure').filter({hasText:host.alias});
  await expect(card).toBeVisible();
  await expect(card).toContainText('2 spots open');
  const board=await page.request.get(`/api/groups?direction=to-station&date=${date}`);
  const group=(await board.json()).groups.find(g=>g.hostAlias===host.alias);
  expect(group.departureAt.slice(0,16)).toBe(departure.toISOString().slice(0,16));
  expect(JSON.stringify(group)).not.toContain(host.email);
  expect(group.memberIds).toBeUndefined();
  await accessible(page);
  await page.screenshot({path:testInfo.outputPath('board.png'),fullPage:true});
  const context=await browser.newContext({baseURL:'http://localhost:4173'});
  const second=await context.newPage();
  try {
    await login(second,neighbour);
    expect((await second.request.get(`/api/groups/${group.id}/messages`)).status()).toBe(403);
    await second.getByLabel('Departure date').fill(date);
    await second.locator('.departure').filter({hasText:host.alias}).getByRole('button',{name:'Join group →',exact:true}).click();
    await expect(second.getByRole('heading',{name:'To Thane West Station.'})).toBeVisible();
    await card.getByRole('button',{name:'Open group →',exact:true}).click();
    await expect(page.getByRole('heading',{name:'To Thane West Station.'})).toBeVisible();
    await page.getByLabel('Message your group').fill('At the public stand, wearing a blue cap.');
    await page.getByRole('button',{name:'Send →',exact:true}).click();
    await expect(second.getByText('At the public stand, wearing a blue cap.',{exact:true})).toBeVisible();
    await accessible(page);
    await page.screenshot({path:testInfo.outputPath('private-room.png'),fullPage:true});
    await second.getByRole('button',{name:'Leave group',exact:true}).click();
    await second.getByRole('button',{name:'Yes, leave group',exact:true}).click();
    await expect(second.getByRole('heading',{name:'Find your next three.'})).toBeVisible();
    expect((await second.request.get(`/api/groups/${group.id}/messages`)).status()).toBe(403);
    await page.getByRole('button',{name:'Cancel departure',exact:true}).click();
    await page.getByRole('button',{name:'Yes, cancel departure',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Find your next three.'})).toBeVisible();
    await expect(page.locator('.departure').filter({hasText:host.alias})).toHaveCount(0);
    expect((await (await page.request.get(`/api/groups/${group.id}`)).json()).group.status).toBe('cancelled');
  } finally { await context.close(); }
});

test('administrator issues invites and can review bounded member directory', async ({page}) => {
  const admin=await account('admin');
  await login(page,admin);
  await page.getByRole('button',{name:'Community',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Community members',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Create single-use invite',exact:true}).click();
  const code=await page.getByLabel('Share securely with your neighbour').inputValue();
  expect(code).toMatch(/^[a-f0-9]{64}$/);
  const invite=await Invite.findOne({codeHash:digest(code)});createdInviteIds.push(invite._id);
  await accessible(page);
});
