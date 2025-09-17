const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

dotenv.config();
const app = express();

// CORS Configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000','https://instagram-post-finder-xmvl.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control'],
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 5001;

// -------- Utilities --------
function parseCount(str) {
  if (!str) return 0;
  const s = String(str).trim().toLowerCase().replace(/,/g, '').replace(/\u00a0/g, ' ');
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*([kmmb]?)/i);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  const suf = (m[2] || '').toLowerCase();
  const mult = suf === 'k' ? 1_000 : suf === 'm' ? 1_000_000 : suf === 'b' ? 1_000_000_000 : 1;
  return Math.round(num * mult);
}

function usernameFromHref(href) {
  if (!href) return null;
  const reserved = new Set(['p', 'reel', 'explore', 'accounts', 'direct', 'stories', 'challenge']);
  try {
    const u = new URL(href, 'https://www.instagram.com');
    const parts = u.pathname.split('/').filter(Boolean);
    if (!parts.length) return null;
    if (reserved.has(parts[0])) return null;
    const cand = parts[0];
    return /^[a-z0-9._]+$/i.test(cand) ? cand : null;
  } catch {
    return null;
  }
}

async function buildDriver(headless = true) {
  const options = new chrome.Options();
  if (headless) {
    options.addArguments(
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage'
    );
  }
  options.addArguments(
    '--window-size=1280,900',
    '--lang=en-US',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36'
  );
  return new Builder().forBrowser('chrome').setChromeOptions(options).build();
}

async function addCookies(driver, cookies = []) {
  if (!cookies || !cookies.length) return;
  await driver.get('https://www.instagram.com/');
  for (const c of cookies) {
    const cookie = { ...c };
    if (!cookie.domain) cookie.domain = '.instagram.com';
    try {
      await driver.manage().addCookie(cookie);
    } catch {}
  }
  try {
    await driver.manage().addCookie({ name: 'ig_nrcb', value: '1', domain: '.instagram.com', path: '/' });
  } catch {}
}

async function waitFor(driver, predicateFn, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await predicateFn();
      if (ok) return true;
    } catch {}
    await driver.sleep(250);
  }
  return false;
}

// -------- Post Author Extraction --------
async function extractPostAuthor(driver) {
  const anchorCandidates = [
    By.css("a[href^='/'][class*='notranslate']"),
    By.css("a[href^='/'][role='link']"),
    By.xpath("//header//a[starts-with(@href,'/')]"),
    By.css("header a[href^='/']"),
  ];

  await driver.wait(async () => {
    for (const by of anchorCandidates) {
      const els = await driver.findElements(by);
      if (els.length) return true;
    }
    return false;
  }, 15000);

  for (const by of anchorCandidates) {
    const els = await driver.findElements(by);
    for (const el of els) {
      const href = await el.getAttribute('href');
      const uname = usernameFromHref(href);
      if (uname) return uname;
    }
  }
  return null;
}

// -------- Profile Extraction --------
async function isLoginPage(driver) {
  const url = await driver.getCurrentUrl();
  if (/\/accounts\/login/i.test(url)) return true;
  const forms = await driver.findElements(By.css("form input[name='username'], form input[name='password']"));
  return forms.length >= 2;
}

async function tryApiWebProfileInfo(driver, username) {
  const script = `
    const username = ${JSON.stringify(username)};
    return (async () => {
      try {
        const res = await fetch(
          'https://www.instagram.com/api/v1/users/web_profile_info/?username=' + encodeURIComponent(username),
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'accept': '*/*',
              'accept-language': 'en-US,en;q=0.9',
              'x-ig-app-id': '936619743392459'
            }
          }
        );
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        if (!json) return null;
        const user = json.data?.user || json.user || json.graphql?.user || null;
        if (!user) return null;
        const followers = user.edge_followed_by?.count ?? user.follower_count ?? null;
        const following = user.edge_follow?.count ?? user.following_count ?? null;
        const bio = (user.biography ?? '').trim();
        return {
          ok: true,
          source: 'api',
          followers: typeof followers === 'number' ? followers : null,
          following: typeof following === 'number' ? following : null,
          bio
        };
      } catch {
        return null;
      }
    })();
  `;
  try {
    const data = await driver.executeScript(script);
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}

async function tryOgMetaParse(driver) {
  const script = `
    const og =
      document.querySelector('meta[property="og:description"]')?.content ||
      document.querySelector('meta[name="description"]')?.content || '';
    const lower = og.toLowerCase();
    const mFollowers = lower.match(/([0-9][0-9.,]*\s*[kmb]?)[^a-z0-9]*followers/);
    const mFollowing = lower.match(/([0-9][0-9.,]*\s*[kmb]?)[^a-z0-9]*following/);
    return {
      og,
      followersRaw: mFollowers ? mFollowers[1] : null,
      followingRaw: mFollowing ? mFollowing[1] : null
    };
  `;
  try {
    const { og, followersRaw, followingRaw } = await driver.executeScript(script);
    const followers = followersRaw ? parseCount(followersRaw) : null;
    const following = followingRaw ? parseCount(followingRaw) : null;
    if (!og && followers == null && following == null) return null;
    return { ok: true, source: 'og', followers, following };
  } catch {
    return null;
  }
}

async function tryBioFromDom(driver, username) {
  const script = `
    const uname = ${JSON.stringify(username)};
    function cleanLines(lines) {
      const bad = ['followers', 'following', 'posts', 'follow', 'message', 'options', 'similar accounts', 'suggested'];
      return lines
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => !bad.some(k => s.toLowerCase().includes(k)))
        .filter(s => !s.replace(/[a-z]/gi,'').length || /[a-z]/i.test(s))
        .filter(s => !s.toLowerCase().includes(uname.toLowerCase()));
    }
    try {
      const lds = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(s => { try { return JSON.parse(s.textContent || ''); } catch { return null; } })
        .filter(Boolean);
      for (const obj of lds) {
        const desc = (obj && typeof obj.description === 'string' && obj.description.trim()) ? obj.description.trim() : '';
        if (desc) return { source: 'jsonld', bio: desc };
      }
    } catch {}
    const header = document.querySelector('header');
    if (header) {
      const text = header.innerText || '';
      const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
      const list = cleanLines(lines);
      const sorted = [...new Set(list)].sort((a,b) => b.length - a.length);
      const top = sorted.slice(0, 5);
      const candidate = top.find(s => /[\s,.@!?:]/.test(s)) || top[0] || '';
      if (candidate && candidate.length >= 3) {
        return { source: 'dom', bio: candidate };
      }
    }
    return null;
  `;
  try {
    return await driver.executeScript(script);
  } catch {
    return null;
  }
}

async function tryCountsFromAnchors(driver, username) {
  try {
    const followersEls = await driver.findElements(By.css(`a[href='/${username}/followers/']`));
    const followingEls = await driver.findElements(By.css(`a[href='/${username}/following/']`));
    let followers = null;
    let following = null;
    
    if (followersEls.length) {
      const txt = await followersEls[0].getText();
      followers = parseCount(txt);
    }
    if (followingEls.length) {
      const txt = await followingEls[0].getText();
      following = parseCount(txt);
    }
    
    if (followers == null && following == null) return null;
    return { ok: true, source: 'href', followers, following };
  } catch {
    return null;
  }
}

async function fetchProfileData(driver, username, timeoutMs = 30000) {
  if (!username) throw new Error('username required');
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/?hl=en`;
  await driver.get(url);
  
  await waitFor(
    driver,
    async () => {
      const urlNow = await driver.getCurrentUrl();
      if (/\/accounts\/login/i.test(urlNow)) return true;
      const hasOg = await driver.executeScript('return !!document.querySelector("meta[property=\'og:description\'], meta[name=\'description\']");');
      const hasHeader = (await driver.findElements(By.css('header'))).length > 0;
      return hasOg || hasHeader;
    },
    Math.min(20000, timeoutMs)
  );

  if (await isLoginPage(driver)) {
    throw new Error('Login required or invalid cookies — profile redirected to login.');
  }

  let followers = null;
  let following = null;
  let bio = null;

  const apiData = await tryApiWebProfileInfo(driver, username);
  if (apiData) {
    followers = apiData.followers ?? followers;
    following = apiData.following ?? following;
    bio = (apiData.bio || '').trim() || bio;
  }

  if (followers == null || following == null) {
    const ogData = await tryOgMetaParse(driver);
    if (ogData) {
      followers = followers ?? ogData.followers ?? null;
      following = following ?? ogData.following ?? null;
    }
  }

  if (followers == null || following == null) {
    const hrefData = await tryCountsFromAnchors(driver, username);
    if (hrefData) {
      followers = followers ?? hrefData.followers ?? null;
      following = following ?? hrefData.following ?? null;
    }
  }

  if (!bio) {
    const bioData = await tryBioFromDom(driver, username);
    if (bioData && bioData.bio) {
      bio = bioData.bio.trim();
    }
  }

  return {
    username,
    followers: typeof followers === 'number' ? followers : null,
    following: typeof following === 'number' ? following : null,
    bio: bio || null,
    profileUrl: url
  };
}

async function getPostAuthorAndProfile(postUrl, cookies = [], headless = true, timeoutMs = 60000) {
  const driver = await buildDriver(headless);
  try {
    if (cookies && cookies.length) {
      await addCookies(driver, cookies);
    }
    
    await driver.get(postUrl);
    
    await driver.wait(
      async () => {
        const hasTime = (await driver.findElements(By.css("time[datetime]"))).length > 0;
        const hasActions = (await driver.findElements(By.css("svg[aria-label='Like'], svg[aria-label='Comment']"))).length > 0;
        return hasTime || hasActions;
      },
      Math.min(20000, timeoutMs)
    );
    
    const author = await extractPostAuthor(driver);
    
    if (!author) {
      return { author: null, profile: null, error: 'Author not found' };
    }
    
    const profile = await fetchProfileData(driver, author, timeoutMs);
    
    return { author, profile };
    
  } catch (error) {
    return { author: null, profile: null, error: error.message };
  } finally {
    try { await driver.quit(); } catch {}
  }
}

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "Instagram Analytics API with Real-time Streaming 🚀",
    endpoints: [
      "GET  /api/profile - Check IG Business Account",
      "POST /api/hashtag-stream - Get hashtag posts with real-time streaming (SSE)"
    ],
    cors_enabled: true
  });
});

// ✅ Streaming Route with Server-Sent Events
app.post("/api/hashtag-stream", async (req, res) => {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });

  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { hashtag, cookies = [], headless = true, timeoutMs = 120000, limit = 10 } = req.body;
    
    if (!hashtag) {
      sendEvent('error', { 
        error: "Hashtag is required",
        example: {
          hashtag: "travel",
          cookies: [{ name: "sessionid", value: "your_session_id", domain: ".instagram.com" }],
          headless: true,
          timeoutMs: 120000,
          limit: 10
        }
      });
      return res.end();
    }

    console.log(`🔍 Streaming search for hashtag: #${hashtag}`);
    
    sendEvent('status', {
      message: `Starting search for hashtag: #${hashtag}`,
      stage: 'initialization',
      progress: 0
    });

    const hashtagSearchUrl = `https://graph.facebook.com/v19.0/ig_hashtag_search?user_id=${process.env.IG_BUSINESS_ID}&q=${hashtag}&access_token=${process.env.ACCESS_TOKEN}`;
    const hashtagResponse = await axios.get(hashtagSearchUrl);
    const hashtagId = hashtagResponse.data.data[0]?.id;
    
    if (!hashtagId) {
      sendEvent('error', { error: "Hashtag not found or no posts available" });
      return res.end();
    }

    console.log(`📍 Found hashtag ID: ${hashtagId}`);
    sendEvent('status', {
      message: `Found hashtag ID: ${hashtagId}`,
      stage: 'hashtag_found',
      progress: 10
    });

    const mediaUrl = `https://graph.facebook.com/v19.0/${hashtagId}/recent_media?user_id=${process.env.IG_BUSINESS_ID}&fields=id,caption,media_type,media_url,permalink,timestamp&access_token=${process.env.ACCESS_TOKEN}&limit=${limit}`;
    const mediaResponse = await axios.get(mediaUrl);
    const posts = mediaResponse.data.data;

    if (!posts || posts.length === 0) {
      sendEvent('complete', { 
        hashtag, 
        posts: [], 
        message: "No posts found for this hashtag" 
      });
      return res.end();
    }

    console.log(`📱 Found ${posts.length} posts, streaming author profiles...`);
    sendEvent('status', {
      message: `Found ${posts.length} posts, fetching profiles...`,
      stage: 'posts_found',
      progress: 20,
      total_posts: posts.length
    });

    sendEvent('metadata', {
      hashtag: hashtag,
      total_posts: posts.length,
      processed_at: new Date().toISOString(),
      headless_mode: headless,
      timeout_ms: timeoutMs
    });

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const progressPercent = Math.round(20 + (i / posts.length) * 70);
      
      console.log(`🔄 Processing post ${i + 1}/${posts.length}...`);
      
      sendEvent('progress', {
        current: i + 1,
        total: posts.length,
        percentage: progressPercent,
        processing_post: post.id,
        message: `Processing post ${i + 1} of ${posts.length}`
      });

      try {
        const { author, profile, error } = await getPostAuthorAndProfile(
          post.permalink, 
          cookies, 
          headless, 
          timeoutMs
        );
        
        const enrichedPost = {
          post_data: {
            media_id: post.id,
            caption: post.caption,
            media_type: post.media_type,
            media_url: post.media_url,
            permalink: post.permalink,
            timestamp: post.timestamp
          },
          author_data: {
            username: author,
            profile: profile,
            extraction_error: error || null
          },
          index: i,
          processed_at: new Date().toISOString()
        };

        sendEvent('post_processed', enrichedPost);
        
        console.log(`✅ Successfully processed post ${i + 1}/${posts.length} - @${author || 'unknown'}`);
        
        if (i < posts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Error processing post ${post.id}:`, error.message);
        
        const errorPost = {
          post_data: {
            media_id: post.id,
            caption: post.caption,
            media_type: post.media_type,
            media_url: post.media_url,
            permalink: post.permalink,
            timestamp: post.timestamp
          },
          author_data: {
            username: null,
            profile: null,
            extraction_error: error.message
          },
          index: i,
          processed_at: new Date().toISOString()
        };

        sendEvent('post_processed', errorPost);
      }
    }

    sendEvent('complete', {
      success: true,
      hashtag: hashtag,
      total_posts_processed: posts.length,
      completed_at: new Date().toISOString(),
      message: `Successfully processed all ${posts.length} posts`
    });

    console.log(`✅ Completed streaming ${posts.length} posts for #${hashtag}`);

  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    sendEvent('error', { 
      error: "Something went wrong", 
      details: err.response?.data || err.message 
    });
  } finally {
    res.end();
  }
});

// Basic profile check route
app.get("/api/profile", async (req, res) => {
  try {
    const url = `https://graph.facebook.com/v19.0/${process.env.IG_BUSINESS_ID}?fields=id,username,followers_count,follows_count,media_count&access_token=${process.env.ACCESS_TOKEN}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Instagram Analytics Server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /api/profile - Check IG Business Account`);
  console.log(`   POST /api/hashtag-stream - Get hashtag posts with real-time streaming (SSE)`);
  console.log(`✅ CORS enabled for cross-origin requests`);
});
