const https = require('https');
const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, 'cards');
const TOTAL = 80;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchCards() {
  if (!fs.existsSync(CARDS_DIR)) fs.mkdirSync(CARDS_DIR);

  // Clear old cards
  for (const f of fs.readdirSync(CARDS_DIR)) {
    if (f.endsWith('.png') || f.endsWith('.jpg')) fs.unlinkSync(path.join(CARDS_DIR, f));
  }

  const sets = ['base1', 'base2', 'base3', 'base4', 'base5', 'neo1', 'neo2'];
  let allCards = [];

  for (const setId of sets) {
    if (allCards.length >= TOTAL) break;
    console.log(`Fetching set: ${setId}...`);
    const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&pageSize=40&select=id,images`;
    const res = await fetch(url);
    if (res.status !== 200) { console.log(`  Set ${setId} failed (${res.status})`); continue; }
    const data = JSON.parse(res.body.toString());
    if (data.data) allCards.push(...data.data);
  }

  allCards = allCards.slice(0, TOTAL);
  console.log(`Downloading ${allCards.length} card images...`);

  let done = 0;
  const download = async (card, i) => {
    const imgUrl = card.images.large || card.images.small;
    if (!imgUrl) return;
    try {
      const res = await fetch(imgUrl);
      if (res.status === 200) {
        const ext = imgUrl.includes('.png') ? '.png' : '.jpg';
        const filename = `card-${String(i + 1).padStart(3, '0')}${ext}`;
        fs.writeFileSync(path.join(CARDS_DIR, filename), res.body);
        done++;
        if (done % 10 === 0) console.log(`  ${done}/${allCards.length} downloaded`);
      }
    } catch (e) { console.log(`  Failed: ${card.id}`); }
  };

  // Download 5 at a time
  for (let i = 0; i < allCards.length; i += 5) {
    const batch = allCards.slice(i, i + 5).map((c, j) => download(c, i + j));
    await Promise.all(batch);
  }

  console.log(`Done! ${done} cards saved to ${CARDS_DIR}`);
}

fetchCards().catch(console.error);
